import type {RenderContext, Stave, StaveNote} from 'vexflow';
import type {ExerciseData, ExpressionSpan, MeasureData} from '../music';
import {scoreExpressionSpans} from '../music/expressionSpans';
import {rhythmTicks} from '../music/rhythmTiming';

export interface ExpressionBar {
  bar: number; row: number; staff: 0 | 1;
  stave: Stave; notes: StaveNote[]; measure: MeasureData;
}
export interface ExpressionBounds {xStart: number; xEnd: number; yTop: number; yBottom: number}
interface Entry {bar: ExpressionBar; note: StaveNote; event: number}
export interface ExpressionSegment {
  kind: ExpressionSpan['kind']; staff: 0 | 1; row: number;
  xStart: number; xEnd: number; startY: number; endY: number; controlLift: number;
  startOpening: number; endOpening: number; above: boolean;
  bounds: ExpressionBounds; bars: number[];
}

/** Keep extra expression room only on staves that actually contain spans. */
export function expressionSpace(exercise: ExerciseData, staff: 0 | 1) {
  const spans = scoreExpressionSpans(exercise).filter(span=>span.staff===staff);
  return {above:spans.some(span=>span.kind==='slur')?24:0,
    below:spans.some(span=>span.kind!=='slur')?38:spans.length?24:0};
}

function entriesForSpan(exercise: ExerciseData, span: ExpressionSpan, bars: readonly ExpressionBar[]): Entry[] {
  const source = span.staff === 0 ? exercise.measures : exercise.lowerMeasures!;
  const entries: Entry[] = [];
  for (const bar of bars) {
    if (bar.staff !== span.staff || bar.bar < span.start.bar || bar.bar > span.end.bar) continue;
    const first = bar.bar === span.start.bar ? span.start.event : 0;
    const last = bar.bar === span.end.bar ? span.end.event : source[bar.bar].events.length - 1;
    for (let event = first; event <= last; event++) {
      const original = source[bar.bar].events[event];
      if (original.rest) continue;
      // Simplified silence may change engraved indexes, but every sounded onset
      // remains. Never index rendered notes using the original event ordinal.
      const index = bar.measure.events.findIndex(note=>!note.rest && rhythmTicks(note.startUnits)===rhythmTicks(original.startUnits));
      if (index >= 0 && bar.notes[index]) entries.push({bar,note:bar.notes[index],event});
    }
  }
  return entries.sort((a,b)=>a.bar.bar-b.bar.bar || a.event-b.event);
}

function noteEdge(note: StaveNote, above: boolean) {
  return above ? Math.min(...note.getYs()) : Math.max(...note.getYs());
}

/** Formatted notehead bounds, including displaced seconds, rather than a fixed glyph offset. */
function headCenter(note: StaveNote) {
  return (note.getNoteHeadBeginX()+note.getNoteHeadEndX())/2;
}

function curveEdge(note: StaveNote, above: boolean) {
  let edge = noteEdge(note,above);
  // A mixed-stem phrase may put the curve on the stem side of some notes.
  // Clear their full stems and outer primary beam, not just the noteheads.
  if (note.hasStem() && (above ? note.getStemDirection()>0 : note.getStemDirection()<0)) {
    const stem=note.getStemExtents(),beam=note.getBeam(),air=beam?(beam.renderOptions.beamWidth??5)+2:2;
    edge=above?Math.min(edge,stem.topY-air):Math.max(edge,stem.topY+air);
  }
  for (const modifier of note.getModifiers()) {
    // Accidentals and inline clefs do not occupy a slur lane. Articulations and
    // instrument marks need air around them; dynamics have their own lower lane.
    if (!modifier.isRendered() || ['Annotation','Accidental','NoteSubGroup'].includes(modifier.getCategory())) continue;
    const box = modifier.getBoundingBox();
    if (box.getH() <= 0) continue;
    edge = above ? Math.min(edge,box.getY()) : Math.max(edge,box.getY()+box.getH());
  }
  const tuplet = note.getTuplet();
  if (tuplet) {
    const y = tuplet.getYPosition();
    if ((above && y < edge) || (!above && y > edge)) edge = y + (above ? -12 : 12);
  }
  return edge;
}

function curveY(startY:number,endY:number,lift:number,t:number) {
  return startY+(endY-startY)*t+3*t*(1-t)*lift;
}

