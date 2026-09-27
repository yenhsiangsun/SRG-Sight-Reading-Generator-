interface SampleLoadOptions {
  urls: Record<string, string>;
  baseUrl: string;
  pageUrl: string;
  decode: (bytes: ArrayBuffer) => Promise<AudioBuffer>;
  timeoutMs?: number;
  signal?: AbortSignal;
  /** A decoded recording belongs to the AudioContext that decoded it. */
  cacheContext?: object;
  cache?: RecordedSampleCache;
}

/** Retain recently decoded PCM, never samplers or their active voices. The bound
 * applies across contexts and instruments; active playback may hold its own refs. */
export class RecordedSampleCache {
  private contexts = new WeakMap<object, number>();
  private nextContext = 0;
  private entries = new Map<string, {buffer: AudioBuffer; bytes: number}>();
  private bytes = 0;
  private maxBytes: number;
  private maxEntries: number;

  constructor(maxBytes = 32 * 1024 * 1024, maxEntries = 64) {
    this.maxBytes = maxBytes; this.maxEntries = maxEntries;
  }

  private key(context: object, url: string) {
    let id = this.contexts.get(context);
    if (id === undefined) { id = this.nextContext++; this.contexts.set(context, id); }
    return `${id}:${url}`;
  }

  get(context: object, url: string) {
    const key = this.key(context, url), entry = this.entries.get(key);
    if (!entry) return undefined;
    this.entries.delete(key); this.entries.set(key, entry);
    return entry.buffer;
  }

  set(context: object, url: string, buffer: AudioBuffer) {
    const bytes = buffer.length * buffer.numberOfChannels * 4;
    if (!Number.isSafeInteger(bytes) || bytes <= 0 || bytes > this.maxBytes || this.maxEntries < 1) return;
    const key = this.key(context, url), previous = this.entries.get(key);
    if (previous) { this.bytes -= previous.bytes; this.entries.delete(key); }
    this.entries.set(key, {buffer, bytes}); this.bytes += bytes;
    while (this.bytes > this.maxBytes || this.entries.size > this.maxEntries) {
      const oldest = this.entries.entries().next().value!;
      this.entries.delete(oldest[0]); this.bytes -= oldest[1].bytes;
    }
  }
}

const recordedSampleCache = new RecordedSampleCache();

function canceledLoad() {
  const error = new Error('Sample loading canceled');
  error.name = 'AbortError';
  return error;
}

function sameNativeHost(asset: URL, page: URL) {
  // Capacitor media resources use URLResponse instead of HTTPURLResponse. WKWebView
  // may therefore report status 0 for a successful bundled WAV/MP3 request.
  // Never apply this exception to HTTP, another host or an opaque CORS response.
  return page.protocol === 'capacitor:' && asset.protocol === page.protocol
    && asset.hostname === page.hostname && asset.port === page.port;
}

function isRecordedAudio(bytes: ArrayBuffer) {
  const data = new Uint8Array(bytes);
  const tag = (offset: number, value: string) => [...value].every((char, i) => data[offset + i] === char.charCodeAt(0));
  return data.length > 12 && (
    (tag(0, 'RIFF') && tag(8, 'WAVE')) || tag(0, 'ID3')
    || (data[0] === 0xff && (data[1] & 0xe0) === 0xe0)
  );
}

/** Decode bundled recordings before handing them to Tone, including WKWebView's
 * non-HTTP media responses. Bounded concurrency avoids 85 simultaneous piano
 * decodes on an iPad. No synthesized fallback is substituted on failure. */
export async function loadRecordedSamples({urls, baseUrl, pageUrl, decode, timeoutMs = 60000, signal, cacheContext, cache = recordedSampleCache}: SampleLoadOptions) {
  if (signal?.aborted) throw canceledLoad();
  const page = new URL(pageUrl);
  const base = new URL(baseUrl, page);
  const entries = Object.entries(urls);
  const buffers: Record<string, AudioBuffer> = {};
  const controller = new AbortController();
  let abortReason: unknown;
  const abort = (reason: unknown) => { abortReason = reason; controller.abort(); };
  const canceled = new Promise<never>((_, reject) => {
    controller.signal.addEventListener('abort', () => reject(abortReason ?? canceledLoad()), {once: true});
  });
  const onCancel = () => abort(canceledLoad());
  signal?.addEventListener('abort', onCancel, {once: true});
  let next = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const worker = async () => {
    while (next < entries.length && !controller.signal.aborted) {
      const [note, filename] = entries[next++];
      const url = new URL(filename, base);
      const cached = cacheContext && cache.get(cacheContext, url.href);
      if (cached) { buffers[note] = cached; continue; }
      const response = await fetch(url.href, {signal: controller.signal});
      const nativeResponse = response.status === 0 && sameNativeHost(url, page)
        && response.type !== 'opaque' && response.type !== 'opaqueredirect';
      if (!response.ok && !nativeResponse) throw new Error(`Sample request failed (${response.status}): ${url.pathname}`);
      const bytes = await response.arrayBuffer();
      // Missing files sometimes return the app's HTML entry point with status 200.
      if (!isRecordedAudio(bytes)) throw new Error(`Invalid audio data: ${url.pathname}`);
      if (controller.signal.aborted) return;
      const buffer = await decode(bytes);
      if (controller.signal.aborted) return;
      if (!buffer.length || !buffer.numberOfChannels) throw new Error(`Empty audio: ${url.pathname}`);
      buffers[note] = buffer;
      // In-flight requests are intentionally independent: canceling one score
      // must not abort another consumer. Only complete, uncanceled PCM is shared.
      if (cacheContext) cache.set(cacheContext, url.href, buffer);
    }
  };

  try {
    timer = setTimeout(() => abort(new Error('音色載入逾時，請重試。')), timeoutMs);
    await Promise.race([
      Promise.all(Array.from({length: Math.min(3, entries.length)}, worker)),
      canceled,
    ]);
    if (controller.signal.aborted) throw abortReason ?? canceledLoad();
    return buffers;
  } catch (error) {
    abort(error);
    for (const note of Object.keys(buffers)) delete buffers[note];
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onCancel);
  }
}

function noteMidi(note: string) {
  const match = note.match(/^([a-g])([#b]*)\/?(-?\d+)$/i);
  if (!match) return NaN;
  const natural = {c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11}[match[1].toLowerCase()]!;
  return (Number(match[3]) + 1) * 12 + natural
    + [...match[2]].reduce((sum, sign) => sum + (sign === '#' ? 1 : -1), 0);
}

/** Preserve Tone's nearest-recording choice (upper sample wins equal distances),
 * loading only recordings needed by the score instead of an entire piano bank. */
export function samplesForNotes(urls: Record<string, string>, notes?: readonly string[]) {
  if (!notes?.length) return urls;
  const roots = Object.keys(urls).map(note => ({note, midi: noteMidi(note)}));
  if (!roots.length || roots.some(root => !Number.isFinite(root.midi))) return urls;
  const pitches = notes.map(noteMidi);
  if (pitches.some(pitch => !Number.isFinite(pitch))) return urls;
  const needed = new Set<string>();
  for (const pitch of pitches) {
    let best = roots[0];
    for (const root of roots) {
      const distance = Math.abs(root.midi - pitch), bestDistance = Math.abs(best.midi - pitch);
      if (distance < bestDistance || (distance === bestDistance && root.midi > best.midi)) best = root;
    }
    needed.add(best.note);
  }
  return Object.fromEntries(Object.entries(urls).filter(([note]) => needed.has(note)));
}
