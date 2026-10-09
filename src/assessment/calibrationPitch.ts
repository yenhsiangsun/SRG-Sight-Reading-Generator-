import type {Clef, ExerciseData, GeneratedNote} from '../music';
import {INSTRUMENTS, type Instrument} from '../music/instruments';

export interface CalibrationPitch {
  clef: Clef;
  /** Written pitch, suitable for a VexFlow StaveNote key. */
  noteKey: string;
  midi: number;
}

const NATURAL_PITCH_CLASSES = new Set([0, 2, 4, 5, 7, 9, 11]);
const NOTE_NAMES = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];
const STAFF_CENTRE: Record<Clef, number> = {treble: 71, bass: 50, alto: 60, tenor: 57};

function writtenMidi(note: Pick<GeneratedNote, 'key' | 'midi'>): number | undefined {
  if (Number.isInteger(note.midi) && note.midi! >= 0 && note.midi! <= 127) return note.midi;
  const match = /^([a-g])([#b]{0,2})\/(-?\d+)$/i.exec(note.key);
  if (!match) return undefined;
  const natural = {c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11}[match[1].toLowerCase() as 'c'];
  return (Number(match[3]) + 1) * 12 + natural
    + [...match[2]].reduce((sum, mark) => sum + (mark === '#' ? 1 : -1), 0);
}

/** A readable reference for the eight repeated calibration notes, not a pitch test. */
export function selectCalibrationPitch(exercise: ExerciseData): CalibrationPitch {
  const name = exercise.soundProfile;
  const profile = name && Object.hasOwn(INSTRUMENTS, name)
    ? INSTRUMENTS[name as Instrument] : INSTRUMENTS[exercise.instrument];
  const transposition = exercise.transposition ?? profile.transpose;
  // The detector's reliable test range is sounding C2–F#6. Profile bounds are written.
  const instrumentMin = Math.max(profile.min, 36 - transposition);
  const instrumentMax = Math.min(profile.max, 90 - transposition);
  let min = instrumentMin;
  let max = instrumentMax;
  const pitches = [...exercise.measures, ...(exercise.lowerMeasures ?? [])]
    .flatMap(measure => measure.events)
    .filter(note => !note.rest)
    .flatMap(note => [note, ...(note.chord ?? [])])
    .map(writtenMidi)
    .filter((midi): midi is number => midi !== undefined && midi >= 0 && midi <= 127);
  // ExerciseData has no saved custom-range fields; its notes provide the current register.
  if (pitches.length) {
    const rangeMin = Math.max(min, Math.min(...pitches));
    const rangeMax = Math.min(max, Math.max(...pitches));
    if (rangeMin <= rangeMax) { min = rangeMin; max = rangeMax; }
  }
  const flexibleClef = exercise.staffMode === 'mixed' || Boolean(exercise.grandMode || exercise.lowerMeasures);
  const clef = flexibleClef ? ((min + max) / 2 < 60 ? 'bass' : 'treble') : exercise.clef;
  const pitchesInRange = Array.from({length: Math.max(0, Math.floor(max) - Math.ceil(min) + 1)}, (_, i) => Math.ceil(min) + i);
  const naturalPitches = pitchesInRange.filter(midi => NATURAL_PITCH_CLASSES.has(midi % 12));
  const candidates = naturalPitches.length ? naturalPitches : pitchesInRange;
  // All current instrument profiles overlap the detector. Keep a safe written fallback
  // for a legacy exercise with an unusual custom transposition that has no overlap.
  const midi = candidates.reduce((best, pitch) =>
    Math.abs(pitch - STAFF_CENTRE[clef]) < Math.abs(best - STAFF_CENTRE[clef]) ? pitch : best,
  candidates[0] ?? Math.min(profile.max, Math.max(profile.min, STAFF_CENTRE[clef])));
  return {clef, midi, noteKey: `${NOTE_NAMES[midi % 12]}/${Math.floor(midi / 12) - 1}`};
}
