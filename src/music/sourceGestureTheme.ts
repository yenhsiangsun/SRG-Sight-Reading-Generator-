import type {Difficulty,MeasureData} from '../music';
import type {PhraseSpan} from './phrasePlan';
import {pulseGroups} from './meterFeel';
import {PITCH_DIFFICULTY} from './pitchDifficulty';
import {pitchClass,type ScalePitch,type Tonality} from './scales';
import {planStudyMelody,type StudyFigure,type StudyForm} from './studyMelody';

export interface SourceGestureTheme {
  degrees:number[];
  route:number;
  source:{form:StudyForm;figure:StudyFigure;startBar:number;endBar:number;
    eventIndices:number[];eventMidi:number[];pulseEventIndices:number[];pulseMidi:number[]};
  eligibleWindows:number;
}

/** Unregistered experiment: take the pulse-anchor projection of one complete
 * two-bar graded study guide. The full event guide is retained as provenance;
 * subdivision notes are not claimed to survive this projection. A held event
 * supplies several pulses. Rest gaps, phrase boundaries, missing pitches and
 * excessive leaps reject a whole window, without repairing individual notes.
 * The caller still decides whole-phrase feasibility and the final modal solver
 * still decides actual notes. This function does not change rhythm or range. */
export function buildSourceGestureTheme(measures:readonly MeasureData[],pitches:ScalePitch[],tonality:Tonality,
  difficulty:Difficulty,count:number,random:()=>number,instrument?:string,phrases?:readonly PhraseSpan[]):SourceGestureTheme|undefined {
  if(measures.length<2||pitches.length<5||tonality.tonic===null||
    measures.some(b=>b.timeSignature!==measures[0].timeSignature))return;
  const groups=pulseGroups(measures[0]);
  if(count!==groups.length*2)return;
  const plan=planStudyMelody(measures,pitches,pitchClass(tonality.tonic),difficulty,instrument,phrases);
  const slots=measures.flatMap((bar,b)=>bar.events.flatMap(note=>note.rest?[]:[{bar:b,note}]));
  const byIndex=new Map(plan.targets.map(t=>[t.index,t.midi]));
  const maxLeap=PITCH_DIFFICULTY[difficulty].maxLeap;
  const legal=(midi:readonly number[])=>midi.every((n,i)=>Number.isFinite(n)&&pitches.some(p=>p.midi===n)&&
    (i===0||Math.abs(n-midi[i-1])<=maxLeap));
  const windows:Omit<SourceGestureTheme,'eligibleWindows'>[]=[];
  for(let startBar=0;startBar+1<measures.length;startBar++) {
    const endBar=startBar+1,phrase=plan.phrases.find(p=>startBar>=p.startBar&&endBar<=p.endBar);
    if(!phrase||measures.slice(startBar,endBar+1).some(b=>b.events.some(n=>n.rest)))continue;
    const eventIndices=slots.flatMap((s,i)=>s.bar>=startBar&&s.bar<=endBar?[i]:[]);
    const eventMidi=eventIndices.map(i=>byIndex.get(i)!);
    if(!eventIndices.length||!legal(eventMidi))continue;
    const pulseEventIndices:number[]=[];
    for(let bar=startBar;bar<=endBar;bar++) {
      let at=0;
      for(const units of groups) {
        const index=slots.findIndex(s=>s.bar===bar&&s.note.startUnits<=at+1e-7&&
          s.note.startUnits+s.note.durationUnits>at+1e-7);
        if(index<0)break;
        pulseEventIndices.push(index);at+=units;
      }
    }
    const pulseMidi=pulseEventIndices.map(i=>byIndex.get(i)!);
    if(pulseMidi.length!==count||!legal(pulseMidi))continue;
    const degrees=pulseMidi.map(n=>pitches.findIndex(p=>p.midi===n));
    const peak=degrees.indexOf(Math.max(...degrees));
    const route=degrees.at(-1)!<degrees[0]?1:peak>0&&peak<degrees.length-1?0:2;
    windows.push({degrees,route,source:{form:plan.form,figure:phrase.figure,startBar,endBar,
      eventIndices,eventMidi,pulseEventIndices,pulseMidi}});
  }
  if(!windows.length)return;
  const draw=random();
  if(!Number.isFinite(draw)||draw<0||draw>=1)return;
  return {...windows[Math.floor(draw*windows.length)],eligibleWindows:windows.length};
}
