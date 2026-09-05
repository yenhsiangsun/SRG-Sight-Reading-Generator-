// src/music.ts
// 真正的視譜練習音樂生成引擎
// 目前先負責：拍號、節奏、小節、調性、音域、音高生成
// App.tsx 下一步再接上這個引擎。

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

export interface RhythmPattern {
  duration: VexDuration;
  units: number;
  dots: number;
  weight: number;
}

export interface GeneratedNote {
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

export const INSTRUMENT_RANGES: Record<
  Instrument,
  { min: number; max: number }
> = {
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
  previousMidi?: number
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
    INSTRUMENT_RANGES[instrument];

  const candidates = buildScalePitches(
    keySignature,
    range.min,
    range.max
  );

  const events: GeneratedNote[] = [];

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
    const composition =
      createBeatComposition(
        beatUnits,
        patterns
      );

    for (const pattern of composition) {
      const rest = shouldBeRest(
        difficulty,
        rhythmLevel
      );

      if (rest) {
        events.push({
          key: "b/4",
          octave: 4,
          duration: pattern.duration,
          dots: pattern.dots,
          rest: true,
          startUnits,
          durationUnits: pattern.units,
        });
      } else {
        const pitch = choosePitch(
          candidates,
          lastMidi,
          difficulty
        );

        lastMidi = pitch.midi;

        events.push({
          key: `${pitch.key.toLowerCase()}/${pitch.octave}`,
          octave: pitch.octave,
          duration: pattern.duration,
          dots: pattern.dots,
          rest: false,
          startUnits,
          durationUnits: pattern.units,
          midi: pitch.midi,
        });
      }

      startUnits += pattern.units;
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
  tempo: number
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
      previousMidi
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