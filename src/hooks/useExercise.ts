import {composeExercise} from '../music/composeExercise';
import {addPerformanceMarks} from '../music/performanceMarks';
import {refreshSlurPhrasing} from '../music/refreshSlurPhrasing';
import {addInstrumentHarmony} from '../music/instrumentHarmony';
import {addPipaTechniques} from '../music/pipaTechniques';
import { selectPracticeTempo } from '../practice/tempo';
import {validBpm} from '../audio/tempo';
import {refineFastPassages} from '../music/tempoFlow';
import {validateGeneratedExercise} from '../music/exerciseQuality';
import {readRecentExercises, rememberRecentExercise, scoreRecentSimilarity} from '../practice/recentVariety';
import type { RhythmFocusSelection, PitchFocus } from '../practice/focus';
import {describeTonality, type Tonic} from '../music/scales';
import { selectRandomTonality, type RandomTonality } from '../music/randomTonality';
import {normalizeKeySignatureChoices, type KeySignatureChoice} from '../music/keySignatureChoices';
import {loadPreferredInstrument, rememberInstrument} from '../practice/instrumentPreference';
import { useState } from 'react';
import {type ExerciseData, type KeySignature, type TimeSignature } from '../music';
import { INSTRUMENTS, mapDifficulty, mapRhythmLevel, type Instrument, type Clef, type Difficulty, type RhythmLevel } from '../exerciseConfig';

export interface ExerciseSettings {
  pitchFocus?: PitchFocus;
  performanceMarks?: boolean;
  rhythmFocus?: RhythmFocusSelection;
  instrument: Instrument;
  clef: Clef;
  difficulty: Difficulty;
  keySignature: KeySignature;
  allowedKeySignatures?: KeySignatureChoice[];
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
  instrument: 'Piano', clef: INSTRUMENTS.Piano.clef, difficulty: 'Beginner', keySignature: 'C', tonic: 'C', scaleId: 'major',
  timeSignature: '4/4', rhythmLevel: 'Simple', measureCount: 8,
  rangeMinMidi: INSTRUMENTS.Piano.min, rangeMaxMidi: INSTRUMENTS.Piano.max, allowAccidentals: false,
  mixedMeters: false, meters: ['3/4', '4/4', '6/8'],
};
interface CurrentExercise { exercise: ExerciseData; settings: ExerciseSettings; number: number; isPreview?: boolean }

