import type {GeneratedNote,MeasureData,TimeSignature,VexDuration} from '../music';
/** Rest spelling is independent of the melody on the other staff. */
export function simplifyStaffRests(measure:MeasureData,meter:TimeSignature):MeasureData {
  if(measure.events.every(note=>note.rest))return {...measure,events:[{
    key:'b/4',octave:4,rest:true,duration:'w',dots:0,startUnits:0,durationUnits:measure.totalUnits,measureRest:true,
  }]};
  const compound=meter.endsWith('/8');
  const groups=compound?measure.beamGroups:Array(Number(meter.split('/')[0])).fill(4) as number[];
  const boundaries=[0];for(const group of groups)boundaries.push(boundaries[boundaries.length-1]+group);
  const events:GeneratedNote[]=[];
  for(let i=0;i<measure.events.length;){
    const note=measure.events[i];
    if(!note.rest){events.push({...note});i++;continue;}
    let end=note.startUnits;
    while(i<measure.events.length&&measure.events[i].rest){end+=measure.events[i].durationUnits;i++;}
    let at=note.startUnits;
    while(at<end){
      const boundary=boundaries.find(b=>b>at)??measure.totalUnits;
      // In 4/4 each complete half-bar can be a half rest. Otherwise expose beat groups.
      const limit=meter==='4/4'&&at%8===0&&end-at>=8?at+8:Math.min(end,boundary);
      const candidates:Array<[number,VexDuration,number]>=[[8,'h',0],...(compound?[[6,'q',1] as [number,VexDuration,number]]:[]),[4,'q',0],[2,'8',0],[1,'16',0]];
      const [units,duration,dots]=candidates.find(([u])=>u<=limit-at&&(u===6?boundaries.includes(at):at%u===0))??[1,'16',0];
      events.push({...note,startUnits:at,durationUnits:units,duration,dots});at+=units;
    }
  }
  return {...measure,events};
}
