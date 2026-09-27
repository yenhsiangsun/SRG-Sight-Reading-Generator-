import type {TimeSignature} from '../music';
import {pitchClass, type Tonality} from './scales';

export interface HarmonyBar {root:number; pitches:number[]; role:'home'|'depart'|'prepare'|'arrive'}
const mod=(n:number)=>(n%12+12)%12;
/** Modal pitch-set centers, not a Western dominant imposed on every scale.
 * Planned before melody/accompaniment; a fixed local seed never changes rhythm.
 */
export function planPhraseHarmony(tonality:Tonality, meters:readonly TimeSignature[], seed=0):HarmonyBar[] {
  if(tonality.tonic===null || tonality.scaleId==='atonal')return [];
  const home=pitchClass(tonality.tonic), pitches=tonality.notes.map(pitchClass);
  const choose=(intervals:number[])=>intervals.map(n=>mod(home+n)).find(n=>pitches.includes(n))??home;
  const away=choose([5,2,8,9]), open=choose([7,10,4,3]), prepare=choose([7,10,2,1,5]);
  const progressions=[
    [home,away,open,open,away,open,prepare,home],
    [home,open,away,open,open,away,prepare,home],
    [home,home,away,open,away,home,prepare,home],
    [home,away,home,open,home,away,prepare,home],
    [home,open,open,away,home,open,prepare,home],
    [home,home,open,away,away,home,prepare,home],
  ];
  const shapes=progressions[Math.abs(seed)%progressions.length];
  return meters.map((_,index)=>{
    const final=index===meters.length-1, first=index===0;
    const position=meters.length<=4?Math.floor(index*7/Math.max(1,meters.length-1)):index%8;
    const root=first||final?home:index===meters.length-2?prepare:shapes[position];
    // Use only the mode's actual tones; omit unsupported thirds or fifths.
    const third=[3,4].map(n=>mod(root+n)).find(n=>pitches.includes(n));
    const fifth=mod(root+7);
    const chord=[root,...(third===undefined?[]:[third]),...(pitches.includes(fifth)?[fifth]:[])];
    if(chord.length<2)chord.push(...[5,8,9].map(n=>mod(root+n)).filter(n=>pitches.includes(n)).slice(0,2));
    return {root,pitches:[...new Set(chord)],role:final?'arrive':first?'home':index===meters.length-2?'prepare':'depart'};
  });
}
