import type {ExerciseData,GeneratedNote,VexDuration} from '../music';
import {metricPosition} from './meterFeel';

const close=(a:number,b:number)=>Math.abs(a-b)<1e-7;
function heldValue(units:number):{duration:VexDuration;dots:number}|undefined {
  if(units===16)return {duration:'w',dots:0};
  if(units===12)return {duration:'h',dots:1};
  if(units===8)return {duration:'h',dots:0};
  if(units===6)return {duration:'q',dots:1};
  if(units===4)return {duration:'q',dots:0};
}

/** Only newly composed, planned two-staff studies. Keep the melody and its
 * harmony untouched: let a busy bass share an existing phrase-end hold or
 * silence, without imposing a new cadence or a new uniform closing rhythm. */
export function settleGrandPhraseRhythm(exercise:ExerciseData):ExerciseData {
  if(exercise.grandMode!=='two-hand'||!exercise.lowerMeasures||!exercise.musicalIntent)return exercise;
  const endings=new Set(exercise.musicalIntent.phrases.map(p=>p.endBar));
  let changed=false;
  const lowerMeasures=exercise.lowerMeasures.map((bar,index)=>{
    if(!endings.has(index)||bar.events.some(n=>n.tuplet||n.chord||n.technique))return bar;
    const upper=exercise.measures[index],landing=upper.events.findLast(n=>!n.rest);
    if(!landing)return bar;
    const end=landing.startUnits+landing.durationUnits;
    let events=bar.events;
    // Silence is a deliberate breath in the lead, not a cue for the bass to
    // carry on with an unrelated figure. Respect existing, exact onset edges.
    if(end<bar.totalUnits&&events.some(n=>close(n.startUnits,end))){
      events=events.map(n=>n.startUnits>=end&&!n.rest?{
        key:n.key,octave:n.octave,rest:true,duration:n.duration,dots:n.dots,
        startUnits:n.startUnits,durationUnits:n.durationUnits,
      }:n);
    }
    const position=metricPosition(upper,landing.startUnits,exercise.timeSignature);
    const value=position.onPulse&&landing.durationUnits>=position.units?heldValue(landing.durationUnits):undefined;
    const at=events.findIndex(n=>close(n.startUnits,landing.startUnits)&&!n.rest);
    const tail=events.findIndex(n=>close(n.startUnits,end));
    if(value&&at>=0&&(tail>at||close(end,bar.totalUnits))){
      const stop=tail>at?tail:events.length,source=events[at];
      if(stop-at>1){
        const held:GeneratedNote={key:source.key,octave:source.octave,midi:source.midi,rest:false,
          ...value,startUnits:landing.startUnits,durationUnits:landing.durationUnits};
        events=[...events.slice(0,at),held,...events.slice(stop)];
      }
    }
    if(events===bar.events||events.length===bar.events.length&&events.every((n,i)=>n===bar.events[i]))return bar;
    changed=true;return {...bar,events};
  });
  return changed?{...exercise,lowerMeasures}:exercise;
}
