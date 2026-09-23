import { buildPitchMaterial, describeTonality, type Tonic, type Tonality, type PitchMaterial, type ScalePitch } from './music/scales';
import type { RhythmFocus } from './practice/focus';
import type {PracticeRhythmNote} from './music/practiceRhythm';
import {selectPhraseRhythmPlan, type RhythmBarPlan} from './music/phraseRhythm';
import {PITCH_DIFFICULTY, pitchDistanceWeight} from './music/pitchDifficulty';
import {addRhythmUnits} from './music/rhythmTiming';

// src/music.ts
// 真正的視譜練習音樂生成引擎
// 目前先負責：拍號、節奏、小節、調性、音域、音高生成
// React、譜面顯示與音訊播放共用的音樂資料。

export type Difficulty = "beginner" | "intermediate" | "advanced";

export type RhythmLevel = "simple" | "medium" | "complex";

export type Clef = "treble" | "bass" | "alto" | "tenor";

export type Instrument =
  | "Sheng"
  | "Piano"
  | "Violin"
  | "Flute"
  | "Clarinet"
  | "Trumpet"
  | "Trombone"
  | "Cello";

export type KeySignature =
  | "C"
  | "G"
  | "D"
  | "A"
  | "E"
  | "B"
  | "F#"
  | "F"
  | "Bb"
  | "Eb"
  | "Ab"
  | "Db";

export type TimeSignature =
  | "2/4"
  | "3/4"
  | "4/4"
  | "5/4"
  | "3/8"
  | "6/8"
  | "7/8"
  | "9/8"
  | "12/8";

export type VexDuration =
  | "w"
  | "h"
  | "q"
  | "8"
  | "16";

export interface PitchRange {
  readonly min: number;
  readonly max: number;
}

export interface RhythmPattern {
  tuplet?: 3;
  duration: VexDuration;
  units: number;
  dots: number;
  weight: number;
}

export interface NotePitch {
  key: string;
  octave: number;
  midi: number;
}

export interface GeneratedNote {
  /** Three written eighths occupy one quarter beat; actual units are 4/3 each. */
  tuplet?: 3;
  /** All simultaneous pitches, including the original melody/bass pitch. One rhythmic event. */
  chord?: NotePitch[];
  articulation?: 'staccato' | 'tenuto' | 'accent';
  dynamic?: 'p' | 'mp' | 'mf' | 'f';
  measureRest?: boolean;
  key: string;
  octave: number;

  duration: VexDuration;
  dots: number;

  rest: boolean;

  // 一個四分音符 = 4 units
  // 八分音符 = 2 units
  // 十六分音符 = 1 unit
  startUnits: number;
  durationUnits: number;

  midi?: number;
}

export interface MeasureData {
  timeSignature?: TimeSignature;
  events: GeneratedNote[];

  // 該小節應有的總長度
  totalUnits: number;

  // 主要節拍分組
  // 例如：
  // 4/4 = [4,4,4,4]
  // 6/8 = [6,6]
  // 7/8 = [4,4,6]
  groups: number[];

  // 實際用於 VexFlow beam 的主要節拍群
  beamGroups: number[];
}

// App.tsx 使用的名稱
export type GeneratedMeasure = MeasureData;

export interface ExerciseData {
  /** A single staff with either a fixed clef or automatic treble/bass changes. */
  staffMode?: 'fixed' | 'mixed';
  soundProfile?: string;
  lowerMeasures?: MeasureData[];
  grandMode?: 'mono' | 'two-hand';
  transposition?: number;
  tonality?: Tonality;
  instrument: Instrument;
  clef: Clef;
  difficulty: Difficulty;
  keySignature: KeySignature;
  timeSignature: TimeSignature;
  rhythmLevel: RhythmLevel;
  tempo: number;

  measures: MeasureData[];
}

/* =========================================================
   拍號規則
   ========================================================= */

export interface TimeSignatureInfo {
  numerator: number;
  denominator: number;

  // 整個小節換算成 16 分音符單位
  units: number;

  // 用來之後做 beam / 節拍分組
  groups: number[];

  compound: boolean;
}

