import type { Difficulty as EngineDifficulty, RhythmLevel as EngineRhythmLevel } from "./music";

export type Difficulty =
  | "Beginner"
  | "Intermediate"
  | "Advanced";

export { INSTRUMENTS } from './music/instruments';
export type { Instrument } from './music/instruments';
export type Clef = import('./music/instruments').StaffChoice;
export type RhythmLevel = 'Simple' | 'Moderate' | 'Complex';
export const CLEFS: Clef[] = ['treble','alto','tenor','bass','mixedStaff','grand'];

export const KEY_SIGNATURES = [
  "C",
  "G",
  "D",
  "A",
  "E",
  "B",
  "F#",
  "F",
  "Bb",
  "Eb",
  "Ab",
  "Db",
] as const;

export const TIME_SIGNATURES = [
  "2/4",
  "3/4",
  "4/4",
  "5/4",
  "3/8",
  "6/8",
  "7/8",
  "9/8",
  "12/8",
] as const;

/* =========================================================
 * Custom Range
 *
 * MIDI:
 * C1 = 24
 * C4 = 60
 * C8 = 108
 * ======================================================= */

export const RANGE_MIN_MIDI = 21;
export const RANGE_MAX_MIDI = 108;

export const RANGE_OPTIONS = Array.from(
  {
    length:
      RANGE_MAX_MIDI -
      RANGE_MIN_MIDI +
      1,
  },
  (_, index) =>
    RANGE_MIN_MIDI + index
);

export const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

export function midiToNoteLabel(
  midi: number
): string {
  const pitchClass =
    ((midi % 12) + 12) % 12;

  const octave =
    Math.floor(midi / 12) - 1;

  return `${NOTE_NAMES[pitchClass]}${octave}`;
}

/* =========================================================
 * UI → Engine
 * ======================================================= */

export function mapDifficulty(
  value: Difficulty
): EngineDifficulty {
  if (value === "Beginner") {
    return "beginner";
  }

  if (value === "Intermediate") {
    return "intermediate";
  }

  return "advanced";
}

export function mapRhythmLevel(
  value: RhythmLevel
): EngineRhythmLevel {
  if (value === "Simple") {
    return "simple";
  }

  if (value === "Moderate") {
    return "medium";
  }

  return "complex";
}
