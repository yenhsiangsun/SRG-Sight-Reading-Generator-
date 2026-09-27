import type {GeneratedNote} from '../music';

type SoundEvent = {note: string; duration: number; time: number; velocity?: number};
/** Audition only. The scoring timeline always retains the written note onsets.
 * These are re-articulations of existing samples, not dedicated technique samples.
 */
export function pipaExpression(event: SoundEvent, technique: GeneratedNote['technique'], index: number, count: number, span: number): SoundEvent[] {
  if (technique === 'pipa-roll') {
    const attacks = Math.max(2,Math.ceil(span*12));
    const step = span/attacks;
    return Array.from({length:attacks},(_,i) => ({...event,time:event.time+i*step,
      duration:Math.min(step*1.5,span-i*step),velocity:(event.velocity??.73)*(i===0?1:.7+(i%5)*.035)}));
  }
  if (technique === 'pipa-arpeggio' || technique === 'pipa-brush') {
    const spread = Math.min(technique === 'pipa-arpeggio' ? .11 : .035,span*.22);
    const delay = count > 1 ? spread*index/(count-1) : 0;
    return [{...event,time:event.time+delay,duration:Math.max(.001,event.duration-delay)}];
  }
  return [event];
}