export function useExercise(previewTonality?: RandomTonality) {
  const [savedSettings, setSettings] = useState<ExerciseSettings>(() => {
    const instrument = loadPreferredInstrument();
    const profile = INSTRUMENTS[instrument];
    return {...DEFAULT_SETTINGS, instrument, clef: profile.clef, rangeMinMidi: profile.min, rangeMaxMidi: profile.max};
  });
  const settings = { ...DEFAULT_SETTINGS, ...savedSettings };
  const [current, setCurrent] = useState<CurrentExercise | null>(null);
  const [error, setError] = useState('');
  const [previewConsumed, setPreviewConsumed] = useState(false);
  const [recentExercises,setRecentExercises]=useState(()=>readRecentExercises());
  const pendingPreview = previewConsumed ? undefined : previewTonality;

  function change<K extends keyof ExerciseSettings>(key: K, value: ExerciseSettings[K]) {
    if (key === 'instrument') rememberInstrument(value as Instrument);
    if(key === 'allowedKeySignatures')setPreviewConsumed(true);
    setSettings((previous) => ({ ...previous, [key]: value,
      ...(['timeSignature','mixedMeters','meters'].includes(key) ? {rhythmFocus:'balanced' as const} : {}),
      ...(key === 'instrument' ? {
        clef: INSTRUMENTS[value as Instrument].clef,
        rangeMinMidi: INSTRUMENTS[value as Instrument].min,
        rangeMaxMidi: INSTRUMENTS[value as Instrument].max,
      } : {}),
    }));
    setError('');
  }

  function generateNew(bpm: number, overrides: Partial<ExerciseSettings> = {}, tempoOverride?:number) {
    const nextSettings = { ...settings, ...overrides };
    return generateFrom(nextSettings, bpm,tempoOverride);
  }

  function generateFrom(settings: ExerciseSettings, bpm: number,tempoOverride?:number) {
    try {
      settings = {...settings,allowedKeySignatures:normalizeKeySignatureChoices(settings.allowedKeySignatures)};
      const measureCount=window.matchMedia('(max-width: 600px)').matches?Math.min(settings.measureCount,8):settings.measureCount;
      const twoHand = settings.clef === 'grand' && (settings.instrument === 'Piano' || settings.instrument === 'Yangqin');
      const range = {min: settings.rangeMinMidi, max: settings.rangeMaxMidi};
      const tonality = pendingPreview ?? selectRandomTonality(twoHand && range.min <= 58 && range.max >= 61
        ? [range, {min: range.min, max: 59}, {min: 60, max: range.max}]
        : [range], Math.random, {allowAccidentals:settings.allowAccidentals, difficulty:mapDifficulty(settings.difficulty),allowedKeySignatures:settings.allowedKeySignatures});
      const signature = describeTonality(tonality.tonic,tonality.scaleId).signature as KeySignature | null;
      const options = {
        instrument: INSTRUMENTS[settings.instrument].engineInstrument,
        instrumentProfile: settings.instrument,
        clef: settings.clef === 'grand' || settings.clef === 'mixedStaff' ? 'treble' : settings.clef, difficulty: mapDifficulty(settings.difficulty),
        keySignature: signature ?? 'C', timeSignature: settings.timeSignature,
        rhythmLevel: mapRhythmLevel(settings.rhythmLevel), rhythmFocus: settings.rhythmFocus, pitchFocus:settings.pitchFocus, measures: measureCount,
        tempo: bpm, range,
        allowAccidentals: pendingPreview ? false : settings.allowAccidentals, mixedMeters: settings.mixedMeters,
        meters: settings.meters, ...tonality,
      } satisfies Parameters<typeof composeExercise>[0];
      const createStudy=()=>{
        let candidate=composeExercise(options,settings.clef==='grand'?(twoHand?'two-hand':'mono'):undefined);
        candidate.soundProfile=settings.instrument;
        candidate.staffMode=settings.clef==='mixedStaff'?'mixed':'fixed';
        candidate.transposition=INSTRUMENTS[settings.instrument].transpose;
        candidate.tempo=validBpm(tempoOverride)?tempoOverride:selectPracticeTempo(candidate,bpm);
        if(settings.pitchFocus!=='scales'&&settings.pitchFocus!=='leaps')
          candidate=refineFastPassages(candidate,range,settings.instrument,options.allowAccidentals);
        validateGeneratedExercise(candidate,range,options.allowAccidentals);
        if(settings.pitchFocus!=='scales')candidate=addInstrumentHarmony(candidate,range);
        if(settings.performanceMarks??true) {
          candidate=addPerformanceMarks(candidate);
          if(settings.pitchFocus!=='scales')candidate=addPipaTechniques(candidate,range);
        }
        return candidate;
      };
      let exercise=createStudy();
      if(!pendingPreview) {
        let similarity=scoreRecentSimilarity(exercise,recentExercises,settings);
        // Keep the current composer and musical constraints. Only audition extra
        // complete studies when the first is too close to recently accepted ones.
        for(let retry=0;retry<2&&similarity>.68;retry++) {
          try {
            const candidate=createStudy(),score=scoreRecentSimilarity(candidate,recentExercises,settings);
            if(score<similarity){exercise=candidate;similarity=score;}
          }catch{/* A valid first candidate remains available if a retry cannot fit. */}
        }
        setRecentExercises(rememberRecentExercise(exercise,settings,recentExercises));
      }
      setSettings(settings);
      rememberInstrument(settings.instrument);
      setCurrent((previous) => ({ exercise, settings: { ...settings, ...tonality, keySignature:signature ?? 'C', allowAccidentals: pendingPreview ? false : settings.allowAccidentals, measureCount, meters: [...settings.meters] }, number: (previous?.number ?? 0) + 1, isPreview: !!pendingPreview }));
      setPreviewConsumed(true);
      setError('');
      return exercise.tempo;
    } catch (error) {
      setError(error instanceof Error ? error.message : '無法產生題目，請調整設定後重試。');
      return false;
    }
  }
  function restore(exercise: ExerciseData, settings: ExerciseSettings) {
    exercise=refreshSlurPhrasing(exercise,settings.performanceMarks??true);
    setPreviewConsumed(true);
    setSettings(settings);
    rememberInstrument(settings.instrument);
    setCurrent(previous => ({exercise, settings, number: (previous?.number ?? 0) + 1}));
    setError('');
  }
  return { settings, current, error, change, generateNew, generateFrom, restore, previewPending: !!pendingPreview };
}
