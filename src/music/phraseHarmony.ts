import type {TimeSignature} from '../music';
import {pitchClass, type Tonality} from './scales';

export interface HarmonyBar {root:number; pitches:number[]; role:'home'|'depart'|'prepare'|'arrive'}
const mod=(n:number)=>(n%12+12)%12;
type Progression = readonly number[];

// Scale-degree roots, starting at zero. The inner harmonies give a melody more
// than I–IV–V to travel through; the last two roots describe its own cadence.
const major:readonly Progression[] = [
  [0,5,1,4,0,3,4,0], [0,2,5,3,1,4,4,0],
  [0,4,5,2,3,1,4,0], [0,3,1,4,5,3,4,0],
  [0,5,3,0,1,4,3,0], [0,1,4,2,5,1,4,0],
  [0,3,0,5,1,4,3,0], [0,2,3,1,5,3,4,0],
  [0,5,1,4,0,2,3,0], [0,3,2,5,3,1,4,0],
];
const minor:readonly Progression[] = [
  [0,5,3,4,0,5,4,0], [0,2,6,5,3,1,4,0],
  [0,3,6,2,5,3,4,0], [0,4,5,2,3,4,3,0],
  [0,5,2,6,3,5,4,0], [0,2,3,0,5,4,3,0],
  [0,3,1,4,5,3,4,0], [0,6,2,5,3,0,3,0],
];
const modal:Record<string,readonly Progression[]> = {
  dorian:[
    [0,3,0,6,2,1,3,0], [0,2,3,1,4,3,6,0],
    [0,6,3,0,1,2,4,0], [0,1,4,2,3,6,3,0],
  ],
  phrygian:[
    [0,1,0,6,3,5,1,0], [0,3,5,1,6,3,1,0],
    [0,6,2,5,1,0,3,0], [0,5,3,6,2,3,1,0],
  ],
  lydian:[
    [0,1,4,0,5,1,4,0], [0,5,1,2,4,5,1,0],
    [0,2,5,1,0,2,4,0], [0,4,2,5,1,4,1,0],
  ],
  mixolydian:[
    [0,6,3,0,1,6,3,0], [0,3,5,6,0,3,6,0],
    [0,4,6,3,5,1,3,0], [0,5,3,1,4,3,6,0],
  ],
  locrian:[
    [0,1,3,6,2,5,1,0], [0,3,5,1,6,2,3,0],
    [0,6,2,3,1,5,1,0], [0,5,3,2,6,1,3,0],
  ],
};
// These scales use modal centers rather than a borrowed major/minor dominant.
// Degrees refer to the actual pitch set, so a five-tone scale never acquires
// an absent leading tone or third just to fit a familiar Western progression.
const sparse:readonly Progression[] = [
  [0,2,3,1,4,2,3,0], [0,1,4,3,2,1,2,0],
  [0,3,1,4,0,2,3,0], [0,4,2,0,3,1,2,0],
  [0,1,2,4,3,2,1,0], [0,2,4,1,2,0,3,0],
];

function palette(tonality:Tonality, count:number):readonly Progression[] {
  if(count!==7)return sparse;
  if(modal[tonality.scaleId])return modal[tonality.scaleId];
  if(['natural-minor','harmonic-minor','melodic-minor'].includes(tonality.scaleId))return minor;
  if(tonality.scaleId==='phrygian-dominant')return modal.phrygian;
  if(tonality.scaleId==='lydian-dominant')return modal.lydian;
  return major;
}

function chordAt(rootIndex:number, pitches:number[], scaleId:string):number[] {
  const root=pitches[rootIndex];
  if(pitches.length===7) {
    // Stack actual scale thirds, including diminished/augmented fifths where
    // the chosen mode supplies them, rather than guessing major/minor chords.
    return [root,pitches[(rootIndex+2)%7],pitches[(rootIndex+4)%7]];
  }
  const available=(interval:number)=>pitches.includes(mod(root+interval));
  const thirdOrder=scaleId==='major-blues'?[4,3]:[3,4];
  const third=thirdOrder.find(available);
  const fifthOrder=scaleId==='whole-tone'?[8]:scaleId.startsWith('diminished')?[6,7]:[7];
  const fifth=fifthOrder.find(available);
  const chord=[root,...(third===undefined?[]:[mod(root+third)]),...(fifth===undefined?[]:[mod(root+fifth)])];
  if(chord.length<2) {
    // Open/modal support for sparse pitch sets, avoiding simultaneous major
    // and minor thirds (particularly in the blues scales).
    const support=[5,9,8,2,10,1,6].find(available);
    if(support!==undefined)chord.push(mod(root+support));
  }
  return [...new Set(chord)];
}

/** Plan shared tonal centers before melody/accompaniment. A local seed chooses
 * harmonic color independently of rhythm; all notes remain in the chosen mode.
 */
export function planPhraseHarmony(tonality:Tonality, meters:readonly TimeSignature[], seed=0):HarmonyBar[] {
  if(tonality.tonic===null || tonality.scaleId==='atonal')return [];
  const home=pitchClass(tonality.tonic);
  const pitches=[...new Set([home,...tonality.notes.map(pitchClass)])]
    .sort((a,b)=>mod(a-home)-mod(b-home));
  const choices=palette(tonality,pitches.length);
  const selection=Number.isFinite(seed)?Math.abs(Math.trunc(seed)):0;
  const firstShape=selection%choices.length;
  const contrast=1+Math.floor(selection/choices.length)%(choices.length-1);
  const closing=choices[firstShape].at(-2)!%pitches.length;
  return meters.map((_,index)=>{
    const final=index===meters.length-1, first=index===0, preparation=index===meters.length-2;
    const block=Math.floor(index/8), blockLength=Math.min(8,meters.length-block*8);
    const position=Math.floor((index%8)*7/Math.max(1,blockLength-1));
    // Longer studies develop into a contrasting progression; do not repeat the
    // same eight-bar roots verbatim. Compress short endings into their cadence.
    const shape=choices[(firstShape+block*contrast)%choices.length];
    const degree=first||final?0:preparation?closing:shape[position]%pitches.length;
    return {root:pitches[degree],pitches:chordAt(degree,pitches,tonality.scaleId),
      role:final?'arrive':first?'home':preparation?'prepare':'depart'};
  });
}
