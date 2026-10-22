import type {ExerciseData} from '../music';
import type {ExerciseSettings} from '../hooks/useExercise';
import {normalizeKeySignatureChoices} from '../music/keySignatureChoices';
import {melodicVoice} from '../music/exerciseQuality';
import {rhythmFocuses} from './focus';

export const RECENT_VARIETY_KEY = 'sight-reading-recent-variety-v1';
export const RECENT_VARIETY_LIMIT = 5;
const MAX_SEQUENCE = 160;
const MAX_STORAGE_LENGTH = 32_000;
type VarietyStorage = Pick<Storage, 'getItem'|'setItem'>;

/** Small musical summaries, never saved audio, settings snapshots or raw scores. */
export interface RecentExerciseFingerprint {
  version: 1;
  context: string;
  melody: number[];
  rhythm: number[];
  arc: number[];
  phrases: number[];
  harmony: number[];
}

function sorted(values: readonly string[]): string[] { return [...new Set(values)].sort(); }
const mod = (value: number) => (value % 12 + 12) % 12;
const limited = (value: number) => Math.max(-36, Math.min(36, Math.round(value)));

function contextKey(exercise: ExerciseData, settings: ExerciseSettings): string {
  // Compare the user's training choices. The randomly drawn key and tempo are
  // intentionally absent: transposing a recent tune is still the same tune.
  return JSON.stringify([
    settings.instrument, settings.clef, settings.difficulty, settings.rhythmLevel,
    settings.pitchFocus ?? 'balanced', sorted(rhythmFocuses(settings.rhythmFocus)),
    settings.mixedMeters, settings.timeSignature,
    settings.mixedMeters ? sorted(settings.meters) : [],
    normalizeKeySignatureChoices(settings.allowedKeySignatures)?.slice().sort() ?? [],
    settings.rangeMinMidi, settings.rangeMaxMidi, settings.allowAccidentals,
    exercise.measures.length, exercise.grandMode ?? 'single',
  ]);
}

/** Sample across the complete study instead of keeping only its opening bars. */
function bounded(values: number[], limit = MAX_SEQUENCE): number[] {
  if (values.length <= limit) return values;
  return Array.from({length: limit}, (_, index) => values[Math.round(index * (values.length - 1) / (limit - 1))]);
}

/** Whole-study comparison does not forbid a motif returning within one study. */
export function fingerprintExercise(exercise: ExerciseData, settings: ExerciseSettings): RecentExerciseFingerprint {
  const voice = melodicVoice(exercise);
  const pitches = voice.flatMap(bar => bar.events.flatMap(note =>
    !note.rest && Number.isFinite(note.midi) ? [note.midi!] : []));
  const first = pitches[0] ?? 0;
  const melody = pitches.slice(1).map((pitch, index) => limited(pitch - pitches[index]));
  const rhythm = voice.flatMap(bar => [
    // Bar markers preserve meter sections and distinguish identical cells with
    // a different large-beat arrangement. Tuplets have exact 1/24-unit ticks.
    -Math.round(bar.totalUnits * 24),
    ...bar.events.map(note => Math.round(note.startUnits * 24) * 10_000
      + Math.round(note.durationUnits * 24) * 10 + Number(note.rest)),
  ]);
  const arc = voice.flatMap(bar => {
    const notes = bar.events.flatMap(note => !note.rest && Number.isFinite(note.midi) ? [note.midi!] : []);
    if (!notes.length) return [99, 99, 99, 99];
    // Entry, mean register, exit and peak describe longer melodic lines, even
    // for legacy scores without an explicit shared phrase plan.
    return [notes[0], notes.reduce((sum, pitch) => sum + pitch, 0) / notes.length,
      notes.at(-1)!, Math.max(...notes)].map(pitch => limited(pitch - first));
  });
  const roles = {opening: 1, development: 2, answer: 3, closing: 4};
  const phrases = (exercise.phrasePlan ?? []).map(phrase => roles[phrase.role] * 100 + phrase.endBar - phrase.startBar + 1);
  const home = exercise.harmonyPlan?.[0]?.root ?? 0;
  const harmony = (exercise.harmonyPlan ?? []).map(bar => mod(bar.root - home) * 8192
    + bar.pitches.reduce((mask, pitch) => mask | (1 << mod(pitch - bar.root)), 0));
  // Actual voicings also distinguish two sheng/piano studies that happen to
  // share a harmonic plan; their shape is independent of absolute register.
  const voicings = [...exercise.measures, ...exercise.lowerMeasures ?? []].flatMap(bar => bar.events.flatMap(note => {
    if (note.rest || !note.chord || note.chord.length < 2) return [];
    const ordered = note.chord.map(pitch => pitch.midi).sort((a, b) => a - b);
    return [1_000_000 + ordered.slice(1).reduce((mask, pitch) => mask | (1 << Math.min(23, pitch - ordered[0])), 0)];
  }));
  const bass = exercise.grandMode === 'two-hand' ? (exercise.lowerMeasures ?? []).flatMap(bar =>
    bar.events.flatMap(note => !note.rest && Number.isFinite(note.midi) ? [note.midi!] : [])) : [];
  const bassContour = bass.slice(1).map((pitch, index) => -2_000_000 - limited(pitch - bass[index]));
  return {version: 1, context: contextKey(exercise, settings), melody: bounded(melody), rhythm: bounded(rhythm),
    arc: bounded(arc, 128), phrases: bounded(phrases, 32), harmony: bounded([...harmony, ...voicings, ...bassContour], 80)};
}

/** Ordered overlap allows a little musical variation without treating changed
 * note count or extra ornaments as an entirely new melody. Bounded vectors keep
 * comparison cheap enough for the same three-candidate budget on a tablet.
 */
