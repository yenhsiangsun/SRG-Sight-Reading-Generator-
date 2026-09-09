import {simplifyStaffRests} from './simplifyStaffRests';
import { BarlineType, Formatter, Renderer, Stave, StaveConnector } from 'vexflow';
import type { ExerciseData, MeasureData, TimeSignature } from '../music';
import { createMeasureNotation } from './createMeasureNotation';

export function prepareGrandMeasure(upper: MeasureData, lower: MeasureData, key: string, meter: TimeSignature, simplifyRests=false) {
  if (upper.totalUnits !== lower.totalUnits || (lower.timeSignature && lower.timeSignature !== meter)) {
    throw new Error('大譜表左右手的拍號或小節長度不一致。');
  }
  if(simplifyRests){upper=simplifyStaffRests(upper,meter);lower=simplifyStaffRests(lower,meter);}
  const right = createMeasureNotation(upper,'treble',key,meter);
  const left = createMeasureNotation(lower,'bass',key,meter);
  // Separate staves share one time axis, with independent modifier contexts.
  const formatter = new Formatter().joinVoices([right.voice]).joinVoices([left.voice]);
  const voices = [right.voice,left.voice];
  const minWidth = formatter.preCalculateMinTotalWidth(voices);
  return {right,left,formatter,voices,minWidth};
}

function extent(notes: ReturnType<typeof createMeasureNotation>['notes']) {
  const lines=notes.filter(note=>!note.isRest()).flatMap(note=>note.getKeyProps().map(key=>key.line));
  return {above:Math.max(0,(Math.max(5,...lines)-5)*10),below:Math.max(0,(1-Math.min(1,...lines))*10)};
}

export function drawGrandScore(container: HTMLDivElement, exercise: ExerciseData, width: number) {
  const barsPerRow=width<720?1:2;
  const lower=exercise.lowerMeasures;
  if(!lower || lower.length!==exercise.measures.length) throw new Error('大譜表缺少完整的左手聲部。');
  const signature=exercise.tonality?exercise.tonality.signature:exercise.keySignature;
  const prepared=exercise.measures.map((measure,index)=>{
    const meter=measure.timeSignature??exercise.timeSignature;
    const previous=index>0?exercise.measures[index-1].timeSignature??exercise.timeSignature:null;
    const notation=prepareGrandMeasure(measure,lower[index],signature??'C',meter,exercise.grandMode==='mono');
    const first=index%barsPerRow===0;
    const showTime=index===0||meter!==previous;
    const headerWidths=(['treble','bass'] as const).map(clef=>{
      const stave=new Stave(0,0,400);
      if(first){stave.addClef(clef);if(signature)stave.addKeySignature(signature);}
      if(showTime)stave.addTimeSignature(meter);
      return stave.getNoteStartX();
    });
    return {...notation,meter,first,showTime,neededWidth:notation.minWidth+Math.max(...headerWidths)+70};
  });
  const rightExtent=extent(prepared.flatMap(item=>item.right.notes));
  const leftExtent=extent(prepared.flatMap(item=>item.left.notes));
  const staffGap=130+rightExtent.below+leftExtent.above;
  const rowHeight=staffGap+150+rightExtent.above+leftExtent.below;
  const measureWidth=Math.max((width-50)/barsPerRow,...prepared.map(item=>item.neededWidth));
  const renderer=new Renderer(container,Renderer.Backends.SVG);
  renderer.resize(measureWidth*barsPerRow+50,Math.ceil(prepared.length/barsPerRow)*rowHeight+30);
  const context=renderer.getContext();
  prepared.forEach((item,index)=>{
    const x=30+(index%barsPerRow)*measureWidth;
    const y=Math.floor(index/barsPerRow)*rowHeight+25+rightExtent.above;
    const staves=(['treble','bass'] as const).map((clef,hand)=>{
      const stave=new Stave(x,y+hand*staffGap,measureWidth);
      if(item.first){stave.addClef(clef);if(signature)stave.addKeySignature(signature);}
      if(item.showTime)stave.addTimeSignature(item.meter);
      stave.setBegBarType(BarlineType.NONE).setEndBarType(index===prepared.length-1?BarlineType.END:BarlineType.SINGLE);
      return stave;
    });
    const start=Math.max(...staves.map(stave=>stave.getNoteStartX()))+(item.first?18:10);
    const end=Math.min(...staves.map(stave=>stave.getNoteEndX()));
    staves.forEach(stave=>stave.setNoteStartX(start).setContext(context).draw());
    if(item.first){
      new StaveConnector(staves[0],staves[1]).setType('brace').setContext(context).draw();
      new StaveConnector(staves[0],staves[1]).setType('singleLeft').setContext(context).draw();
    }
    new StaveConnector(staves[0],staves[1]).setType(index===prepared.length-1?'boldDoubleRight':'singleRight').setContext(context).draw();
    item.right.voice.setStave(staves[0]);item.left.voice.setStave(staves[1]);
    item.formatter.format(item.voices,Math.max(60,end-start-12));
    [item.right,item.left].forEach((hand,i)=>{
      hand.voice.draw(context,staves[i]);
      hand.beams.forEach(beam=>beam.setContext(context).draw());
    });
    context.save();context.setFont('Arial',10);context.setFillStyle('#64748b');
    context.fillText(String(index+1),x,y+5);context.restore();
  });
  container.querySelector('svg')?.setAttribute('aria-label',`${exercise.measures.length} 小節鋼琴大譜表，上方右手、下方左手`);
}