export const TIME_SIGNATURES: Record<
  TimeSignature,
  TimeSignatureInfo
> = {
  "2/4": {
    numerator: 2,
    denominator: 4,
    units: 8,
    groups: [4, 4],
    compound: false,
  },

  "3/4": {
    numerator: 3,
    denominator: 4,
    units: 12,
    groups: [4, 4, 4],
    compound: false,
  },

  "4/4": {
    numerator: 4,
    denominator: 4,
    units: 16,
    groups: [4, 4, 4, 4],
    compound: false,
  },

  "5/4": {
    numerator: 5,
    denominator: 4,
    units: 20,

    // 5/4 常見 3+2
    groups: [12, 8],
    compound: false,
  },

  "6/8": {
    numerator: 6,
    denominator: 8,
    units: 12,

    // 6/8 = 3+3
    groups: [6, 6],
    compound: true,
  },

  "3/8": {
    numerator: 3,
    denominator: 8,
    units: 6,
    groups: [6],
    compound: false,
  },

  "7/8": {
    numerator: 7,
    denominator: 8,
    units: 14,

    // 7/8 = 2+2+3
    groups: [4, 4, 6],
    compound: true,
  },

  "9/8": {
    numerator: 9,
    denominator: 8,
    units: 18,

    // 9/8 = 3+3+3
    groups: [6, 6, 6],
    compound: true,
  },

  "12/8": {
    numerator: 12,
    denominator: 8,
    units: 24,

    // 12/8 = 3+3+3+3
    groups: [6, 6, 6, 6],
    compound: true,
  },
};

/* =========================================================
   樂器音域
   MIDI：中央 C = 60
   ========================================================= */

export const INSTRUMENT_RANGES: Readonly<Record<
  Instrument,
  PitchRange
>> = {
  Sheng: {
    min: 48,
    max: 84,
  },

  Piano: {
    min: 36,
    max: 96,
  },

  Violin: {
    min: 55,
    max: 96,
  },

  Flute: {
    min: 60,
    max: 96,
  },

  Clarinet: {
    min: 50,
    max: 88,
  },

  Trumpet: {
    min: 55,
    max: 82,
  },

  Trombone: {
    min: 40,
    max: 72,
  },

  Cello: {
    min: 36,
    max: 81,
  },
};

/* =========================================================
   調號
   每一個調都使用正確的音名拼法
   ========================================================= */

const KEY_SCALES: Record<KeySignature, string[]> = {
  C: ["C", "D", "E", "F", "G", "A", "B"],

  G: ["G", "A", "B", "C", "D", "E", "F#"],

  D: ["D", "E", "F#", "G", "A", "B", "C#"],

  A: ["A", "B", "C#", "D", "E", "F#", "G#"],

  E: ["E", "F#", "G#", "A", "B", "C#", "D#"],

  B: ["B", "C#", "D#", "E", "F#", "G#", "A#"],

  "F#": ["F#", "G#", "A#", "B", "C#", "D#", "E#"],

  F: ["F", "G", "A", "Bb", "C", "D", "E"],

  Bb: ["Bb", "C", "D", "Eb", "F", "G", "A"],

  Eb: ["Eb", "F", "G", "Ab", "Bb", "C", "D"],

  Ab: ["Ab", "Bb", "C", "Db", "Eb", "F", "G"],

  Db: ["Db", "Eb", "F", "Gb", "Ab", "Bb", "C"],
};

const NOTE_TO_PITCH_CLASS: Record<string, number> = {
  C: 0,
  "C#": 1,
  Db: 1,

  D: 2,
  "D#": 3,
  Eb: 3,

  E: 4,
  "E#": 5,
  F: 5,

  "F#": 6,
  Gb: 6,

  G: 7,
  "G#": 8,
  Ab: 8,

  A: 9,
  "A#": 10,
  Bb: 10,

  B: 11,
  Cb: 11,
};

function randomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

/* =========================================================
   節奏規則
   ========================================================= */

