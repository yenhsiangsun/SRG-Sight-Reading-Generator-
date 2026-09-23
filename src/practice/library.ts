import type {ExerciseData, MeasureData, TimeSignature} from '../music';
import type {ExerciseSettings} from '../hooks/useExercise';
import {CLEFS, INSTRUMENTS, KEY_SIGNATURES, TIME_SIGNATURES} from '../exerciseConfig';
import {SCALES, TONICS} from '../music/scales';
import {midiFromKey} from '../music/notePitches';
import {canPlayShengChord} from '../music/shengFingering';
import {assertMeasureRhythm} from '../music/rhythmTiming';

export const LIBRARY_KEY = 'sight-reading-library-v1';
export interface SavedStudy {id: string; created: number; bpm: number; settings: ExerciseSettings; exercise?: ExerciseData}
export interface Library {version: 1; scores: SavedStudy[]; presets: SavedStudy[]}
export const emptyLibrary = (): Library => ({version: 1, scores: [], presets: []});
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const member = (value: unknown, choices: readonly unknown[]) => choices.includes(value);
const integer = (value: unknown, min: number, max: number) => typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;

export function validSettings(value: unknown): value is ExerciseSettings {
  if (!record(value)) return false;
  return typeof value.instrument === 'string' && Object.hasOwn(INSTRUMENTS, value.instrument) && member(value.clef, CLEFS)
    && member(value.difficulty, ['Beginner','Intermediate','Advanced']) && member(value.rhythmLevel, ['Simple','Moderate','Complex'])
    && member(value.rhythmFocus, [undefined,'balanced','sixteenths','dotted']) && member(value.keySignature, KEY_SIGNATURES)
    && member(value.tonic, TONICS) && SCALES.some(scale => scale.id === value.scaleId)
    && member(value.timeSignature, TIME_SIGNATURES) && integer(value.measureCount,1,32)
    && integer(value.rangeMinMidi,0,126) && integer(value.rangeMaxMidi,1,127) && Number(value.rangeMinMidi) < Number(value.rangeMaxMidi)
    && typeof value.allowAccidentals === 'boolean' && typeof value.mixedMeters === 'boolean'
    && Array.isArray(value.meters) && value.meters.length <= 10 && value.meters.every(meter => member(meter,TIME_SIGNATURES))
    && (!value.mixedMeters || new Set(value.meters).size >= 2);
}

