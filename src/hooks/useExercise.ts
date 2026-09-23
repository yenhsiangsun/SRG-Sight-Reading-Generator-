import {composeExercise} from '../music/composeExercise';
import {addPerformanceMarks} from '../music/performanceMarks';
import {addInstrumentHarmony} from '../music/instrumentHarmony';
import { selectPracticeTempo } from '../practice/tempo';
import type { RhythmFocus } from '../practice/focus';
import type { Tonic } from '../music/scales';
import { selectRandomTonality, type RandomTonality } from '../music/randomTonality';
import { useState } from 'react';
import {type ExerciseData, type KeySignature, type TimeSignature } from '../music';
import { INSTRUMENTS, mapDifficulty, mapRhythmLevel, type Instrument, type Clef, type Difficulty, type RhythmLevel } from '../exerciseConfig';

export interface ExerciseSettings {
  performanceMarks?: boolean;
  rhythmFocus?: RhythmFocus;
  instrument: Instrument;
  clef: Clef;
  difficulty: Difficulty;
  keySignature: KeySignature;
  tonic: Tonic;
  scaleId: string;
  timeSignature: TimeSignature;
  rhythmLevel: RhythmLevel;
  measureCount: number;
  rangeMinMidi: number;
  rangeMaxMidi: number;
  allowAccidentals: boolean;
  mixedMeters: boolean;
  meters: TimeSignature[];
}
export const DEFAULT_SETTINGS: ExerciseSettings = {
  performanceMarks:true,
  instrument: 'Sheng', clef: 'treble', difficulty: 'Beginner', keySignature: 'C', tonic: 'C', scaleId: 'major',
  timeSignature: '4/4', rhythmLevel: 'Simple', measureCount: 8,
  rangeMinMidi: INSTRUMENTS.Sheng.min, rangeMaxMidi: INSTRUMENTS.Sheng.max, allowAccidentals: false,
  mixedMeters: false, meters: ['3/4', '4/4', '6/8'],
};
interface CurrentExercise { exercise: ExerciseData; settings: ExerciseSettings; number: number; isPreview?: boolean }

export function useExercise(previewTonality?: RandomTonality) {
  const [savedSettings, setSettings] = useState<ExerciseSettings>(DEFAULT_SETTINGS);
  const settings = { ...DEFAULT_SETTINGS, ...savedSettings };
  const [current, setCurrent] = useState<CurrentExercise | null>(null);
  const [error, setError] = useState('');
  const [previewConsumed, setPreviewConsumed] = useState(false);
  const pendingPreview = previewConsumed ? undefined : previewTonality;

  function change<K extends keyof ExerciseSettings>(key: K, value: ExerciseSettings[K]) {
    setSettings((previous) => ({ ...previous, [key]: value,
      ...(key === 'rhythmLevel' ? {rhythmFocus:'balanced' as const} : {}),
      ...(key === 'instrument' ? {
        clef: INSTRUMENTS[value as Instrument].clef,
        rangeMinMidi: INSTRUMENTS[value as Instrument].min,
        rangeMaxMidi: INSTRUMENTS[value as Instrument].max,
      } : {}),
    }));
    setError('');
  }

  function generateNew(bpm: number, overrides: Partial<ExerciseSettings> = {}) {
    const nextSettings = { ...settings, ...overrides };
    return generateFrom(nextSettings, bpm);
  }

  function generateFrom(settings: ExerciseSettings, bpm: number) {
    try {
      const measureCount=window.matchMedia('(max-width: 600px)').matches?Math.min(settings.measureCount,8):settings.measureCount;
      const twoHand = settings.clef === 'grand' && (settings.instrument === 'Piano' || settings.instrument === 'Yangqin');
      const range = {min: settings.rangeMinMidi, max: settings.rangeMaxMidi};
      const tonality = pendingPreview ?? selectRandomTonality(twoHand && range.min <= 58 && range.max >= 61
        ? [range, {min: range.min, max: 59}, {min: 60, max: range.max}]
        : [range], Math.random, {allowAccidentals:settings.allowAccidentals, difficulty:mapDifficulty(settings.difficulty)});
      let exercise = composeExercise({
        instrument: INSTRUMENTS[settings.instrument].engineInstrument,
        clef: settings.clef === 'grand' || settings.clef === 'mixedStaff' ? 'treble' : settings.clef, difficulty: mapDifficulty(settings.difficulty),
        keySignature: settings.keySignature, timeSignature: settings.timeSignature,
        rhythmLevel: mapRhythmLevel(settings.rhythmLevel), rhythmFocus: settings.rhythmFocus, measures: measureCount,
        tempo: bpm, range,
        allowAccidentals: pendingPreview ? false : settings.allowAccidentals, mixedMeters: settings.mixedMeters,
        meters: settings.meters, ...tonality,
      },settings.clef==='grand'?(twoHand?'two-hand':'mono'):undefined);
      exercise.soundProfile = settings.instrument;
      exercise.staffMode = settings.clef === 'mixedStaff' ? 'mixed' : 'fixed';
      exercise.transposition = INSTRUMENTS[settings.instrument].transpose;
      exercise = addInstrumentHarmony(exercise, range);
      exercise.tempo = selectPracticeTempo(exercise, bpm);
      if(settings.performanceMarks ?? true) exercise=addPerformanceMarks(exercise);
      setSettings(settings);
      setCurrent((previous) => ({ exercise, settings: { ...settings, ...tonality, allowAccidentals: pendingPreview ? false : settings.allowAccidentals, measureCount, meters: [...settings.meters] }, number: (previous?.number ?? 0) + 1, isPreview: !!pendingPreview }));
      setPreviewConsumed(true);
      setError('');
      return exercise.tempo;
    } catch (error) {
      setError(error instanceof Error ? error.message : '無法產生題目，請調整設定後重試。');
      return false;
    }
  }
  function restore(exercise: ExerciseData, settings: ExerciseSettings) {
    setPreviewConsumed(true);
    setSettings(settings);
    setCurrent(previous => ({exercise, settings, number: (previous?.number ?? 0) + 1}));
    setError('');
  }
  return { settings, current, error, change, generateNew, generateFrom, restore, previewPending: !!pendingPreview };
}