function getRhythmPatterns(
  difficulty: Difficulty,
  rhythmLevel: RhythmLevel,
  timeSignature: TimeSignature
): RhythmPattern[] {
  const compound = TIME_SIGNATURES[timeSignature].compound;

  const simple: RhythmPattern[] = [
    {
      duration: "q",
      units: 4,
      dots: 0,
      weight: 6,
    },
    {
      duration: "8",
      units: 2,
      dots: 0,
      weight: 4,
    },
    {
      duration: "16",
      units: 1,
      dots: 0,
      weight: 2,
    },
    {
      duration: "8",
      units: 3,
      dots: 1,
      weight: 1,
    },
  ];

  const compoundPatterns: RhythmPattern[] = [
    {
      duration: "q",
      units: 6,
      dots: 1,
      weight: 6,
    },
    {
      duration: "q",
      units: 4,
      dots: 0,
      weight: 3,
    },
    {
      duration: "8",
      units: 2,
      dots: 0,
      weight: 3,
    },
    {
      duration: "8",
      units: 3,
      dots: 1,
      weight: 2,
    },
    {
      duration: "16",
      units: 1,
      dots: 0,
      weight: 1,
    },
  ];

  let patterns = compound
    ? compoundPatterns
    : simple;

  if (rhythmLevel === "simple") {
    patterns = patterns.filter((p) =>
      compound
        ? p.units === 6
        : p.units === 4 || p.units === 2
    );
  } else if (rhythmLevel === "medium") {
    patterns = patterns.filter((p) =>
      compound
        ? p.units >= 2
        : p.units >= 1
    );
  } else if (difficulty === "beginner") {
    patterns = patterns.filter(
      (p) => p.units >= 2
    );
  }

  return patterns;
}

function shouldBeRest(
  difficulty: Difficulty,
  rhythmLevel: RhythmLevel
): boolean {
  let chance = 0.06;

  if (difficulty === "intermediate") {
    chance = 0.12;
  }

  if (difficulty === "advanced") {
    chance = 0.18;
  }

  if (rhythmLevel === "simple") {
    chance *= 0.5;
  }

  if (rhythmLevel === "complex") {
    chance *= 1.25;
  }

  return Math.random() < chance;
}

function weightedPick(
  patterns: RhythmPattern[]
): RhythmPattern {
  const totalWeight = patterns.reduce(
    (sum, p) => sum + p.weight,
    0
  );

  let random = Math.random() * totalWeight;

  for (const pattern of patterns) {
    random -= pattern.weight;

    if (random <= 0) {
      return pattern;
    }
  }

  return patterns[patterns.length - 1];
}

/*
 * 依照「節拍」填小節，而不是把整個小節當成一個大容器。
 *
 * 這是視譜生成的核心：
 * 音符不能任意跨越主要拍點。
 */
function createBeatComposition(
  beatUnits: number,
  patterns: RhythmPattern[]
): RhythmPattern[] {
  const result: RhythmPattern[] = [];

  let remaining = beatUnits;
  let guard = 0;

  while (remaining > 0 && guard < 100) {
    guard++;

    const candidates = patterns.filter(
      (p) => p.units <= remaining
    );

    if (candidates.length === 0) {
      if (remaining >= 2) {
        result.push({
          duration: "8",
          units: 2,
          dots: 0,
          weight: 1,
        });

        remaining -= 2;
      } else {
        result.push({
          duration: "16",
          units: 1,
          dots: 0,
          weight: 1,
        });

        remaining -= 1;
      }

      continue;
    }

    // 最後剩 1 unit 時必須使用十六分音符。
    if (remaining === 1) {
      result.push({
        duration: "16",
        units: 1,
        dots: 0,
        weight: 1,
      });

      remaining = 0;
      continue;
    }

    const pattern = weightedPick(
      candidates
    );

    result.push(pattern);
    remaining -= pattern.units;
  }

  return result;
}

/* =========================================================
   調性 → MIDI 候選音
   ========================================================= */

