import type {GeneratedNote} from '../music';

type SoundEvent = {note: string; duration: number; time: number; velocity?: number};
/** Audition only. The scoring timeline always retains the written note onsets.
 * These are re-articulations of existing samples, not dedicated technique samples.
 */
export function pipaExpression(event: SoundEvent, technique: GeneratedNote['technique'], _index: number, _count: number, span: number, groupOffset?: number): SoundEvent[] {
  if (technique === 'pipa-roll') {
    if(groupOffset!==undefined){
      const times=[0];
      for(let finger=Math.floor(groupOffset*12+1e-8)+1;finger/12<groupOffset+span-1e-8;finger++)times.push(finger/12-groupOffset);
      return times.map(offset=>({...event,time:event.time+offset,duration:Math.min(1/8,span-offset),
        velocity:(event.velocity??.73)*(groupOffset+offset<1e-8?1:.7+(Math.floor((groupOffset+offset)*12+1e-8)%5)*.035)}));
    }
    const attacks = Math.max(2,Math.ceil(span*12));
    const step = span/attacks;
    return Array.from({length:attacks},(_,i) => ({...event,time:event.time+i*step,
      duration:Math.min(step*1.5,span-i*step),velocity:(event.velocity??.73)*(i===0?1:.7+(i%5)*.035)}));
  }
  // Legacy brush/arpeggio metadata stays readable, but its chord now attacks
  // normally without a sweep. Keep the written pitches and time intact.
  return [event];
}
