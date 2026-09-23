import type {Clef, MeasureData} from '../music';
import type {RenderContext, Stave, StaveNote} from 'vexflow';
import {notePitches} from '../music/notePitches';

const letters = 'cdefgab';
const staffBottom: Record<Clef, number> = {treble: 30, bass: 18, alto: 24, tenor: 22};
// Limit displacement to one octave; preserve the remaining ledger lines.
const shifts = [0, 1, -1];
export function ledgerCount(key: string, clef: Clef, shift = 0) {
  const [name, octave] = key.split('/');
  const position = Number(octave) * 7 + letters.indexOf(name[0].toLowerCase()) - shift * 7;
  const bottom = staffBottom[clef];
  return Math.max(0, Math.floor((bottom - position) / 2), Math.floor((position - bottom - 8) / 2));
}

/** Written-pitch only. MIDI, timing and the original exercise remain untouched. */
export function planOctaveLines(measures: readonly MeasureData[], clef: Clef, clefPlan: Clef[][] = []): number[][] {
  const events = measures.flatMap(measure => measure.events);
  const eventClefs = clefPlan.flat();
  if (!events.length) return measures.map(() => []);
  const parents: number[][] = [];
  let costs: number[] = shifts.map(shift => shift === 0 ? 0 : 8);
  events.forEach((event,eventIndex) => {
    const parent: number[] = [];
    const next = shifts.map((shift, index) => {
      const ledger = Math.max(0,...notePitches(event).map(pitch => ledgerCount(pitch.key,eventClefs[eventIndex] ?? clef,shift)));
      // Four or more ledger lines strongly favor displacement. A transition cost
      // keeps neighboring pitches in one readable passage instead of flickering.
      const emission = event.rest ? 0 : Math.max(0, ledger - 3) ** 2 * 100 + ledger * ledger + Math.abs(shift) * 10;
      let best = 0;
      costs.forEach((cost, previous) => {
        if (cost + (previous === index ? 0 : 8) < costs[best] + (best === index ? 0 : 8)) best = previous;
      });
      parent.push(best);
      return costs[best] + (best === index ? 0 : 8) + emission;
    });
    parents.push(parent);
    costs = next;
  });
  let index = costs.indexOf(Math.min(...costs));
  const result = Array<number>(events.length);
  for (let i = events.length - 1; i >= 0; i--) {result[i] = shifts[index]; index = parents[i][index];}
  // Unaccompanied silence does not need an octave instruction.
  let first = events.findIndex(event => !event.rest);
  if (first < 0) first = events.length;
  result.fill(0, 0, first);
  let last = events.length - 1;
  while (last >= 0 && events[last].rest) result[last--] = 0;
  let offset = 0;
  return measures.map(measure => {const row = result.slice(offset, offset + measure.events.length); offset += measure.events.length; return row;});
}

export function octaveWrittenKey(key: string, shift: number) {
  const [name, octave] = key.split('/');
  return `${name}/${Number(octave) - shift}`;
}

export interface OctaveBar {notes: StaveNote[]; shifts: number[]; stave: Stave; row: number; clefs?: Clef[]}
/** Combine bars, then split only at system breaks, repeating the sign in parentheses. */
export function drawOctaveLines(context: RenderContext, bars: OctaveBar[]) {
  const entries = bars.flatMap(bar => bar.notes.map((note, index) => ({note, shift: bar.shifts[index] ?? 0, clef:bar.clefs?.[index], bar})));
  const placed: {row:number;top:boolean;x:number;end:number;y:number}[] = [];
  for (let start = 0; start < entries.length;) {
    const first = entries[start];
    if (!first.shift) {start++; continue;}
    let end = start;
    while (end + 1 < entries.length && entries[end + 1].shift === first.shift && entries[end + 1].clef === first.clef && entries[end + 1].bar.row === first.bar.row) end++;
    const last = entries[end];
    const continued = start > 0 && entries[start - 1].shift === first.shift && entries[start - 1].clef === first.clef;
    const continues = end + 1 < entries.length && entries[end + 1].shift === first.shift && entries[end + 1].clef === first.clef;
    const top = first.shift > 0;
    const boxes = entries.slice(start, end + 1).map(entry => entry.note.getBoundingBox());
    let y = top ? Math.min(first.bar.stave.getYForLine(0) - 45, ...boxes.map(box => box.getY() - 18))
      : Math.max(first.bar.stave.getYForLine(4) + 45, ...boxes.map(box => box.getY() + box.getH() + 23));
    // Tuplet numbers are outside StaveNote boxes, on either side of the staff.
    for(const entry of entries.slice(start,end+1)) {
      const tuplet=entry.note.getTuplet();
      if(tuplet)y=top ? Math.min(y,tuplet.getYPosition()-20) : Math.max(y,tuplet.getYPosition()+25);
    }
    const x = first.note.getAbsoluteX() - 4;
    const endX = continues ? last.bar.stave.getNoteEndX() : last.note.getAbsoluteX() + 14;
    const label = top ? '8va' : '8vb';
    const text = continued ? `(${label})` : label;
    context.save();
    context.openGroup('octave-line');
    context.setFillStyle('#111827').setStrokeStyle('#111827').setFont('Arial', 12, 'normal', 'italic').setLineWidth(1);
    const textEnd = x + context.measureText(text).width;
    // A short note can be narrower than its label. Keep neighboring octave
    // signs legible without moving the rhythmic onsets or playback anchors.
    while (placed.some(item => item.row === first.bar.row && item.top === top && x < item.end + 6 && textEnd + 6 > item.x && Math.abs(y-item.y) < 18)) y += top ? -20 : 20;
    placed.push({row:first.bar.row,top,x,end:Math.max(textEnd,endX),y});
    context.fillText(text, x, y);
    const lineStart = x + context.measureText(text).width + 5;
    if (endX > lineStart) {
      context.setLineDash([4, 3]).beginPath().moveTo(lineStart, y - 4).lineTo(endX, y - 4).stroke();
    }
    if (!continues && endX > lineStart) context.setLineDash([]).beginPath().moveTo(endX, y - 4).lineTo(endX, y - 4 + (top ? 7 : -7)).stroke();
    context.closeGroup();
    context.restore();
    start = end + 1;
  }
}
