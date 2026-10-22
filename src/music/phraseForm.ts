import type {PracticeOptions} from '../music';
import type {PhraseSpan} from './phrasePlan';
export const MACRO_FORMS=[[4,4],[3,3,2],[3,2,3],[2,3,3]] as const;
/** Shared phrase timing from the listened B24 version. The composer limits
 * automatic adoption to major 4/4; a forced control draws no random values. */
export function chooseMacroForm(options:PracticeOptions,random:()=>number,forced?:readonly number[]):PhraseSpan[]|undefined {
 if(options.measures!==8||options.mixedMeters||options.allowAccidentals||
  (options.pitchFocus&&options.pitchFocus!=='balanced')||
  (options.rhythmFocus&&options.rhythmFocus!=='balanced')||
  !['3/4','4/4','6/8'].includes(options.timeSignature)||
  !['major','natural-minor','major-pentatonic','minor-pentatonic'].includes(options.scaleId??'major'))return;
 const family=forced?MACRO_FORMS.find(f=>f.length===forced.length&&f.every((n,i)=>n===forced[i])):
  MACRO_FORMS[Math.floor(random()*MACRO_FORMS.length)];
 if(!family)throw new Error('Unknown experimental phrase family');
 let start=0;
 return family.map((length,i)=>{const result:PhraseSpan={startBar:start,endBar:start+length-1,
  role:i===0?'opening':i===family.length-1?'closing':'development'};start+=length;return result;});
}