function sequenceSimilarity(a: readonly number[], b: readonly number[], nearIntervals = false): number | null {
  if (!a.length || !b.length) return null;
  let previous = new Float32Array(b.length + 1);
  for (const value of a) {
    const current = new Float32Array(b.length + 1);
    for (let index = 1; index <= b.length; index++) {
      const other = b[index - 1];
      const match = value === other ? 1 : nearIntervals && value !== 0 && Math.sign(value) === Math.sign(other)
        && Math.abs(value - other) === 1 ? .75 : 0;
      current[index] = Math.max(previous[index], current[index - 1], previous[index - 1] + match);
    }
    previous = current;
  }
  return 2 * previous[b.length] / (a.length + b.length);
}

function melodicSimilarity(a: readonly number[], b: readonly number[]): number | null {
  // Diatonic steps can be one or two semitones. Their direction and gesture
  // still sound related. Repeated notes and opposite directions stay distinct;
  // wider changes receive no extra similarity just for sharing a direction.
  return sequenceSimilarity(a, b, true);
}

function arcSimilarity(a: readonly number[], b: readonly number[]): number | null {
  const exact = sequenceSimilarity(a, b);
  if (exact === null) return null;
  const count = Math.min(a.length, b.length);
  let proximity = 0;
  for (let index = 0; index < count; index++) proximity += a[index] === 99 || b[index] === 99
    ? Number(a[index] === b[index]) : a[index] === b[index] ? 1 : Math.abs(a[index] - b[index]) === 1 ? .75 : 0;
  return exact * .5 + proximity / Math.max(a.length, b.length) * .5;
}

function musicalSimilarity(a: RecentExerciseFingerprint, b: RecentExerciseFingerprint): number {
  const components = [
    [melodicSimilarity(a.melody, b.melody), .44],
    [sequenceSimilarity(a.rhythm, b.rhythm), .28],
    [arcSimilarity(a.arc, b.arc), .16],
    [sequenceSimilarity(a.phrases, b.phrases), .06],
    [sequenceSimilarity(a.harmony, b.harmony), .06],
  ];
  let weighted = 0, weight = 0;
  for (const [similarity, importance] of components) if (similarity !== null) {
    weighted += similarity * importance!;
    weight += importance!;
  }
  return weight ? weighted / weight : 0;
}

/** Higher means more like a recent accepted study. This compares composition
 * sameness only; it never rewards fewer notes, smaller leaps or slower tempo.
 * History is newest first. A previous-context score cannot affect new settings.
 */
export function scoreRecentSimilarity(exercise: ExerciseData, history: readonly RecentExerciseFingerprint[], settings: ExerciseSettings): number {
  const current = fingerprintExercise(exercise, settings);
  return history.slice(0, RECENT_VARIETY_LIMIT).reduce((penalty, previous, index) =>
    previous.context === current.context
      ? Math.max(penalty, musicalSimilarity(current, previous) * (1 - index * .025),
        // A changed melody alone should not excuse an identical whole-song
        // rhythm immediately after it. Use the existing bounded retry budget;
        // no new persistence, unbounded rejection or relaxed difficulty rules.
        settings.compositionStyle==='auto'&&index===0&&current.rhythm.length>0&&current.rhythm.length===previous.rhythm.length&&
          current.rhythm.every((value,i)=>value===previous.rhythm[i]) ? .85 : 0) : penalty, 0);
}

function defaultStorage(): VarietyStorage | undefined {
  try { return typeof localStorage === 'undefined' ? undefined : localStorage; }
  catch { return undefined; }
}

function validFingerprint(value: unknown): value is RecentExerciseFingerprint {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<RecentExerciseFingerprint>;
  const vector = (item: unknown, max: number): boolean => Array.isArray(item) && item.length <= max
    && item.every(number => typeof number === 'number' && Number.isInteger(number) && Math.abs(number) <= 100_000_000);
  return Object.keys(entry).length === 7 && entry.version === 1 && typeof entry.context === 'string' && entry.context.length <= 1024
    && vector(entry.melody, MAX_SEQUENCE) && vector(entry.rhythm, MAX_SEQUENCE)
    && vector(entry.arc, 128) && vector(entry.phrases, 32) && vector(entry.harmony, 80);
}

export function readRecentExercises(storage: VarietyStorage | undefined = defaultStorage()): RecentExerciseFingerprint[] {
  try {
    const raw = storage?.getItem(RECENT_VARIETY_KEY);
    if (!raw || raw.length > MAX_STORAGE_LENGTH) return [];
    const data = JSON.parse(raw);
    if (data?.version !== 1 || !Array.isArray(data.entries) || data.entries.length > RECENT_VARIETY_LIMIT
      || !data.entries.every(validFingerprint)) return [];
    return data.entries;
  } catch { return []; }
}

/** Call only after accepting a newly generated study. Resume and preview flows
 * must not call this: looking at a score should not change the next exercise.
 */
export function rememberRecentExercise(exercise: ExerciseData, settings: ExerciseSettings,
  history: readonly RecentExerciseFingerprint[] = readRecentExercises(), storage: VarietyStorage | undefined = defaultStorage()): RecentExerciseFingerprint[] {
  const entry = fingerprintExercise(exercise, settings);
  const updated = [entry, ...history.filter(validFingerprint)].slice(0, RECENT_VARIETY_LIMIT);
  try {
    const raw = JSON.stringify({version: 1, entries: updated});
    if (raw.length <= MAX_STORAGE_LENGTH) storage?.setItem(RECENT_VARIETY_KEY, raw);
  } catch { /* Keep the current session usable if persistence is blocked. */ }
  return updated;
}