function slurBounds(xStart:number,xEnd:number,startY:number,endY:number,lift:number,above:boolean):ExpressionBounds {
  const values=[startY,endY];
  // Exact extrema of both sides of the painted tapered curve; using control
  // points as the box made long arcs reserve considerably more room than ink.
  for (const height of [lift,lift+(above?-3:3)]) {
    const t=.5+(endY-startY)/(6*height);
    if (t>0&&t<1) values.push(curveY(startY,endY,height,t));
  }
  return {xStart:xStart-1,xEnd:xEnd+1,yTop:Math.min(...values)-4,yBottom:Math.max(...values)+4};
}

function slurSegment(members:Entry[],all:Entry[],bars:readonly ExpressionBar[],span:ExpressionSpan,above:boolean):ExpressionSegment|undefined {
  const first=members[0],last=members.at(-1)!,continued=first!==all[0],continues=last!==all.at(-1);
  const xStart=continued?first.bar.stave.getNoteStartX()-6:headCenter(first.note);
  const xEnd=continues?last.bar.stave.getNoteEndX()-5:headCenter(last.note);
  if (xEnd-xStart<8) return;
  const direction=above?-1:1,startY=curveEdge(first.note,above)+direction*8,endY=curveEdge(last.note,above)+direction*8;
  let lift=12;
  for (const entry of members) {
    const points=[headCenter(entry.note),...(entry.note.hasStem()?[entry.note.getStemX()]:[])];
    for (const x of points) {
      const t=(x-xStart)/(xEnd-xStart);
      if (t<=.001||t>=.999) continue;
      const straight=startY+(endY-startY)*t,required=direction*(curveEdge(entry.note,above)+direction*8-straight);
      lift=Math.max(lift,required/(3*t*(1-t)));
    }
  }
  const controlLift=direction*lift,row=first.bar.row;
  return {kind:'slur',staff:span.staff,row,xStart,xEnd,startY,endY,controlLift,startOpening:0,endOpening:0,above,
    bars:bars.filter(bar=>bar.row===row&&bar.staff===span.staff&&bar.bar>=first.bar.bar&&bar.bar<=last.bar.bar).map(bar=>bar.bar),
    bounds:slurBounds(xStart,xEnd,startY,endY,controlLift,above)};
}

function slurCost(segments:ExpressionSegment[],entries:Entry[],above:boolean) {
  let distance=0;
  for (const entry of entries) {
    const segment=segments.find(segment=>segment.row===entry.bar.row);
    if (!segment) continue;
    const t=Math.max(0,Math.min(1,(headCenter(entry.note)-segment.xStart)/(segment.xEnd-segment.xStart)));
    distance+=(above?-1:1)*(curveY(segment.startY,segment.endY,segment.controlLift,t)-noteEdge(entry.note,above));
  }
  const directions=new Set(entries.map(entry=>entry.note.getStemDirection()));
  // Mixed stems conventionally favor an upper phrase arc when equally clear.
  return distance/entries.length+segments.reduce((sum,segment)=>sum+(segment.bounds.yBottom-segment.bounds.yTop)*.04,0)+
    (directions.size>1&&!above?6:0);
}

/** Expand only a system whose actual expression ink exceeds its allocated box. */
export function expressionOverflow(segments:readonly Pick<ExpressionSegment,'row'|'bounds'>[],systems:readonly {top:number;bottom:number}[]) {
  let above=0,below=0;
  for (const segment of segments) {
    const system=systems[segment.row];if (!system) continue;
    above=Math.max(above,system.top+12-segment.bounds.yTop);
    below=Math.max(below,segment.bounds.yBottom-(system.bottom-12));
  }
  return {above:Math.ceil(above),below:Math.ceil(below)};
}

/** Geometry is shared by the SVG screen and canvas PDF renderer. A span crossing
 * a system is split visually, retaining its original musical start and end. */
