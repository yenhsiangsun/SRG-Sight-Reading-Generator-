import type {ExerciseData, NotePitch} from '../music';
import {INSTRUMENTS, type Instrument} from './instruments';
import type {RhythmBarPlan} from './phraseRhythm';
import {melodicVoice} from './exerciseQuality';
import {pipaDoubleStopFingering} from './pipaFingering';
import {isShengInstrument, shengButton, shengKeyboardButton} from './shengFingering';

export function needsBreath(instrument?:string) {
  const family=INSTRUMENTS[instrument as Instrument]?.family;
  return instrument==='Voice' || ['木管','銅管','國樂・吹管'].includes(family);
}

/** One written breath opportunity per four-bar phrase, never at the final
 * cadence or inside a tuplet. Planned before pitches so grades stay independent.
 */
export function planBreathing(plan:RhythmBarPlan[],instrument?:string):RhythmBarPlan[] {
  if(!needsBreath(instrument))return plan;
  return plan.map((bar,index)=>{
    if((index+1)%4 || index===plan.length-1)return bar;
    const last=bar.notes.at(-1),previous=bar.notes.at(-2);
    if(!last || last.rest || last.tuplet || previous?.rest || ![2,4,6,8].includes(last.units))return bar;
    const start=last.startUnits, units=last.units-2;
    const replacement=units===0?[]:[{...last,units,duration:units===2?'8' as const:'q' as const,dots:units===6?1:0}];
    return {...bar,notes:[...bar.notes.slice(0,-1),...replacement,{...last,duration:'8' as const,dots:0,units:2,startUnits:start+units,rest:true}]};
  });
}

/** Relative difficulty heuristic; not an instrument-specific fingering proof.
 * Prefer fewer rapid wide register/string changes while retaining isolated leaps.
 */
export function instrumentMotionPenalty(exercise:ExerciseData,instrument?:string) {
  const profile=INSTRUMENTS[instrument as Instrument];
  if(!profile)return 0;
  const sensitive=needsBreath(instrument)||profile.family.includes('弦')||instrument==='Pipa';
  if(!sensitive)return 0;
  let penalty=0,previous:number|undefined,run=0;
  for(const bar of melodicVoice(exercise))for(const note of bar.events){
    if(note.rest){previous=undefined;run=0;continue;}
    if(previous!==undefined){
      const distance=Math.abs(note.midi!-previous);
      run=note.durationUnits<=2&&distance>=7?run+1:0;
      if(run>1)penalty+=(run-1)*2;
    }
    previous=note.midi;
  }
  return penalty;
}

/** Rank already-valid voicings by hand movement, rather than claiming a
 * universal maximum reach. Soprano fixed fingers and lower sheng movable hands
 * deliberately use different coordinates. */
export function harmonyMotionCost(previous:readonly NotePitch[],next:readonly NotePitch[],instrument:string) {
  if(!previous.length)return 0;
  if(instrument==='Pipa'){
    const a=pipaDoubleStopFingering(previous),b=pipaDoubleStopFingering(next);
    if(a&&b)return Math.abs(Math.max(...a.map(n=>n.fret))-Math.max(...b.map(n=>n.fret)))+
      Math.abs(a[0].string-b[0].string)*3;
  }
  if(isShengInstrument(instrument)){
    return next.reduce((sum,pitch)=>sum+Math.min(...previous.map(old=>{
      if(instrument==='Sheng'){
        const a=shengButton(old.midi),b=shengButton(pitch.midi);
        return a&&b&&a.finger===b.finger?Math.abs(a.position-b.position):2;
      }
      const a=shengKeyboardButton(old.midi,instrument),b=shengKeyboardButton(pitch.midi,instrument);
      return a&&b&&a.hand===b.hand?Math.abs(a.column-b.column)+Math.abs(a.row-b.row)*2:2;
    })),0)/next.length;
  }
  return next.reduce((sum,p)=>sum+Math.min(...previous.map(old=>Math.abs(p.midi-old.midi))),0)/next.length;
}
