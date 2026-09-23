import type { ExerciseData, MeasureData } from '../music';
/** The BPM input refers to the opening meter. Note values stay constant at meter changes. */
export function beatUnits(meter:string) { return 16 / Number(meter.split('/')[1]); }
export function tempoSymbol(meter:string) { return meter.endsWith('/8') ? '♪' : '♩'; }
export function openingMeter(exercise:ExerciseData) { return exercise.measures[0]?.timeSignature??exercise.timeSignature??'4/4'; }
export function tempoMark(exercise:ExerciseData,bpm:number) {
  const initial=openingMeter(exercise);
  const meters=[initial,...exercise.measures.map(m=>m.timeSignature??exercise.timeSignature??initial)];
  const symbols=[...new Set(meters.map(tempoSymbol))];
  return symbols.map(symbol=>`${symbol} = ${bpm*beatUnits(initial)/(symbol==='♩'?4:2)}`).join(' · ');
}
export function measureTimeline(exercise:ExerciseData,bpm:number,measures:MeasureData[]=exercise.measures) {
  if(!Number.isFinite(bpm)||bpm<=0)throw new Error('請選擇有效的速度。');
  const secondsPerUnit=60/bpm/beatUnits(openingMeter(exercise));
  let elapsedUnits=0;
  return measures.map(measure=>{
    const meter=measure.timeSignature??exercise.timeSignature??'4/4';
    const unit=beatUnits(meter);
    const total=measure.totalUnits??measure.events.reduce((sum,n)=>sum+n.durationUnits,0);
    const result={measure,meter,unit,start:elapsedUnits*secondsPerUnit,secondsPerUnit,duration:total*secondsPerUnit};
    elapsedUnits+=total;
    return result;
  });
}