function validMeasure(value: unknown, fallback: string): value is MeasureData {
  if (!record(value)) return false;
  const meter = value.timeSignature ?? fallback;
  if (!member(meter,TIME_SIGNATURES) || !Array.isArray(value.events) || !value.events.length || value.events.length > 64) return false;
  const [top,bottom] = String(meter).split('/').map(Number), total = top * 16 / bottom;
  if (value.totalUnits !== total || !Array.isArray(value.groups) || !value.groups.length || !value.groups.every(n => integer(n,1,16)) || value.groups.reduce((a,b)=>a+b,0)!==total) return false;
  for (const note of value.events) {
    if (!record(note) || typeof note.rest !== 'boolean' || typeof note.key !== 'string' || !/^[a-g][#b]{0,2}\/-?\d$/.test(note.key)
      || !integer(note.octave,-1,9) || !member(note.duration,['w','h','q','8','16']) || !integer(note.dots,0,2)
      || typeof note.startUnits !== 'number' || typeof note.durationUnits !== 'number') return false;
    if (note.chord !== undefined) {
      if (note.rest || !Array.isArray(note.chord) || note.chord.length < 2 || note.chord.length > 4) return false;
      if (!note.chord.every(pitch => record(pitch) && typeof pitch.key === 'string' && /^[a-g][#b]{0,2}\/-?\d$/.test(pitch.key)
        && integer(pitch.midi,0,127) && pitch.midi === midiFromKey(pitch.key) && pitch.octave === Number(pitch.key.split('/')[1]))) return false;
      if (new Set(note.chord.map(pitch => pitch.midi)).size !== note.chord.length || !note.chord.some(pitch => pitch.key === note.key)) return false;
    }
  }
  try {assertMeasureRhythm(value as unknown as MeasureData, meter as TimeSignature);return true;}
  catch {return false;}
}

export function validStudy(value: unknown, score: boolean): value is SavedStudy {
  if (!record(value) || typeof value.id !== 'string' || value.id.length > 100 || !integer(value.created,0,Number.MAX_SAFE_INTEGER) || !integer(value.bpm,40,180) || !validSettings(value.settings)) return false;
  if (!score) return value.exercise === undefined;
  const ex = value.exercise;
  const settings = value.settings;
  if (!record(ex) || !member(ex.timeSignature,TIME_SIGNATURES) || !member(ex.clef,['treble','bass','alto','tenor'])
    || !member(ex.staffMode,[undefined,'fixed','mixed']) || (ex.staffMode==='mixed' && ex.lowerMeasures!==undefined)
    || !member(ex.keySignature,KEY_SIGNATURES) || !member(ex.difficulty,['beginner','intermediate','advanced']) || !member(ex.rhythmLevel,['simple','medium','complex'])
    || !integer(ex.tempo,40,180) || !integer(ex.transposition ?? 0,-48,48) || ex.soundProfile !== value.settings.instrument
    || !Array.isArray(ex.measures) || !ex.measures.length || ex.measures.length > 32 || !ex.measures.every(m => validMeasure(m,String(ex.timeSignature)))) return false;
  if (ex.tonality !== undefined) {
    const tonality=ex.tonality;
    if (!record(tonality) || !member(tonality.tonic,[null,...TONICS]) || !SCALES.some(s=>s.id===tonality.scaleId)
      || !member(tonality.signature,[null,...TONICS]) || !Array.isArray(tonality.notes) || !tonality.notes.every(n=>typeof n==='string' && /^[A-G][#b]{0,2}$/.test(n))) return false;
  }
  if (ex.lowerMeasures !== undefined && (!Array.isArray(ex.lowerMeasures) || ex.lowerMeasures.length !== ex.measures.length
    || !member(ex.grandMode,['mono','two-hand']) || !ex.lowerMeasures.every((m,i) => validMeasure(m,String(ex.timeSignature)) && m.totalUnits === (ex.measures as MeasureData[])[i].totalUnits))) return false;
  const staves = [...ex.measures as MeasureData[], ...(ex.lowerMeasures as MeasureData[] | undefined ?? [])];
  if (staves.some(bar => bar.events.some(note => note.chord && (
    note.chord.some(pitch => pitch.midi < settings.rangeMinMidi || pitch.midi > settings.rangeMaxMidi) ||
    (ex.soundProfile === 'Sheng' && !canPlayShengChord(note.chord.map(pitch => pitch.midi)))
  )))) return false;
  return true;
}

export function readLibrary(raw: string | null): Library {
  try {
    if (!raw || raw.length > 16_000_000) return emptyLibrary();
    const data: unknown = JSON.parse(raw);
    if (!record(data) || data.version !== 1 || !Array.isArray(data.scores) || !Array.isArray(data.presets)) return emptyLibrary();
    return {version:1, scores:data.scores.filter(s=>validStudy(s,true)).slice(0,50), presets:data.presets.filter(s=>validStudy(s,false)).slice(0,20)};
  } catch { return emptyLibrary(); }
}

export function addStudy(library: Library, study: SavedStudy, kind: 'scores' | 'presets'): Library {
  const limit = kind === 'scores' ? 50 : 20;
  const same = (item: SavedStudy) => JSON.stringify(kind === 'scores' ? item.exercise : item.settings) === JSON.stringify(kind === 'scores' ? study.exercise : study.settings) && item.bpm === study.bpm;
  if (library[kind].some(same)) return library;
  if (library[kind].length >= limit) throw new Error('libraryFull');
  return {...library, [kind]: [JSON.parse(JSON.stringify(study)), ...library[kind]]};
}
