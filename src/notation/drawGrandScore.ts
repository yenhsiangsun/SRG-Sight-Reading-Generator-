import {simplifyStaffRests} from './simplifyStaffRests';
import { BarlineType, Formatter, Stave, StaveConnector } from 'vexflow';
import type { ExerciseData, MeasureData, TimeSignature } from '../music';
import { createMeasureNotation, prepareNotationForDrawing } from './createMeasureNotation';
import {planOctaveLines, drawOctaveLines, type OctaveBar} from './octaveLines';
import { collectMeasureAnchors, collectNoteGeometry, type ScoreLayout } from './scoreGeometry';
import {tupletSpace} from './ScoreTuplet';
import {scoreContext, type ScoreViewport} from './scoreRenderer';
import {drawExpressionSpans, expressionOverflow, expressionSpace, type ExpressionBar} from './expressionSpans';
import {drawPipaRollSpans,pipaRollSpanSpace} from './pipaRollSpans';

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
  return drawGrandPass(container,exercise,width,viewport,{above:0,below:0,between:0},true);
}

function drawGrandPass(container: HTMLDivElement | HTMLCanvasElement, exercise: ExerciseData, width: number, viewport: ScoreViewport|undefined,
  padding:{above:number;below:number;between:number},canCorrect:boolean):ScoreLayout {
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
  const rows=Math.ceil(prepared.length/barsPerRow);
  const rowSpace=Array.from({length:rows},(_,row)=>{
    const first=row*barsPerRow,last=Math.min(prepared.length-1,first+barsPerRow-1),items=prepared.slice(first,last+1);
    const rightExtent=extent(items.flatMap(item=>item.right.notes)),leftExtent=extent(items.flatMap(item=>item.left.notes));
    for(const [staff,ext] of [[0,rightExtent],[1,leftExtent]] as const){
      const space=expressionSpace(exercise,staff,{first,last});ext.above+=space.above;ext.below+=space.below;
      ext.above+=pipaRollSpanSpace(staff===0?upperMeasures:lowerMeasures,{first,last});
    }
    for(const side of ['above','below'] as const){
      rightExtent[side]+=tupletSpace(items.flatMap(item=>item.right.tuplets),side);
      leftExtent[side]+=tupletSpace(items.flatMap(item=>item.left.tuplets),side);
    }
    for(const [ext,shifts] of [[rightExtent,upperShifts],[leftExtent,lowerShifts]] as const){
      const local=shifts.slice(first,last+1).flat();
      if(local.some(shift=>shift>0))ext.above+=65;
      if(local.some(shift=>shift<0))ext.below+=65;
    }
    rightExtent.above+=padding.above;rightExtent.below+=padding.between;leftExtent.below+=padding.below;
    const staffGap=130+rightExtent.below+leftExtent.above;
    return {rightExtent,leftExtent,staffGap,height:staffGap+150+rightExtent.above+leftExtent.below};
  });
  const measureWidth=Math.max((width-50)/barsPerRow,...prepared.map(item=>item.neededWidth));
  let totalHeight=0;
  const systems=rowSpace.map(space=>{const top=totalHeight;totalHeight+=space.height;return {top,bottom:totalHeight};});
  if(systems.length)systems.at(-1)!.bottom+=30;
  const layout:ScoreLayout={width:measureWidth*barsPerRow+50,height:totalHeight+30,measures:[],systems};
  const context=scoreContext(container,layout.width,layout.height,viewport);
  const octaveBars: OctaveBar[][]=[[],[]];
  const expressionBars: ExpressionBar[]=[];
  prepared.forEach((item,index)=>{
    const row=Math.floor(index/barsPerRow),{rightExtent,leftExtent,staffGap}=rowSpace[row];
    const x=30+(index%barsPerRow)*measureWidth;
    const y=systems[row].top+25+rightExtent.above;
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
      expressionBars.push({bar:index,row:Math.floor(index/barsPerRow),staff:i as 0|1,notes:hand.notes,measure:(i===0?upperMeasures:lowerMeasures)[index],stave:staves[i]});
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
  const expressions=drawExpressionSpans(context,exercise,expressionBars);
  const rolls=drawPipaRollSpans(context,expressionBars,expressions),ink=[...expressions,...rolls];
  const octaveBounds:Array<{row:number;bounds:{xStart:number;xEnd:number;yTop:number;yBottom:number}}> = [];
  octaveBars.forEach((bars,staff)=>{
    bars.forEach((bar,index)=>{bar.expressionBounds=ink.filter(span=>span.staff===staff&&span.bars.includes(index)).map(span=>span.bounds);});
    octaveBounds.push(...drawOctaveLines(context,bars));
  });
  const overflow=expressionOverflow([...ink,...octaveBounds],layout.systems!);
  let between=0;
  for (let row=0;row<rows;row++) {
    const handBounds=([0,1] as const).map(staff=>{
      const notes=expressionBars.filter(bar=>bar.row===row&&bar.staff===staff).flatMap(bar=>bar.notes);
      const handInk=ink.filter(span=>span.row===row&&span.staff===staff);
      return {top:Math.min(...notes.map(note=>note.getBoundingBox().getY()),...handInk.map(span=>span.bounds.yTop)),
        bottom:Math.max(...notes.map(note=>{const box=note.getBoundingBox();return box.getY()+box.getH();}),...handInk.map(span=>span.bounds.yBottom))};
    });
    between=Math.max(between,handBounds[0].bottom+12-handBounds[1].top);
  }
  if (canCorrect&&ink.length>0&&(overflow.above||overflow.below||between>0)) {
    if (!viewport) container.replaceChildren();
    return drawGrandPass(container,exercise,width,viewport,{...overflow,between:Math.ceil(Math.max(0,between))},false);
  }
  container.querySelector('svg')?.setAttribute('aria-label',`${exercise.measures.length} 小節鋼琴大譜表，上方右手、下方左手`);
  return layout;
}
