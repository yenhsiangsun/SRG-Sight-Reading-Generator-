import type {ExerciseData} from '../music';
import type {ExerciseSettings} from '../hooks/useExercise';
import type {AssessmentResult} from '../assessment/scoring';
import {openingMeter,beatUnits,validBpm} from '../audio/tempo';
import {practiceTempoRange} from './tempo';
import {rhythmFocuses} from './focus';

export const TRAINING_KEY='sight-reading-training-v1';
export interface TrainingAttempt {
  id:string;at:number;instrument:string;difficulty:ExerciseSettings['difficulty'];rhythmLevel:ExerciseSettings['rhythmLevel'];
  quarterBpm:number;pitch:number;rhythm:number;completion:number;context:string;
}
export interface TrainingAdvice {axis:'pitch'|'rhythm'|'tempo';direction:'up'|'down';settings:Partial<ExerciseSettings>;tempo?:number}
export const trainingContext=(settings:ExerciseSettings)=>{
  const focuses=rhythmFocuses(settings.rhythmFocus);
  return JSON.stringify([settings.clef,settings.performanceMarks??true,settings.rangeMinMidi,settings.rangeMaxMidi,settings.allowAccidentals,
    focuses.length===1?focuses[0]:focuses,settings.pitchFocus??'balanced',settings.timeSignature,settings.mixedMeters,settings.meters]);
};
export function readTraining(raw:string|null):TrainingAttempt[] {
  try{
    const data=JSON.parse(raw??'[]');if(!Array.isArray(data))return [];
    return data.filter(a=>a&&typeof a.id==='string'&&typeof a.instrument==='string'&&typeof a.context==='string'&&Number.isFinite(a.at)&&
      ['Beginner','Intermediate','Advanced'].includes(a.difficulty)&&['Simple','Moderate','Complex'].includes(a.rhythmLevel)&&
      Number.isFinite(a.quarterBpm)&&a.quarterBpm>=20&&a.quarterBpm<=400&&
      [a.pitch,a.rhythm,a.completion].every(n=>Number.isFinite(n)&&n>=0&&n<=100)).slice(-100);
  }catch{return [];}
}
export function recordTraining(history:TrainingAttempt[],id:string,exercise:ExerciseData,settings:ExerciseSettings,bpm:number,result:AssessmentResult,at=Date.now()) {
  if(!result.reliable||result.confidence<88||result.completion<70||result.clipped||!validBpm(bpm)||history.some(a=>a.id===id))return history;
  return [...history,{id,at,instrument:settings.instrument,difficulty:settings.difficulty,rhythmLevel:settings.rhythmLevel,
    quarterBpm:bpm*beatUnits(openingMeter(exercise))/4,pitch:result.pitch,rhythm:result.rhythm,completion:result.completion,context:trainingContext(settings)}].slice(-100);
}
/** Three comparable, distinct attempts. No promotion from one lucky result,
 * from low-quality capture, or from an easier setting on another instrument. */
export function recommendTraining(history:TrainingAttempt[],exercise:ExerciseData,settings:ExerciseSettings,bpm:number):TrainingAdvice|null {
  const quarter=bpm*beatUnits(openingMeter(exercise))/4;
  const attempts=history.filter(a=>a.instrument===settings.instrument&&a.difficulty===settings.difficulty&&a.rhythmLevel===settings.rhythmLevel&&
    a.context===trainingContext(settings)&&Math.abs(a.quarterBpm-quarter)<=Math.max(8,quarter*.15)).slice(-3);
  if(attempts.length<3)return null;
  const pitch=attempts.reduce((s,a)=>s+a.pitch,0)/3,rhythm=attempts.reduce((s,a)=>s+a.rhythm,0)/3;
  const pitchLevels=['Beginner','Intermediate','Advanced'] as const,rhythmLevels=['Simple','Moderate','Complex'] as const;
  const p=pitchLevels.indexOf(settings.difficulty),r=rhythmLevels.indexOf(settings.rhythmLevel);
  const strong=attempts.every(a=>a.pitch>=90&&a.rhythm>=90&&a.completion>=95);
  if(strong){
    if(p<2&&(p<=r||r===2))return {axis:'pitch',direction:'up',settings:{difficulty:pitchLevels[p+1]}};
    if(r<2)return {axis:'rhythm',direction:'up',settings:{rhythmLevel:rhythmLevels[r+1]}};
    const tempo=Math.min(practiceTempoRange(exercise).max,Math.round(bpm*1.06));
    return tempo>bpm?{axis:'tempo',direction:'up',settings:{},tempo}:null;
  }
  if(attempts.every(a=>a.pitch<70)&&p>0)return {axis:'pitch',direction:'down',settings:{difficulty:pitchLevels[p-1]}};
  if(attempts.every(a=>a.rhythm<70)&&r>0)return {axis:'rhythm',direction:'down',settings:{rhythmLevel:rhythmLevels[r-1]}};
  if(pitch<75||rhythm<75){
    const tempo=Math.max(practiceTempoRange(exercise).min,Math.round(bpm*.9));
    return tempo<bpm?{axis:'tempo',direction:'down',settings:{},tempo}:null;
  }
  return null;
}
