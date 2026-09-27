import * as Tone from 'tone';
import manifest from './sampleManifest.json';
import {createInstrumentSynth} from './createInstrumentSynth';
import {loadRecordedSamples, samplesForNotes} from './loadRecordedSamples';
interface SampleSet { folder: string; urls: Record<string,string>; volume?: number }
const samples:Record<string,SampleSet>=manifest;
export const hasSamples=(instrument:string)=>Object.hasOwn(samples,instrument);
export async function createPlaybackInstrument(instrument:string, notes?: readonly string[], signal?: AbortSignal) {
  if (signal?.aborted) { const error = new Error('Sample loading canceled'); error.name = 'AbortError'; throw error; }
  const localPipa = import.meta.env.VITE_LOCAL_PIPA && instrument === 'Pipa';
  const selected: SampleSet | undefined=localPipa ? {folder:'', urls:{A2:'45.wav','C#3':'49.wav',F3:'53.wav',A3:'57.wav',D4:'62.wav','F#4':'66.wav',C5:'72.wav',E5:'76.wav',G5:'79.wav'}} : samples[instrument];
  if(!selected)return createInstrumentSynth(instrument);
  const urls = samplesForNotes(selected.urls, notes);
  let sampler: Tone.Sampler | undefined;
  try {
    const context = Tone.getContext();
    const buffers = await loadRecordedSamples({
      urls,
      baseUrl: localPipa ? '/__local-pipa/' : `${import.meta.env.BASE_URL}samples/${selected.folder}/`,
      pageUrl: document.baseURI,
      decode: bytes => context.decodeAudioData(bytes),
      signal,
      // Development recordings can change under the same URL while previewing.
      cacheContext: localPipa ? undefined : context,
    });
    if (signal?.aborted) { const error = new Error('Sample loading canceled'); error.name = 'AbortError'; throw error; }
    // Decoded AudioBuffers bypass Tone's HTTP-only fetch check. Construction is
    // synchronous here: playback never starts with partially loaded recordings.
    sampler = new Tone.Sampler({
      urls: buffers,
      attack: localPipa ? 0 : 0.005,
      release: instrument === 'Piano' ? 0.5 : 0.15,
      volume: selected.volume ?? -10,
    });
    return sampler.toDestination();
  } catch (cause) {
    sampler?.dispose();
    if (signal?.aborted) throw cause;
    throw new Error('無法載入樂器音色，請重試。', {cause});
  }
}
