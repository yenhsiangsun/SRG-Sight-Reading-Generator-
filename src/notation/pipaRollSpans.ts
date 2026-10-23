import type {RenderContext} from 'vexflow';
import type {MeasureData} from '../music';
import {drawExpressionSegments,planLocalSlur,type ExpressionBar,type ExpressionBounds,type ExpressionSegment} from './expressionSpans';

interface PlacedInk {row:number;staff:0|1;bars:number[];bounds:ExpressionBounds;kind?:string;xStart?:number;xEnd?:number;above?:boolean}
export interface PipaRollSpan extends PlacedInk {
  xStart:number;xEnd:number;rangeY:number;slur?:ExpressionSegment;
}

/** Only rows containing a continuous roll need the additional upper lane. */
export function pipaRollSpanSpace(measures:readonly MeasureData[],range:{first:number;last:number}):number {
  return measures.slice(range.first,range.last+1).some(bar=>bar.events.some(note=>note.pipaRollGroup))?20:0;
}

export function planPipaRollSpans(bars:readonly ExpressionBar[],occupied:readonly PlacedInk[]=[]):PipaRollSpan[] {
  const spans:PipaRollSpan[]=[];
  for(const bar of bars){
    const seen=new Set<string>();
    for(const event of bar.measure.events){
      const group=event.pipaRollGroup;
      if(!group||event.technique!=='pipa-roll')continue;
      const key=`${group.startUnits}:${group.endUnits}`;
      if(seen.has(key))continue;seen.add(key);
      const members=bar.measure.events.flatMap((note,index)=>note.pipaRollGroup?.startUnits===group.startUnits&&
        note.pipaRollGroup.endUnits===group.endUnits&&note.technique==='pipa-roll'&&!note.rest&&bar.notes[index]?[{note,rendered:bar.notes[index],index}]:[]);
      if(members.length<2||members[0].note.startUnits!==group.startUnits||
        members.at(-1)!.note.startUnits+members.at(-1)!.note.durationUnits!==group.endUnits)continue;
      const center=(note:typeof bar.notes[number])=>(note.getNoteHeadBeginX()+note.getNoteHeadEndX())/2;
      const xStart=center(members[0].rendered),xEnd=center(members.at(-1)!.rendered)+12;
      if(xEnd-xStart<16)continue;
      const plannedSlur=planLocalSlur(bar,members[0].index,members.at(-1)!.index);
      const duplicate=plannedSlur&&occupied.some(other=>other.kind==='slur'&&other.row===bar.row&&other.staff===bar.staff&&
        other.above===plannedSlur.above&&Math.abs(other.xStart!-plannedSlur.xStart)<.01&&Math.abs(other.xEnd!-plannedSlur.xEnd)<.01);
      const slur=duplicate?undefined:plannedSlur;
      let rangeY=Math.min(bar.stave.getYForLine(0),...members.map(({rendered:note})=>{
        let top=note.getBoundingBox().getY();
        for(const mark of note.getModifiers())if(mark.isRendered()&&mark.getCategory()!=='Annotation'){
          const box=mark.getBoundingBox();if(box.getH()>0)top=Math.min(top,box.getY());
        }
        const tuplet=note.getTuplet();if(tuplet)top=Math.min(top,tuplet.getYPosition()-12);
        return top;
      }))-10;
      // The bracket has its own upper lane. A note-anchored slur is independent
      // of that lane and may be below the notes, as in an all-up-stem group.
      for(const other of [...occupied,...spans,...(slur?[slur]:[])])if(other.row===bar.row&&other.staff===bar.staff&&
        other.bounds.xStart<xEnd&&other.bounds.xEnd>xStart&&other.bounds.yTop<rangeY+7)
        rangeY=Math.min(rangeY,other.bounds.yTop-12);
      spans.push({row:bar.row,staff:bar.staff,bars:[bar.bar],xStart,xEnd,rangeY,slur,
        bounds:{xStart:xStart-2,xEnd:xEnd+2,yTop:Math.min(rangeY-2,slur?.bounds.yTop??Infinity),
          yBottom:Math.max(rangeY+8,slur?.bounds.yBottom??-Infinity)}});
    }
  }
  return spans;
}

/** Identical vector paths are used for the on-screen SVG and exported PDF. */
export function drawPipaRollSpans(context:RenderContext,bars:readonly ExpressionBar[],occupied:readonly PlacedInk[]=[]):PipaRollSpan[] {
  const spans=planPipaRollSpans(bars,occupied);
  for(const span of spans){
    const {xStart,xEnd,rangeY}=span;
    context.save();context.setStrokeStyle('#000000').setFillStyle('#000000').setLineDash([]);
    context.openGroup('pipa-roll-range');
    context.setLineWidth(1.35).beginPath().moveTo(xStart,rangeY).lineTo(xEnd,rangeY).lineTo(xEnd,rangeY+6).stroke();
    context.closeGroup();context.restore();
    if(span.slur)drawExpressionSegments(context,[span.slur],'pipa-roll');
  }
  return spans;
}