function buildScalePitches(
  keySignature: KeySignature,
  minMidi: number,
  maxMidi: number
): Array<{
  midi: number;
  key: string;
  octave: number;
}> {
  const scale = KEY_SCALES[keySignature];

  const result: Array<{
    midi: number;
    key: string;
    octave: number;
  }> = [];

  for (
    let midi = minMidi;
    midi <= maxMidi;
    midi++
  ) {
    const pitchClass =
      ((midi % 12) + 12) % 12;

    const matchingName = scale.find(
      (name) =>
        NOTE_TO_PITCH_CLASS[name] ===
        pitchClass
    );

    if (!matchingName) {
      continue;
    }

    const octave =
      Math.floor(midi / 12) - 1;

    result.push({
      midi,
      key: matchingName,
      octave,
    });
  }

  return result;
}

/* =========================================================
   音高生成
   難度越高，允許的跳進越大
   ========================================================= */

function choosePitch(
  candidates: Array<{
    midi: number;
    key: string;
    octave: number;
  }>,
  previousMidi: number | undefined,
  difficulty: Difficulty
) {
  if (!previousMidi) {
    return randomItem(candidates);
  }

  let maxLeap = 7;

  if (difficulty === "intermediate") {
    maxLeap = 12;
  }

  if (difficulty === "advanced") {
    maxLeap = 24;
  }

  const nearby = candidates.filter(
    (candidate) =>
      Math.abs(
        candidate.midi - previousMidi
      ) <= maxLeap
  );

  if (nearby.length > 0) {
    return randomItem(nearby);
  }

  return randomItem(candidates);
}

/* =========================================================
   生成一個小節
   ========================================================= */

export function generateMeasure(
  difficulty: Difficulty,
  keySignature: KeySignature,
  timeSignature: TimeSignature,
  rhythmLevel: RhythmLevel,
  instrument: Instrument,
  previousMidi?: number,
  pitchRange?: PitchRange,
  allowAccidentals = false,
  pitchMaterial?: PitchMaterial,
  practiceRhythm?: readonly PracticeRhythmNote[],
  spellingSignature: string | null = keySignature,
): {
  measure: MeasureData;
  lastMidi: number;
} {
  const timeInfo =
    TIME_SIGNATURES[timeSignature];

  const patterns = getRhythmPatterns(
    difficulty,
    rhythmLevel,
    timeSignature
  );

  const range =
    pitchRange ?? INSTRUMENT_RANGES[instrument];

  if (!Number.isInteger(range.min) || !Number.isInteger(range.max) ||
      range.min < 0 || range.max > 127 || range.min >= range.max) {
    throw new Error("最低音必須低於最高音，且音域必須是有效的 MIDI 整數。");
  }

  const candidates = pitchMaterial?.pitches ?? buildScalePitches(
    keySignature,
    range.min,
    range.max
  );

  const scaleClasses = new Set(pitchMaterial?.pitchClasses ?? KEY_SCALES[keySignature].map(name => NOTE_TO_PITCH_CLASS[name]));
  const chromaticCandidates = allowAccidentals
    ? Array.from({ length: range.max - range.min + 1 }, (_, i) => range.min + i)
      .filter(midi => !scaleClasses.has(midi % 12))
      .map(midi => ({ midi, key: '', octave: Math.floor(midi / 12) - 1 }))
    : [];

  const events: GeneratedNote[] = [];

  if (candidates.length === 0) {
    throw new Error("這個音域內沒有符合調性的音符，請擴大音域。");
  }

  let startUnits = 0;

  let lastMidi =
    previousMidi ??
    randomItem(candidates).midi;

  // 主要拍點：
  // 簡單拍每拍 4 units；
  // 複合拍每個大拍 6 units。
  const beatStructure =
    timeInfo.compound
      ? timeInfo.groups
      : timeSignature === "5/4"
        ? [4, 4, 4, 4, 4]
        : timeInfo.groups;

  for (
    const beatUnits of beatStructure
  ) {
    const composition = practiceRhythm
      ? practiceRhythm.filter(note => note.startUnits >= startUnits && note.startUnits < startUnits + beatUnits)
      : createBeatComposition(
        beatUnits,
        patterns
      );

    for (const pattern of composition) {
      const rest = 'rest' in pattern ? pattern.rest : shouldBeRest(difficulty, rhythmLevel);

      if (rest) {
        events.push({
          key: "b/4",
          octave: 4,
          duration: pattern.duration,
          dots: pattern.dots,
          rest: true,
          startUnits,
          durationUnits: pattern.units,
          ...(pattern.tuplet ? {tuplet: pattern.tuplet} : {}),
        });
      } else {
        const opening = previousMidi === undefined && events.every(event => event.rest);
        const chromaticChance = practiceRhythm ? PITCH_DIFFICULTY[difficulty].chromaticChance : .18;
        const useChromatic = allowAccidentals && !(pitchMaterial && opening) && chromaticCandidates.length > 0 && Math.random() < chromaticChance;
        const pool = useChromatic ? chromaticCandidates : candidates;
        const pitch = pitchMaterial || practiceRhythm
          ? chooseScalePitch(pool, lastMidi, difficulty, useChromatic ? null : pitchMaterial?.tonicPC ?? null, opening)
          : choosePitch(pool, lastMidi, difficulty);
        if (useChromatic) {
          const sharps = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
          const flats = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
          const preferFlats = spellingSignature === null || spellingSignature === 'C'
            ? pitch.midi < lastMidi : spellingSignature === 'F' || spellingSignature.includes('b');
          pitch.key = (preferFlats ? flats : sharps)[pitch.midi % 12];
        }

        lastMidi = pitch.midi;

        events.push({
          key: `${pitch.key.toLowerCase()}/${pitch.octave}`,
          octave: pitch.octave,
          duration: pattern.duration,
          dots: pattern.dots,
          rest: false,
          startUnits,
          durationUnits: pattern.units,
          ...(pattern.tuplet ? {tuplet: pattern.tuplet} : {}),
          midi: pitch.midi,
        });
      }

      startUnits = addRhythmUnits(startUnits, pattern.units);
    }
  }

  return {
    measure: {
      events,
      totalUnits: timeInfo.units,
      groups: timeInfo.groups,
      beamGroups: timeInfo.groups,
    },
    lastMidi,
  };
}