export function planExpressionDrawing(exercise: ExerciseData, bars: readonly ExpressionBar[]): ExpressionSegment[] {
  const segments: ExpressionSegment[] = [];
  for (const span of scoreExpressionSpans(exercise).slice().sort((a,b)=>Number(b.kind==='slur')-Number(a.kind==='slur'))) {
    const entries = entriesForSpan(exercise,span,bars);
    if (entries.length < 2) continue;
    const rows = [...new Set(entries.map(entry=>entry.bar.row))];
    if (span.kind==='slur') {
      const choices=[true,false].map(above=>{
        const paths=rows.flatMap(row=>{
          const segment=slurSegment(entries.filter(entry=>entry.bar.row===row),entries,bars,span,above);return segment?[segment]:[];
        });
        return {paths,cost:slurCost(paths,entries,above)};
      });
      segments.push(...choices.reduce((best,choice)=>choice.cost<best.cost?choice:best).paths);
      continue;
    }
    for (const row of rows) {
      const members = entries.filter(entry=>entry.bar.row===row);
      const first = members[0], last = members.at(-1)!;
      const continued = first !== entries[0], continues = last !== entries.at(-1);
      const xStart = continued ? first.bar.stave.getNoteStartX()-6 : headCenter(first.note);
      const xEnd = continues ? last.bar.stave.getNoteEndX()-5 : headCenter(last.note);
      if (xEnd-xStart < 8) continue;
      const rowBars = bars.filter(bar=>bar.row===row && bar.staff===span.staff && bar.bar>=first.bar.bar && bar.bar<=last.bar.bar);
      const touched = rowBars.map(bar=>bar.bar);
      // Hairpins sit beneath notes, beams, triplet numerals, dynamics and slurs.
      const notes = rowBars.flatMap(bar=>bar.notes);
      let y = Math.max(first.bar.stave.getYForLine(4)+44,...notes.map(note=>{
        const box=note.getBoundingBox();return box.getY()+box.getH()+18;
      }));
      for (const note of notes) {
        const tuplet=note.getTuplet();if(tuplet)y=Math.max(y,tuplet.getYPosition()+26);
        for (const modifier of note.getModifiers()) {
          if (!modifier.isRendered()) continue;
          const box=modifier.getBoundingBox();if(box.getH()>0)y=Math.max(y,box.getY()+box.getH()+17);
        }
      }
      for (const previous of segments) if (previous.row===row && previous.staff===span.staff &&
        previous.xStart<xEnd && previous.xEnd>xStart) y=Math.max(y,previous.bounds.yBottom+18);
      const startProgress = entries.indexOf(first)/(entries.length-1), endProgress = entries.indexOf(last)/(entries.length-1);
      const opening = (progress: number) => (span.kind==='crescendo'?progress:1-progress)*7;
      const startOpening = continued ? Math.max(1,opening(startProgress)) : span.kind==='crescendo'?0:7;
      const endOpening = continues ? Math.max(1,opening(endProgress)) : span.kind==='crescendo'?7:0;
      segments.push({kind:span.kind,staff:span.staff,row,xStart,xEnd,startY:y,endY:y,controlLift:0,
        startOpening,endOpening,above:false,bars:touched,bounds:{xStart,xEnd,yTop:y-7,yBottom:y+7}});
    }
  }
  return segments;
}

export function drawExpressionSpans(context: RenderContext, exercise: ExerciseData, bars: readonly ExpressionBar[]) {
  const segments = planExpressionDrawing(exercise,bars);
  for (const segment of segments) {
    const {xStart,xEnd,startY,endY,controlLift}=segment, width=xEnd-xStart;
    context.save();context.openGroup(`expression-${segment.kind}`);
    context.setFillStyle('#000000').setStrokeStyle('#000000').setLineWidth(1.1);
    if (segment.kind==='slur') {
      // A tapered filled curve with a light outline stays readable on tablets,
      // including its tips, and uses identical ink in screen and PDF rendering.
      const thickness = segment.above ? -3 : 3;
      const rise=(endY-startY)/3;
      context.setLineWidth(.7);
      context.beginPath().moveTo(xStart,startY)
        .bezierCurveTo(xStart+width/3,startY+rise+controlLift,xEnd-width/3,endY-rise+controlLift,xEnd,endY)
        .bezierCurveTo(xEnd-width/3,endY-rise+controlLift+thickness,xStart+width/3,startY+rise+controlLift+thickness,xStart,startY)
        .closePath().fill().stroke();
    } else {
      context.beginPath().moveTo(xStart,startY-segment.startOpening).lineTo(xEnd,endY-segment.endOpening)
        .moveTo(xStart,startY+segment.startOpening).lineTo(xEnd,endY+segment.endOpening).stroke();
    }
    context.closeGroup();context.restore();
  }
  return segments;
}
