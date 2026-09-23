import type {ExerciseData, GeneratedNote, MeasureData, PitchRange} from '../music';
import {PITCH_DIFFICULTY} from './pitchDifficulty';
import {assertMeasureRhythm} from './rhythmTiming';
import {buildPitchMaterial, describeTonality} from './scales';
import {midiFromKey} from './notePitches';

export interface ExerciseQuality {penalty: number; repeatedBars: number; repeatedNotes: number; leapRuns: number}

/** A grand monophonic staff is one line, not two melodies separated by rests. */
export function melodicVoice(exercise: ExerciseData): MeasureData[] {
  if(exercise.grandMode!=='mono' || !exercise.lowerMeasures)return exercise.measures;
  return exercise.measures.map((bar,b)=>({...bar,events:bar.events.map((n,i)=>n.rest?exercise.lowerMeasures![b].events[i]:n)}));
}

/** Checks only undesirable excess, not average interval size. An advanced
 * candidate must not win merely because it is the easiest or smoothest one. */
export function reviewExercise(exercise: ExerciseData, range: PitchRange, allowAccidentals: boolean): ExerciseQuality {
  const result:ExerciseQuality={penalty:0,repeatedBars:0,repeatedNotes:0,leapRuns:0};
  const tonal = !allowAccidentals && exercise.tonality?.scaleId!=='atonal';
  const voices=[melodicVoice(exercise),...(exercise.grandMode==='two-hand' && exercise.lowerMeasures?[exercise.lowerMeasures]:[])];
  const available=buildPitchMaterial(exercise.tonality??describeTonality(exercise.keySignature,'major'),range).pitches.length;
  for(const voice of voices) {
    let previousBar='', previous:GeneratedNote|undefined, samePitch=1, leapRun=0;
    for(const bar of voice) {
      const fingerprint=(bar.timeSignature??exercise.timeSignature)+':'+bar.events.map(n=>`${n.rest?'r':n.midi}/${n.durationUnits}`).join(',');
      if(fingerprint===previousBar)result.repeatedBars++;
      previousBar=fingerprint;
      for(const note of bar.events)if(!note.rest) {
        if(previous) {
          const distance=Math.abs(note.midi!-previous.midi!);
          samePitch=distance===0?samePitch+1:1;
          if(samePitch>3 && available>1)result.repeatedNotes++;
          leapRun=distance>={beginner:5,intermediate:7,advanced:12}[exercise.difficulty]?leapRun+1:0;
          // Isolated difficult intervals remain welcome. Four or more consecutive
          // wide leaps are a local overload, not a reason to flatten the whole score.
          if(tonal && leapRun>3)result.leapRuns++;
        }
        previous=note;
      }
    }
  }
  result.penalty=result.repeatedBars*8+result.repeatedNotes*2+result.leapRuns;
  return result;
}

/** Structural faults are never traded off against a musical preference score. */
export function validateGeneratedExercise(exercise: ExerciseData, range: PitchRange, allowAccidentals: boolean) {
  const classes=buildPitchMaterial(exercise.tonality??describeTonality(exercise.keySignature,'major'),range).pitchClasses;
  for(const staff of [exercise.measures,exercise.lowerMeasures??[]])for(const bar of staff) {
    assertMeasureRhythm(bar,bar.timeSignature??exercise.timeSignature);
    for(const note of bar.events)if(!note.rest) {
      if(!Number.isInteger(note.midi) || note.midi!<range.min || note.midi!>range.max)throw new Error('生成音高超出自訂音域。');
      if(midiFromKey(note.key)!==note.midi || Number(note.key.split('/')[1])!==note.octave)throw new Error('記譜音高與播放音高不一致。');
      if(!allowAccidentals && !classes.includes(note.midi!%12))throw new Error('生成音高不屬於目前調式。');
    }
  }
  const voices=[melodicVoice(exercise),...(exercise.grandMode==='two-hand'&&exercise.lowerMeasures?[exercise.lowerMeasures]:[])];
  for(const voice of voices) {
    const notes=voice.flatMap(m=>m.events).filter(n=>!n.rest);
    for(let i=1;i<notes.length;i++)if(Math.abs(notes[i].midi!-notes[i-1].midi!)>PITCH_DIFFICULTY[exercise.difficulty].maxLeap)
      throw new Error('生成音程超出所選視譜難度。');
  }
  if(exercise.lowerMeasures && exercise.lowerMeasures.length!==exercise.measures.length)throw new Error('大譜表上下聲部小節數不同。');
  if(exercise.lowerMeasures)exercise.measures.forEach((bar,i)=>{
    const lower=exercise.lowerMeasures![i];
    if(!lower || lower.timeSignature!==bar.timeSignature || lower.totalUnits!==bar.totalUnits)throw new Error('大譜表上下聲部拍號不同步。');
  });
}
