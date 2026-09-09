import { generateGrandExercise } from '../music/grandStaff';
import type { Tonic } from '../music/scales';
import { useState } from 'react';
import { generatePracticeExercise, type PracticeOptions, type ExerciseData, type KeySignature, type TimeSignature } from '../music';
import { INSTRUMENTS, mapDifficulty, mapRhythmLevel, type Instrument, type Clef, type Difficulty, type RhythmLevel } from '../exerciseConfig';

export interface ExerciseSettings {
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
  instrument: 'Sheng', clef: 'treble', difficulty: 'Beginner', keySignature: 'C', tonic: 'C', scaleId: 'major',
  timeSignature: '4/4', rhythmLevel: 'Simple', measureCount: 8,
  rangeMinMidi: INSTRUMENTS.Sheng.min, rangeMaxMidi: INSTRUMENTS.Sheng.max, allowAccidentals: false,
  mixedMeters: false, meters: ['3/4', '4/4', '6/8'],
};
interface CurrentExercise { exercise: ExerciseData; settings: ExerciseSettings; number: number }

export function useExercise() {
  const [savedSettings, setSettings] = useState<ExerciseSettings>(DEFAULT_SETTINGS);
  const settings = { ...DEFAULT_SETTINGS, ...savedSettings };
  const [current, setCurrent] = useState<CurrentExercise | null>(null);
  const [error, setError] = useState('');

  function change<K extends keyof ExerciseSettings>(key: K, value: ExerciseSettings[K]) {
    setSettings((previous) => ({ ...previous, [key]: value,
      ...(key === 'instrument' ? {
        clef: INSTRUMENTS[value as Instrument].clef,
        rangeMinMidi: INSTRUMENTS[value as Instrument].min,
        rangeMaxMidi: INSTRUMENTS[value as Instrument].max,
        ...('tonic' in INSTRUMENTS[value as Instrument] ? {tonic:'D',scaleId:'major-pentatonic',allowAccidentals:false} : {}),
      } : {}),
    }));
    setError('');
  }

  function generateNew(bpm: number) {
    try {
      const measureCount=window.matchMedia('(max-width: 600px)').matches?Math.min(settings.measureCount,8):settings.measureCount;
      const generator = settings.clef === 'grand' ? (options:PracticeOptions)=>generateGrandExercise(options,settings.instrument==='Piano'||settings.instrument==='Yangqin'?'two-hand':'mono') : generatePracticeExercise;
      const exercise = generator({
        instrument: INSTRUMENTS[settings.instrument].engineInstrument,
        clef: settings.clef === 'grand' ? 'treble' : settings.clef, difficulty: mapDifficulty(settings.difficulty),
        keySignature: settings.keySignature, timeSignature: settings.timeSignature,
        rhythmLevel: mapRhythmLevel(settings.rhythmLevel), measures: measureCount,
        tempo: bpm, range: { min: settings.rangeMinMidi, max: settings.rangeMaxMidi },
        allowAccidentals: settings.allowAccidentals, mixedMeters: settings.mixedMeters,
        meters: settings.meters, tonic: settings.tonic, scaleId: settings.scaleId,
      });
      exercise.soundProfile = settings.instrument;
      exercise.transposition = INSTRUMENTS[settings.instrument].transpose;
      setCurrent((previous) => ({ exercise, settings: { ...settings, measureCount, meters: [...settings.meters] }, number: (previous?.number ?? 0) + 1 }));
      setError('');
      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : '無法產生題目，請調整設定後重試。');
      return false;
    }
  }
  return { settings, current, error, change, generateNew };
}
