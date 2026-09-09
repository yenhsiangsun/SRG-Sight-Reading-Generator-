import type {Observation} from './scoring';
export interface Calibration {version:1;offsetMs:number;spreadMs:number;measuredAt:string}
const KEY='sight-reading-microphone-calibration-v1';
const median=(xs:number[])=>[...xs].sort((a,b)=>a-b)[Math.floor(xs.length/2)];
/** Eight detached notes after four quarter-note count-in beats, at 60 BPM. */
export function estimateCalibration(frames:Observation[]):Calibration|null {
  const voiced=frames.filter(f=>f.confidence>=.9).sort((a,b)=>a.time-b.time);
  const onsets:number[]=[];
  for(let i=0;i<voiced.length;i++){
    const f=voiced[i],p=voiced[i-1],next=voiced[i+1];
    if(next&&next.time-f.time<.08&&(!p||f.time-p.time>.12||f.rms>p.rms*3)){
      if(!onsets.length||f.time-onsets[onsets.length-1]>.25)onsets.push(f.time);
    }
  }
  // Require every note, preventing a missing first note from shifting the alignment.
  if(onsets.length!==8)return null;
  const offsets=onsets.map((time,i)=>(time-i*.5)*1000);
  const offsetMs=Math.round(median(offsets));
  const spreadMs=Math.round(median(offsets.map(v=>Math.abs(v-offsetMs))));
  if(offsetMs< -150||offsetMs>400||spreadMs>45||offsets.some(v=>Math.abs(v-offsetMs)>110))return null;
  return {version:1,offsetMs,spreadMs,measuredAt:new Date().toISOString()};
}
export function loadCalibration():Calibration|null {
  try{const v=JSON.parse(localStorage.getItem(KEY)??'null');return v?.version===1&&Number.isFinite(v.offsetMs)&&v.offsetMs>=-150&&v.offsetMs<=400&&Number.isFinite(v.spreadMs)&&v.spreadMs>=0&&v.spreadMs<=45&&typeof v.measuredAt==='string'?v:null;}catch{return null;}
}
export function saveCalibration(value:Calibration):boolean {try{localStorage.setItem(KEY,JSON.stringify(value));return true;}catch{return false;}}
