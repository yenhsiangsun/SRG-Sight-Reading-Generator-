import type {Observation} from './scoring';
export const clearFrame=(frame:Observation)=>Number.isFinite(frame.time)&&Number.isFinite(frame.midi)&&
  Number.isFinite(frame.confidence)&&frame.confidence>=.85&&frame.confidence<=1&&Number.isFinite(frame.rms)&&frame.rms>=.008;

/** Silence gaps, stable pitch transitions and amplitude re-attacks each provide
 * onset evidence. A single pitch spike and gentle vibrato are not new attacks. */
export function detectOnsets(observations:readonly Observation[]) {
  const frames=observations.filter(clearFrame).sort((a,b)=>a.time-b.time);
  const attacks:{time:number;midi:number}[]=[];
  for(let i=0;i<frames.length;i++){
    const current=frames[i],previous=frames[i-1],next=frames[i+1];
    const gap=!previous||current.time-previous.time>.075;
    const changed=previous&&next&&Math.abs(current.midi-previous.midi)>.8&&Math.abs(next.midi-current.midi)<.4;
    const recent=frames.slice(Math.max(0,i-8),i).filter(frame=>current.time-frame.time<=.08);
    const floor=recent.length?Math.min(...recent.map(frame=>frame.rms)):current.rms;
    const envelope=previous&&current.rms>floor*2&&current.rms>previous.rms*1.15&&current.rms>.015;
    if((gap||changed||envelope)&&(!attacks.length||current.time-attacks.at(-1)!.time>=.065))attacks.push({time:current.time,midi:current.midi});
  }
  return attacks;
}