/* =========================================================
   生成完整練習
   ========================================================= */

export function generateExercise(
  instrument: Instrument,
  clef: Clef,
  difficulty: Difficulty,
  keySignature: KeySignature,
  timeSignature: TimeSignature,
  rhythmLevel: RhythmLevel,
  measures: number,
  tempo: number,
  pitchRange?: PitchRange
): ExerciseData {
  const generatedMeasures: MeasureData[] = [];

  let previousMidi: number | undefined;

  for (
    let i = 0;
    i < measures;
    i++
  ) {
    const result = generateMeasure(
      difficulty,
      keySignature,
      timeSignature,
      rhythmLevel,
      instrument,
      previousMidi,
      pitchRange
    );

    generatedMeasures.push(
      result.measure
    );

    previousMidi =
      result.lastMidi;
  }

  return {
    instrument,
    clef,
    difficulty,
    keySignature,
    timeSignature,
    rhythmLevel,
    tempo,
    measures: generatedMeasures,
  };
}

/* =========================================================
   給 App / VexFlow 使用的工具
   ========================================================= */

export function getVexFlowDuration(
  note: GeneratedNote
): string {
  // VexFlow 的休止符 duration 要加 r，例如 qr / 8r。
  const base = note.duration;

  return note.rest
    ? `${base}r`
    : base;
}

export function getTimeSignatureInfo(
  timeSignature: TimeSignature
): TimeSignatureInfo {
  return TIME_SIGNATURES[
    timeSignature
  ];
}

export function getKeyScale(
  keySignature: KeySignature
): string[] {
  return KEY_SCALES[
    keySignature
  ];
}

export interface PracticeOptions {
  rhythmFocus?: RhythmFocus;
  tonic?: Tonic;
  scaleId?: string;
  instrument: Instrument;
  clef: Clef;
  difficulty: Difficulty;
  keySignature: KeySignature;
  timeSignature: TimeSignature;
  rhythmLevel: RhythmLevel;
  measures: number;
  tempo: number;
  range: PitchRange;
  allowAccidentals: boolean;
  mixedMeters: boolean;
  meters: TimeSignature[];
}

