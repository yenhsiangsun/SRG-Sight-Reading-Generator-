import type {ExerciseData} from '../music';
import type {Observation} from './scoring';

// These instruments can become too quiet for pitch tracking while a correctly
// played note is still ringing. Do not infer finger release from that decay.
const decayingInstruments=new Set(['Piano','Guitar','Bass Guitar','Liuqin','Pipa','Zhongruan','Daruan','Sanxian','Guzheng','Yangqin','Yunluo']);
export function allowsNaturalDecay(exercise:ExerciseData) {
  return decayingInstruments.has(exercise.soundProfile??exercise.instrument);
}

/** Coverage uses observation cadence, not the distance from first to last frame:
 * two isolated detections must not turn the silence between them into sustain. */
export function observationStep(frames:readonly Observation[]) {
  const steps=frames.slice(1).map((frame,index)=>frame.time-frames[index].time).filter(step=>step>0&&step<=.06).sort((a,b)=>a-b);
  return Math.min(.05,steps[Math.floor(steps.length/2)]??512/48000);
}

export function durationCoverage(frames:readonly Observation[],start:number,end:number,step:number) {
  let covered=0,through=start;
  for(const frame of frames) {
    const left=Math.max(start,frame.time-step/2),right=Math.min(end,frame.time+step/2);
    if(right>Math.max(left,through))covered+=right-Math.max(left,through);
    through=Math.max(through,right);
  }
  return covered;
}

export function sufficientDuration(covered:number,expected:number,step:number,naturalDecay:boolean) {
  // Playback already applies staccato/tenuto. Allow ordinary articulation gaps
  // and one observation of boundary uncertainty; a 50 ms blip cannot pass a
  // long note. For naturally decaying tones only require the initial 180 ms.
  const required=Math.min(expected*.65,naturalDecay ? .18 : Infinity);
  return covered+Math.min(step,expected*.05)>=required;
}
