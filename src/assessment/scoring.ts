import type { ExerciseData } from '../music';
import { createPlaybackEvents } from '../audio/PlaybackController';
export interface Observation {time:number;midi:number;confidence:number;rms:number}
export interface NoteResult {index:number;expected:string;pitch:boolean;rhythm:boolean;heard:boolean;cents:number|null;offsetMs:number|null}
export interface AssessmentResult {pitch:number;rhythm:number;completion:number;confidence:number;notes:NoteResult[];reliable:boolean}
export function midiForNote(note:string) {
  const match=note.match(/^([a-g])([#b]*)(-?\d+)$/i);
  if(!match)throw new Error('Invalid pitch');
  return (Number(match[3])+1)*12+({c:0,d:2,e:4,f:5,g:7,a:9,b:11}[match[1].toLowerCase()]!)+[...match[2]].reduce((n,a)=>n+(a==='#'?1:-1),0);
}
const median=(values:number[])=>{const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.floor(sorted.length/2)]??0;};
export function assess(exercise:ExerciseData,bpm:number,observations:Observation[],latencyMs=0):AssessmentResult {
  if(exercise.lowerMeasures && exercise.grandMode!=='mono')throw new Error('Polyphonic microphone grading is not supported.');
  const expected=createPlaybackEvents(exercise,bpm).events;
  const frames=observations.filter(o=>o.confidence>=.85).map(o=>({...o,time:o.time-latencyMs/1000})).sort((a,b)=>a.time-b.time);
  const onsets:number[]=[];
  for(let i=0;i<frames.length;i++){
    const current=frames[i],previous=frames[i-1],next=frames[i+1];
    const stableChange=previous&&next&&Math.abs(current.midi-previous.midi)>.7&&Math.abs(next.midi-current.midi)<.4;
    if(!previous||current.time-previous.time>.1||stableChange||(current.rms>previous.rms*2.5&&current.time-previous.time>.02))onsets.push(current.time);
  }
  const used=new Set<number>();
  const notes=expected.map((note,index)=>{
    const windows=frames.filter(frame=>frame.time>=note.time+.02&&frame.time<note.time+note.duration-.01);
    const heard=windows.length>=2;
    const differences=windows.map(frame=>(frame.midi-midiForNote(note.note))*100);
    const cents=heard?median(differences):null;
    const correctFraction=heard?differences.filter(error=>Math.abs(error)<=50).length/differences.length:0;
    const tolerance=Math.min(.18,Math.max(.08,note.duration*.25));
    const candidate=onsets.map((time,i)=>({i,delta:time-note.time})).filter(item=>!used.has(item.i)&&Math.abs(item.delta)<=Math.max(.3,tolerance*2)).sort((a,b)=>Math.abs(a.delta)-Math.abs(b.delta))[0];
    if(candidate)used.add(candidate.i);
    return {index,expected:note.note,heard,pitch:heard&&correctFraction>=.6,rhythm:!!candidate&&Math.abs(candidate.delta)<=tolerance,cents,offsetMs:candidate?Math.round(candidate.delta*1000):null};
  });
  const percent=(count:number)=>Math.round(100*count/Math.max(1,notes.length));
  const confidence=Math.round(100*(frames.reduce((sum,f)=>sum+f.confidence,0)/Math.max(1,frames.length)));
  return {pitch:percent(notes.filter(n=>n.pitch).length),rhythm:percent(notes.filter(n=>n.rhythm).length),completion:percent(notes.filter(n=>n.heard).length),confidence,notes,reliable:frames.length>=10&&notes.length>0};
}