/** Meter changes occur at complete two-bar phrase boundaries. */
export function createPracticeRhythmPlan(options: PracticeOptions): RhythmBarPlan[] {
  const {timeSignature, mixedMeters, measures} = options;
  const meters = [...new Set(options.meters)];
  if (mixedMeters && (meters.length < 2 || meters.some(meter => !TIME_SIGNATURES[meter]))) {
    throw new Error('混合拍號請至少選擇兩種拍號。');
  }
  if (!Number.isInteger(measures) || measures < 1 || measures > 32) throw new Error('請選擇有效的小節數。');
  let meter = mixedMeters ? (meters.includes(timeSignature) ? timeSignature : meters[0]) : timeSignature;
  const sequence = Array.from({length:measures},(_,index)=> {
    if (mixedMeters && index > 0 && index % 2 === 0) meter = randomItem(meters.filter(value => value !== meter));
    return meter;
  });
  return selectPhraseRhythmPlan(sequence,options.rhythmLevel,options.rhythmFocus);
}

/** The optional internal plan lets candidate pitches share exactly the same rhythm. */
export function generatePracticeExercise(options: PracticeOptions, rhythmPlan = createPracticeRhythmPlan(options)): ExerciseData {
  const { instrument, clef, difficulty, keySignature, rhythmLevel,
    tempo, range, allowAccidentals } = options;
  const tonality = options.scaleId ? describeTonality(options.tonic ?? keySignature, options.scaleId) : undefined;
  const material = tonality ? buildPitchMaterial(tonality, range) : undefined;
  const generated: MeasureData[] = [];
  // Complete the rhythmic skeleton first: changing pitch difficulty or enabling
  // chromatic notes must not alter the selected rhythm/meter distribution.
  let previousMidi: number | undefined;
  for (const {meter, notes} of rhythmPlan) {
    const result = generateMeasure(difficulty, keySignature, meter, rhythmLevel, instrument, previousMidi, range, allowAccidentals && tonality?.scaleId !== 'atonal', material, notes, tonality ? tonality.signature : keySignature);
    result.measure.timeSignature = meter;
    generated.push(result.measure);
    previousMidi = material && result.measure.events.every(note => note.rest) ? previousMidi : result.lastMidi;
  }
  if (material?.tonicPC !== null && material?.tonicPC !== undefined) {
    const sounding = generated.flatMap(measure => measure.events).filter(note => !note.rest);
    const last = sounding.at(-1);
    const previous = sounding.at(-2)?.midi;
    const maxLeap = PITCH_DIFFICULTY[difficulty].maxLeap;
    const roots = material.pitches.filter(pitch => pitch.midi % 12 === material.tonicPC &&
      (previous === undefined || Math.abs(pitch.midi - previous) <= maxLeap));
    if (last && roots.length) {
      const root = roots.sort((a,b) => Math.abs(a.midi-last.midi!) - Math.abs(b.midi-last.midi!))[0];
      last.midi = root.midi; last.key = root.key.toLowerCase()+'/'+root.octave; last.octave = root.octave;
    }
  }
  return { instrument, clef, difficulty, keySignature, timeSignature: generated[0].timeSignature!, rhythmLevel, tempo, measures: generated, ...(tonality ? {tonality} : {}) };
}

function chooseScalePitch(candidates: ScalePitch[], previous: number, difficulty: Difficulty, tonic: number | null, opening: boolean): ScalePitch {
  const maxLeap=PITCH_DIFFICULTY[difficulty].maxLeap;
  let pool=candidates.filter(pitch=>Math.abs(pitch.midi-previous)<=maxLeap);
  if(!pool.length) pool=candidates;
  if(opening && tonic!==null) {
    const roots=candidates.filter(pitch=>pitch.midi%12===tonic);
    if(roots.length) return randomItem(roots);
  }
  const weights=pool.map(pitch=>{
    const distance=Math.abs(pitch.midi-previous);
    return pitchDistanceWeight(distance,difficulty)*(tonic!==null&&pitch.midi%12===tonic?1.3:1);
  });
  let draw=Math.random()*weights.reduce((sum,w)=>sum+w,0);
  for(let i=0;i<pool.length;i++) { draw-=weights[i]; if(draw<=0) return pool[i]; }
  return pool[pool.length-1];
}
