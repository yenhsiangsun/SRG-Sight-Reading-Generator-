import { BarlineType, Formatter, Stave } from 'vexflow';
import type { ExerciseData } from '../music';
import { createMeasureNotation, prepareNotationForDrawing } from './createMeasureNotation';
import { simplifyStaffRests } from './simplifyStaffRests';
import {drawOctaveLines, type OctaveBar} from './octaveLines';
import { collectMeasureAnchors, collectNoteGeometry, type MeasureGeometry, type ScoreLayout } from './scoreGeometry';
import {planSingleStaff} from './mixedStaff';
import {tupletSpace} from './ScoreTuplet';
import {scoreContext, type ScoreViewport} from './scoreRenderer';
import {drawExpressionSpans, expressionOverflow, expressionSpace, type ExpressionBar} from './expressionSpans';

export function drawSingleScore(container: HTMLDivElement | HTMLCanvasElement, exercise: ExerciseData, width: number, viewport?: ScoreViewport): ScoreLayout {
  return drawSinglePass(container,exercise,width,viewport,{above:0,below:0},true);
}

function drawSinglePass(container: HTMLDivElement | HTMLCanvasElement, exercise: ExerciseData, width: number, viewport: ScoreViewport|undefined,
  padding:{above:number;below:number},canCorrect:boolean):ScoreLayout {
  const octaveAnnotation = exercise.transposition === 12 ? '8va' : exercise.transposition === -12 ? '8vb' : undefined;
  const barsPerRow = width < 720 ? 1 : 2;
  const rows = Math.ceil(exercise.measures.length / barsPerRow);
  const signature = exercise.tonality ? exercise.tonality.signature : exercise.keySignature;
  const measures = exercise.measures.map(measure => simplifyStaffRests(measure, measure.timeSignature ?? exercise.timeSignature));
  const {clefs,shifts} = planSingleStaff(exercise,measures);
  const prepared = exercise.measures.map((measure, index) => {
    const meter = measure.timeSignature ?? exercise.timeSignature;
    const previousMeter = index > 0 ? exercise.measures[index - 1].timeSignature ?? exercise.timeSignature : null;
    const firstOfRow = index % barsPerRow === 0;
    const startClef = clefs[index][0] ?? exercise.clef;
    const lastClef = clefs[index].at(-1) ?? startClef;
    const previousClef = index > 0 ? clefs[index-1].at(-1) ?? exercise.clef : startClef;
    const endClef = (index+1)%barsPerRow === 0 && clefs[index+1]?.[0] !== lastClef ? clefs[index+1]?.[0] : undefined;
    const notation = createMeasureNotation(measures[index], firstOfRow ? startClef : previousClef, signature ?? 'C', meter, shifts[index], clefs[index], octaveAnnotation);
    const showTime = index === 0 || meter !== previousMeter;
    const measuringStave = new Stave(0, 0, 400);
    if (firstOfRow) { measuringStave.addClef(startClef, undefined, octaveAnnotation); if (signature) measuringStave.addKeySignature(signature); }
    if (endClef) measuringStave.addEndClef(endClef,'small',octaveAnnotation);
    if (showTime) measuringStave.addTimeSignature(meter);
    const formatter = new Formatter().joinVoices([notation.voice]);
    const minWidth = formatter.preCalculateMinTotalWidth([notation.voice]);
    return { ...notation, formatter, meter, firstOfRow, showTime, startClef, endClef,
      neededWidth: minWidth + measuringStave.getNoteStartX() + (firstOfRow ? 18 : 10) + 48 + (endClef ? 40 : 0) };
  });
  // Keep equal bars per row (one on phones, two on wider screens). Dense music expands horizontally instead of colliding.
  const measureWidth = Math.max((width - 20) / barsPerRow, ...prepared.map(item => item.neededWidth));
  const lines = prepared.flatMap(item => item.notes.filter(note => !note.isRest()).flatMap(note => note.getKeyProps().map(key => key.line)));
  const expressionExtent=expressionSpace(exercise,0);
  const above = Math.max(0, (Math.max(5, ...lines) - 5) * 10) + (shifts.flat().some(shift => shift > 0) ? 65 : 0)
    + tupletSpace(prepared.flatMap(item=>item.tuplets), 'above') + expressionExtent.above + padding.above;
  const below = Math.max(0, (1 - Math.min(1, ...lines)) * 10) + (shifts.flat().some(shift => shift < 0) ? 65 : 0)
    + tupletSpace(prepared.flatMap(item=>item.tuplets), 'below') + expressionExtent.below + padding.below;
  const rowHeight = Math.max(180, 140 + above + below);
  const layout: ScoreLayout = { width: measureWidth * barsPerRow + 20, height: rows * rowHeight + 45, measures: [] };
  layout.systems = Array.from({length: rows}, (_, row) => ({top: row * rowHeight, bottom: (row + 1) * rowHeight + (row === rows - 1 ? 45 : 0)}));
  const context = scoreContext(container, layout.width, layout.height, viewport);
  const octaveBars: OctaveBar[] = [];
  const expressionBars: ExpressionBar[]=[];
  prepared.forEach((item, index) => {
    const row = Math.floor(index / barsPerRow);
    const x = 10 + (index % barsPerRow) * measureWidth;
    const y = row * rowHeight + 25 + above;
    const stave = new Stave(x, y, measureWidth);
    if (item.firstOfRow) { stave.addClef(item.startClef, undefined, octaveAnnotation); if (signature) stave.addKeySignature(signature); }
    if (item.endClef) stave.addEndClef(item.endClef,'small',octaveAnnotation);
    if (item.showTime) stave.addTimeSignature(item.meter);
    stave.setBegBarType(index > 0 && item.firstOfRow ? BarlineType.SINGLE : BarlineType.NONE);
    stave.setEndBarType(index === prepared.length - 1 ? BarlineType.END : BarlineType.SINGLE);
    stave.setContext(context).draw();
    stave.setNoteStartX(stave.getNoteStartX() + (item.firstOfRow ? 18 : 10));
    item.formatter.format([item.voice], Math.max(60, stave.getNoteEndX() - stave.getNoteStartX() - 12));
    prepareNotationForDrawing(item,stave);
    item.voice.draw(context, stave);
    item.beams.forEach(beam => beam.setContext(context).draw());
    item.tuplets.forEach(tuplet => tuplet.setContext(context).draw());
    octaveBars.push({notes:item.notes, shifts:shifts[index], stave, row, clefs:clefs[index]});
    expressionBars.push({bar:index,row,staff:0,notes:item.notes,measure:measures[index],stave});
    const geometry: MeasureGeometry = {
      index, row, xStart: stave.getNoteStartX(), xEnd: stave.getNoteEndX(),
      yTop: stave.getYForLine(0) - 20 - above, yBottom: stave.getYForLine(4) + 20 + below,
      totalUnits: exercise.measures[index].totalUnits,
      anchors: collectMeasureAnchors([item.notes], exercise.measures[index].totalUnits, stave.getNoteStartX(), stave.getNoteEndX()),
    };
    layout.measures.push(geometry);
    (layout.notes ??= []).push(...collectNoteGeometry(item.notes,index,0));
    context.save();
    context.setFont('Arial', 10);
    context.setFillStyle('#7d8492');
    context.fillText(String(index + 1), x + 1, y + 8);
    context.restore();
  });
  const expressions=drawExpressionSpans(context,exercise,expressionBars);
  octaveBars.forEach((bar,index)=>{bar.expressionBounds=expressions.filter(span=>span.bars.includes(index)).map(span=>span.bounds);});
  const octaveBounds=drawOctaveLines(context, octaveBars);
  const overflow=expressionOverflow([...expressions,...octaveBounds],layout.systems!);
  if (canCorrect&&expressions.length>0&&(overflow.above||overflow.below)) {
    // One correction only, driven by actual ink. PDF pagination receives this
    // final layout, and canvas/SVG repeat exactly the same geometry calculation.
    if (!viewport) container.replaceChildren();
    return drawSinglePass(container,exercise,width,viewport,overflow,false);
  }
  return layout;
}
