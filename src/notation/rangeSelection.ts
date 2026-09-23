import type {Clef} from '../music';
export const rangeStaffBottom: Record<Clef,number> = {treble:30,bass:18,alto:24,tenor:22};
/** The mixed-staff range picker shows each endpoint in its natural register. */
export function mixedRangeClef(midi: number): Clef {return midi < 60 ? 'bass' : 'treble';}
const naturals=[0,2,4,5,7,9,11];
export function rangeNotePosition(midi:number) {
  const pc=((midi%12)+12)%12;
  const degree=naturals.findLastIndex(value=>value<=pc);
  return {degree,octave:Math.floor(midi/12)-1,sharp:pc!==naturals[degree]};
}
export function rangeMidiAtY(y:number,bottomY:number,clef:Clef,octaveShift:number,min:number,max:number) {
  const position=rangeStaffBottom[clef]+Math.round((bottomY-y)/5)+octaveShift*7;
  const octave=Math.floor(position/7),degree=((position%7)+7)%7;
  return Math.max(min,Math.min(max,(octave+1)*12+naturals[degree]));
}
