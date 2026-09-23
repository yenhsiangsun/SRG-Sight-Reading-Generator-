import {simplifyStaffRests} from './simplifyStaffRests';
import { BarlineType, Formatter, Stave, StaveConnector } from 'vexflow';
import type { ExerciseData, MeasureData, TimeSignature } from '../music';
import { createMeasureNotation, prepareNotationForDrawing } from './createMeasureNotation';
import {planOctaveLines, drawOctaveLines, type OctaveBar} from './octaveLines';
import { collectMeasureAnchors, collectNoteGeometry, type ScoreLayout } from './scoreGeometry';
import {tupletSpace} from './ScoreTuplet';
import {scoreContext, type ScoreViewport} from './scoreRenderer';

export function prepareGrandMeasure(upper: MeasureData, lower: MeasureData, key: string, meter: TimeSignature, simplifyRests=false, upperShifts: number[] = [], lowerShifts: number[] = []) {
  if (upper.totalUnits !== lower.totalUnits || (lower.timeSignature && lower.timeSignature !== meter)) {
    throw new Error('大譜表左右手的拍號或小節長度不一致。');
  }
  if(simplifyRests){upper=simplifyStaffRests(upper,meter);lower=simplifyStaffRests(lower,meter);}
  const right = createMeasureNotation(upper,'treble',key,meter,upperShifts);
  const left = createMeasureNotation(lower,'bass',key,meter,lowerShifts);
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

export function drawGrandScore(container: HTMLDivElement | HTMLCanvasElement, exercise: ExerciseData, width: number, viewport?: ScoreViewport): ScoreLayout {
  const barsPerRow=width<720?1:2;
  const lower=exercise.lowerMeasures;
  if(!lower || lower.length!==exercise.measures.length) throw new Error('大譜表缺少完整的左手聲部。');
  const signature=exercise.tonality?exercise.tonality.signature:exercise.keySignature;
  const upperMeasures=exercise.measures.map(measure=>simplifyStaffRests(measure,measure.timeSignature??exercise.timeSignature));
  const lowerMeasures=lower.map((measure,index)=>simplifyStaffRests(measure,exercise.measures[index].timeSignature??exercise.timeSignature));
  const upperShifts=planOctaveLines(upperMeasures,'treble');
  const lowerShifts=planOctaveLines(lowerMeasures,'bass');
  const prepared=exercise.measures.map((measure,index)=>{
    const meter=measure.timeSignature??exercise.timeSignature;
    const previous=index>0?exercise.measures[index-1].timeSignature??exercise.timeSignature:null;
    const notation=prepareGrandMeasure(upperMeasures[index],lowerMeasures[index],signature??'C',meter,false,upperShifts[index],lowerShifts[index]);
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
  for (const side of ['above','below'] as const) {
    rightExtent[side] += tupletSpace(prepared.flatMap(item=>item.right.tuplets), side);
    leftExtent[side] += tupletSpace(prepared.flatMap(item=>item.left.tuplets), side);
  }
  for(const [ext,shifts] of [[rightExtent,upperShifts],[leftExtent,lowerShifts]] as const){
    if(shifts.flat().some(shift=>shift>0))ext.above+=65;
    if(shifts.flat().some(shift=>shift<0))ext.below+=65;
  }
  const staffGap=130+rightExtent.below+leftExtent.above;
  const rowHeight=staffGap+150+rightExtent.above+leftExtent.below;
  const measureWidth=Math.max((width-50)/barsPerRow,...prepared.map(item=>item.neededWidth));
  const layout:ScoreLayout={width:measureWidth*barsPerRow+50,height:Math.ceil(prepared.length/barsPerRow)*rowHeight+30,measures:[]};
  const rows = Math.ceil(prepared.length / barsPerRow);
  layout.systems = Array.from({length: rows}, (_, row) => ({top: row * rowHeight, bottom: (row + 1) * rowHeight + (row === rows - 1 ? 30 : 0)}));
  const context=scoreContext(container,layout.width,layout.height,viewport);
  const octaveBars: OctaveBar[][]=[[],[]];
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
      prepareNotationForDrawing(hand,staves[i]);
      hand.voice.draw(context,staves[i]);
      hand.beams.forEach(beam=>beam.setContext(context).draw());
      hand.tuplets.forEach(tuplet=>tuplet.setContext(context).draw());
      octaveBars[i].push({notes:hand.notes, shifts:(i===0?upperShifts:lowerShifts)[index], stave:staves[i], row:Math.floor(index/barsPerRow)});
      (layout.notes ??= []).push(...collectNoteGeometry(hand.notes,index,i));
    });
    layout.measures.push({
      index,row:Math.floor(index/barsPerRow),xStart:start,xEnd:end,
      yTop:staves[0].getYForLine(0)-20-rightExtent.above,
      yBottom:staves[1].getYForLine(4)+20+leftExtent.below,
      totalUnits:exercise.measures[index].totalUnits,
      anchors:collectMeasureAnchors([item.right.notes,item.left.notes],exercise.measures[index].totalUnits,start,end),
    });
    context.save();context.setFont('Arial',10);context.setFillStyle('#64748b');
    context.fillText(String(index+1),x,y+5);context.restore();
  });
  octaveBars.forEach(bars=>drawOctaveLines(context,bars));
  container.querySelector('svg')?.setAttribute('aria-label',`${exercise.measures.length} 小節鋼琴大譜表，上方右手、下方左手`);
  return layout;
}
