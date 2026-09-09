import type { ExerciseData, MeasureData } from '../music';
/** BPM always counts the denominator: quarter notes in /4, eighth notes in /8. */
export function beatUnits(meter:string) { return 16 / Number(meter.split('/')[1]); }
export function tempoSymbol(meter:string) { return meter.endsWith('/8') ? '♪' : '♩'; }
export function measureTimeline(exercise:ExerciseData,bpm:number,measures:MeasureData[]=exercise.measures) {
  if(!Number.isFinite(bpm)||bpm<=0)throw new Error('請選擇有效的速度。');
  let beats=0;
  return measures.map(measure=>{
    const meter=measure.timeSignature??exercise.timeSignature??'4/4';
    const unit=beatUnits(meter);
    const total=measure.totalUnits??measure.events.reduce((sum,n)=>sum+n.durationUnits,0);
    const result={measure,meter,unit,start:beats*60/bpm,secondsPerUnit:60/bpm/unit,duration:total/unit*60/bpm};
    beats+=total/unit;
    return result;
  });
}
