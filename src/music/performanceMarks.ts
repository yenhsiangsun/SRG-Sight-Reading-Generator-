import type {ExerciseData, GeneratedNote, MeasureData} from '../music';
import {metricPosition, pulseGroups} from './meterFeel';
import {rhythmTicks} from './rhythmTiming';

export const dynamicVelocity = {p:0.42, mp:0.58, mf:0.73, f:0.88};
type Character = 'light' | 'sustained' | 'marked';
const pick = (random:()=>number, count:number) => Math.min(count-1,Math.max(0,Math.floor(random()*count)));

/** Conservative practice gestures, not a claim that offbeat accents are forbidden in music. */
function articulate(measure:MeasureData, character:Character, closing:boolean, opening:boolean, random:()=>number, meter:ExerciseData['timeSignature']) {
  const events=measure.events.map(({articulation:_articulation,dynamic:_dynamic,...note})=>note as GeneratedNote);
  const sounded=events.filter(note=>!note.rest);
  if(!sounded.length)return events;
  const position=(note:GeneratedNote)=>metricPosition(measure,note.startUnits,meter);
  const last=sounded.at(-1)!;
  // A sustained arrival at the end of the phrase; never a sixteenth at the end of a run.
  if(closing && position(last).onPulse && last.durationUnits>=position(last).units/2) last.articulation='tenuto';

  if(character==='light') {
    const groups=pulseGroups(measure,meter);
    let start=0;
    const runs:GeneratedNote[][]=[];
    for(const units of groups) {
      const notes=events.filter(note=>note.startUnits>=start && note.startUnits<start+units);
      if(notes.length>=2 && notes.every(note=>!note.rest && !note.articulation && note.durationUnits<=2)
        && rhythmTicks(notes[0].startUnits)===rhythmTicks(start)
        && rhythmTicks(notes.at(-1)!.startUnits+notes.at(-1)!.durationUnits)===rhythmTicks(start+units)
        && !(closing && notes.includes(last)))runs.push(notes);
      start+=units;
    }
    if(runs.length) for(const note of runs[pick(random,runs.length)])note.articulation='staccato';
  } else if(character==='sustained' && !closing) {
    const arrivals=sounded.filter(note=>position(note).onPulse && note.durationUnits>=position(note).units/2);
    if(arrivals.length)arrivals[pick(random,arrivals.length)].articulation='tenuto';
  } else if(character==='marked' && !closing) {
    // At most one accent: a metrical phrase entrance or an approached melodic peak.
    const peaks=sounded.filter((note,index)=>{
      if(!position(note).onPulse || note.durationUnits<2 || note.articulation)return false;
      const previous=sounded[index-1], next=sounded[index+1];
      return (opening && position(note).downbeat) || (previous && next &&
        (note.midi??0)-(previous.midi??0)>=3 && (note.midi??0)>(next.midi??0));
    });
    if(peaks.length)peaks.reduce((a,b)=>(b.midi??0)>(a.midi??0)?b:a).articulation='accent';
  }
  return events;
}

/** Dynamics share a phrase plan across hands; articulation follows musical groups, never note counts. */
export function addPerformanceMarks(exercise: ExerciseData, random:()=>number=Math.random): ExerciseData {
  const levels = ['p','mp','mf','f'] as const, characters:Character[]=['light','sustained','marked'];
  let dynamicIndex=pick(random,levels.length), previousCharacter:Character|undefined;
  const plan=exercise.measures.map((_,index)=>{
    if(index>0 && index%4===0) {
      const direction=dynamicIndex===0?1:dynamicIndex===3?-1:random()<.5?-1:1;
      dynamicIndex+=direction;
    }
    if(index%2===0) {
      const choices=characters.filter(character=>character!==previousCharacter);
      previousCharacter=choices[pick(random,choices.length)];
    }
    return {dynamic:levels[dynamicIndex],character:previousCharacter!};
  });
  const decorate=(measures:MeasureData[])=>{
    let previousDynamic:GeneratedNote['dynamic'];
    return measures.map((measure,index)=>{
      const {dynamic,character}=plan[index];
      const events=articulate(measure,character,index%2===1 || index===measures.length-1,index%2===0,random,exercise.timeSignature);
      const first=events.find(note=>!note.rest);
      if(first && dynamic!==previousDynamic){first.dynamic=dynamic;previousDynamic=dynamic;}
      return {...measure,events};
    });
  };
  return {...exercise,measures:decorate(exercise.measures),...(exercise.lowerMeasures?{lowerMeasures:decorate(exercise.lowerMeasures)}:{})};
}

export function noteExpression(note: GeneratedNote, velocity: number) {
  return {velocity:note.articulation==='accent'?Math.min(1,velocity*1.22):velocity,
    lengthRatio:note.articulation==='staccato'?0.5:note.articulation==='tenuto'?1:0.95};
}
