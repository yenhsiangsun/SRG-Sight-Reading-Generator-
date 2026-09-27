import type { ExerciseData } from '../music';
import { createPlaybackEvents } from '../audio/PlaybackController';
import {hasPolyphony} from '../music/notePitches';
import {clearFrame,detectOnsets} from './onsets';
import {measureTimeline} from '../audio/tempo';
import {allowsNaturalDecay,durationCoverage,observationStep,sufficientDuration} from './duration';
export interface Observation {time:number;midi:number;confidence:number;rms:number;clipped?:boolean}
export interface NoteResult {index:number;expected:string;pitch:boolean;rhythm:boolean;heard:boolean;duration:boolean;cents:number|null;offsetMs:number|null}
export interface AssessmentResult {pitch:number;rhythm:number;completion:number;duration:number;extraNotes:number;decayAllowance:boolean;confidence:number;notes:NoteResult[];reliable:boolean;restAccuracy?:number;clipped?:boolean}
export function midiForNote(note:string) {
  const match=note.match(/^([a-g])([#b]*)(-?\d+)$/i);
  if(!match)throw new Error('Invalid pitch');
  return (Number(match[3])+1)*12+({c:0,d:2,e:4,f:5,g:7,a:9,b:11}[match[1].toLowerCase()]!)+[...match[2]].reduce((n,a)=>n+(a==='#'?1:-1),0);
}
const median=(values:number[])=>{const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.floor(sorted.length/2)]??0;};
export function assess(exercise:ExerciseData,bpm:number,observations:Observation[],latencyMs=0):AssessmentResult {
  if(hasPolyphony(exercise))throw new Error('Polyphonic microphone grading is not supported.');
  const playback=createPlaybackEvents(exercise,bpm),expected=playback.events;
  const frames=observations.filter(clearFrame).map(o=>({...o,time:o.time-latencyMs/1000})).sort((a,b)=>a.time-b.time);
  const onsets=detectOnsets(frames);
  const step=observationStep(frames),decayAllowance=allowsNaturalDecay(exercise);
  const matchedOnsets=new Set<number>();
  let usedThrough=-1;
  const notes=expected.map((note,index)=>{
    const spacing=Math.min(note.time-(expected[index-1]?.time??note.time-1),(expected[index+1]?.time??note.time+1)-note.time);
    const tolerance=Math.min(.18,Math.max(.035,note.duration*.25),spacing*.4);
    const search=Math.min(.3,Math.max(.08,tolerance*2),spacing*.45);
    const candidate=onsets.map((onset,i)=>({i,delta:onset.time-note.time})).filter(item=>item.i>usedThrough&&Math.abs(item.delta)<=search).sort((a,b)=>Math.abs(a.delta)-Math.abs(b.delta))[0];
    if(candidate){usedThrough=candidate.i;matchedOnsets.add(candidate.i);}
    const attack=candidate?onsets[candidate.i].time:note.time;
    // Following an actually detected late attack avoids mixing the preceding
    // pitch into this note's window. Never consume the next detected attack.
    const end=Math.min(attack+note.duration,candidate?(onsets[candidate.i+1]?.time??Infinity):Infinity);
    const windows=frames.filter(frame=>frame.time>=attack+.01&&frame.time<end-.005);
    const heard=windows.length>=2;
    const differences=windows.map(frame=>(frame.midi-midiForNote(note.note))*100);
    const cents=heard?median(differences):null;
    const correctFraction=heard?differences.filter(error=>Math.abs(error)<=50).length/differences.length:0;
    const coverage=durationCoverage(frames.filter(frame=>frame.time>=attack-step/2&&frame.time<end+step/2),attack,end,step);
    const duration=heard&&sufficientDuration(coverage,note.duration,step,decayAllowance);
    return {index,expected:note.note,heard,duration,pitch:heard&&correctFraction>=.6,rhythm:!!candidate&&Math.abs(candidate.delta)<=tolerance&&duration,cents,offsetMs:candidate?Math.round(candidate.delta*1000):null};
  });
  // Count genuine unmatched attacks during the piece, including written rests.
  // The onset detector suppresses vibrato and isolated pitch spikes. Count-in
  // leakage before time zero and the release tail after the score are excluded.
  const extraNotes=onsets.filter((onset,index)=>onset.time>=0&&onset.time<playback.duration&&!matchedOnsets.has(index)).length;
  const percent=(count:number)=>Math.round(100*count/Math.max(1,notes.length));
  const confidence=Math.round(100*(frames.reduce((sum,f)=>sum+f.confidence,0)/Math.max(1,frames.length)));
  const sounding=[exercise.measures,...(exercise.lowerMeasures?[exercise.lowerMeasures]:[])].flatMap(staff=>measureTimeline(exercise,bpm,staff).flatMap(bar=>{
    let units=0;
    return bar.measure.events.flatMap(note=>{const start=bar.start+units*bar.secondsPerUnit;units+=note.durationUnits;
      return note.rest?[]:[{start,end:bar.start+units*bar.secondsPerUnit}];});
  }));
  const explicitRests=observations.filter(o=>Number.isFinite(o.time)).map(o=>({...o,time:o.time-latencyMs/1000}))
    .filter(o=>o.time>=0&&o.time<playback.duration&&!sounding.some(n=>o.time>=n.start-.07&&o.time<n.end+.07));
  const restAccuracy=explicitRests.length?Math.round(100*explicitRests.filter(o=>!clearFrame(o)).length/explicitRests.length):undefined;
  const clipped=observations.filter(o=>o.clipped).length>Math.max(2,observations.length*.05);
  return {pitch:percent(notes.filter(n=>n.pitch).length),rhythm:Math.round(100*notes.filter(n=>n.rhythm).length/Math.max(1,notes.length+extraNotes)),completion:percent(notes.filter(n=>n.heard).length),
    duration:percent(notes.filter(n=>n.duration).length),extraNotes,decayAllowance,confidence,notes,
    reliable:frames.length>=10&&notes.length>0&&confidence>=88&&!clipped,restAccuracy,clipped};
}
