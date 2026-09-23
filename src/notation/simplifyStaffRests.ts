import type {GeneratedNote,MeasureData,TimeSignature,VexDuration} from '../music';
/** Engrave silence by the meter, independently of note durations on either staff. */
export function simplifyStaffRests(measure:MeasureData,meter:TimeSignature):MeasureData {
  if(measure.events.every(note=>note.rest))return {...measure,events:[{
    key:'b/4',octave:4,rest:true,duration:'w',dots:0,startUnits:0,durationUnits:measure.totalUnits,measureRest:true,
  }]};
  // Collapse a wholly silent triplet beat, but retain all three positions when
  // any member sounds (including a melody moving between grand-staff hands).
  const source:GeneratedNote[]=[];
  for(let i=0;i<measure.events.length;i++) {
    const note=measure.events[i];
    if(note.tuplet===3) {
      const group=measure.events.slice(i,i+3);
      if(group.length===3 && group.every(n=>n.rest)) {
        source.push({key:note.key,octave:note.octave,rest:true,duration:'q',dots:0,startUnits:note.startUnits,durationUnits:4});
      } else source.push(...group);
      i+=2;
    } else source.push(note);
  }
  const compound=meter.endsWith('/8');
  const groups=compound?measure.beamGroups:Array(Number(meter.split('/')[0])).fill(4) as number[];
  const boundaries=[0];for(const group of groups)boundaries.push(boundaries[boundaries.length-1]+group);
  const events:GeneratedNote[]=[];
  for(let i=0;i<source.length;){
    const note=source[i];
    if(!note.rest || note.tuplet){events.push({...note});i++;continue;}
    let end=note.startUnits;
    while(i<source.length&&source[i].rest&&!source[i].tuplet){end+=source[i].durationUnits;i++;}
    let at=note.startUnits;
    while(at<end){
      const groupIndex=boundaries.findIndex(b=>b>at)-1;
      const groupStart=boundaries[Math.max(0,groupIndex)];
      const boundary=boundaries[groupIndex+1]??measure.totalUnits;
      // In 4/4 each complete half-bar can be a half rest. Otherwise expose beat groups.
      const limit=meter==='4/4'&&at%8===0&&end-at>=8?at+8:Math.min(end,boundary);
      const candidates:Array<[number,VexDuration,number]>=[[8,'h',0],...(compound?[[6,'q',1] as [number,VexDuration,number]]:[]),[4,'q',0],[3,'8',1],[2,'8',0],[1,'16',0]];
      // Subdivision alignment restarts at every big beat. In 6/8, for example,
      // the quarter rest at units 6–10 is identical to the one at units 0–4.
      // The last two eighths of a compound beat remain separate to expose its pulse.
      const [units,duration,dots]=candidates.find(([u])=>u<=limit-at&&(
        u===8?meter==='4/4'&&at%8===0:
        u===6?at===groupStart&&boundary-groupStart===6:
        // Three silent sixteenths at a quarter-beat opening use one dotted
        // eighth rest. Keep offbeat silence and compound big beats distinct.
        u===3?at===groupStart&&boundary-groupStart===4:
        (at-groupStart)%u===0
      ))??[1,'16',0];
      events.push({...note,startUnits:at,durationUnits:units,duration,dots});at+=units;
    }
  }
  return {...measure,events};
}
