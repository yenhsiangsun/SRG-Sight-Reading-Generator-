import type {Difficulty} from '../music';
import {pitchClass,type ScalePitch,type Tonality} from './scales';

/** Optional in old saved intentions. Describes one related opening/answer,
 * not a collection of independently randomized notes. */
export interface IntentOpening {
  version:1;
  shape:number;
  anchor:number;
  register:-1|0|1;
  rhythm:number;
  weak:boolean;
}

const mod=(n:number)=>(n%12+12)%12;
const cells={
  classical:[[0,1,2,1,3],[0,-1,-2,-1,0],[0,2,1,0,-1],[0,0,1,3,2],
    [0,1,0,-1,1],[0,3,2,1,2],[0,-2,-1,1,0],[0,1,3,2,0]],
  lyrical:[[0,1,3,2,1],[0,-1,-3,-2,0],[0,2,3,1,0],[0,0,1,2,1],
    [0,1,0,-1,0],[0,-2,-1,1,2],[0,3,2,0,1],[0,1,2,1,-1]],
  pentatonic:[[0,1,0,2],[0,-1,0,-2],[0,2,1,0],[0,0,1,-1],
    [0,1,2,0],[0,-2,-1,1],[0,2,0,1],[0,1,-1,0]],
};

/** Reuse entropy from the existing motive draw. No extra global RNG draw,
 * no user history/storage, and no pitch grade in the rhythmic decision. */
export function planIntentOpening(tonality:Tonality,draw:number,variant:number):IntentOpening {
  let seed=(Math.floor(draw*0x100000000)^Math.imul(variant+1,0x9e3779b9))>>>0;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/0x100000000;};
  const root=pitchClass(tonality.tonic!),available=tonality.notes.map(n=>mod(pitchClass(n)-root));
  const anchors=[0,3,4,7].filter(n=>available.includes(n));
  return {version:1,shape:Math.floor(random()*8),anchor:anchors[Math.floor(random()*anchors.length)]??0,
    register:Math.floor(random()*3)-1 as -1|0|1,rhythm:Math.floor(random()*8),weak:random()<.2};
}

export function openingMotif(grammar:keyof typeof cells,opening:IntentOpening,direction:number) {
  return cells[grammar][opening.shape].map(n=>n*direction);
}

/** Choose a complete gesture with room on both sides rather than clipping
 * a descending entry to repeated notes at the instrument's lower boundary. */
export function openingAnchor(pitches:ScalePitch[],root:number,home:number,difficulty:Difficulty,
  opening:IntentOpening,motif:readonly number[],answer=false) {
  const desired=home+opening.register*{beginner:3,intermediate:5,advanced:7}[difficulty];
  const shape=motif.map(n=>answer?-n:n),low=Math.min(0,...shape),high=Math.max(0,...shape);
  const candidates=pitches.flatMap((p,index)=>mod(p.midi-root)===opening.anchor?[index]:[]);
  const fitting=candidates.filter(index=>index+low>=0&&index+high<pitches.length);
  const choices=fitting.length?fitting:candidates;
  return choices.sort((a,b)=>Math.abs(pitches[a].midi-desired)-Math.abs(pitches[b].midi-desired))[0]
    ??pitches.reduce((best,p,index)=>Math.abs(p.midi-home)<Math.abs(pitches[best].midi-home)?index:best,0);
}

export function validIntentOpening(value:unknown):value is IntentOpening|undefined {
  if(value===undefined)return true;
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const v=value as Record<string,unknown>;
  return v.version===1&&Number.isInteger(v.shape)&&Number(v.shape)>=0&&Number(v.shape)<8&&
    [0,3,4,7].includes(Number(v.anchor))&&typeof v.anchor==='number'&&
    [-1,0,1].includes(Number(v.register))&&typeof v.register==='number'&&
    Number.isInteger(v.rhythm)&&Number(v.rhythm)>=0&&Number(v.rhythm)<8&&typeof v.weak==='boolean';
}
