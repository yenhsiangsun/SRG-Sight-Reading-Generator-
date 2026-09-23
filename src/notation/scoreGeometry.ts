import { VexFlow, type StaveNote } from 'vexflow';
import type { ExerciseData } from '../music';
import { measureTimeline } from '../audio/tempo';
import {addRhythmUnits} from '../music/rhythmTiming';

export interface TimeAnchor {
  /** Sixteenth-note units from the beginning of this measure. */
  units: number;
  x: number;
}

export interface MeasureGeometry {
  index: number;
  row: number;
  xStart: number;
  xEnd: number;
  yTop: number;
  yBottom: number;
  totalUnits: number;
  anchors: TimeAnchor[];
}

export interface ScoreLayout {
  systems?: {top: number; bottom: number}[];
  notes?: NoteGeometry[];
  width: number;
  height: number;
  measures: MeasureGeometry[];
}

export interface NoteGeometry {measure:number;staff:number;units:number;x:number;y:number}

export function collectNoteGeometry(notes: readonly StaveNote[], measure:number, staff:number): NoteGeometry[] {
  let units=0;
  return notes.flatMap(note=>{
    const start=units;
    units=addRhythmUnits(units,note.getTicks().value()*16/VexFlow.RESOLUTION);
    return note.isRest()?[]:[{measure,staff,units:start,x:note.getAbsoluteX()+5,y:note.getYs()[0]}];
  });
}

export interface ScoreCursor {
  x: number;
  y: number;
  height: number;
  row: number;
  measureIndex: number;
  units: number;
  seconds: number;
}

/** Read the formatted voices, including simplified rests, rather than indexing the original events. */
export function collectMeasureAnchors(
  noteGroups: readonly (readonly StaveNote[])[], totalUnits: number, xStart: number, xEnd: number,
): TimeAnchor[] {
  const onsets = new Map<number, { x: number; centered: boolean }>();
  for (const notes of noteGroups) {
    let units = 0;
    for (const note of notes) {
      const centered = note.isCenterAligned();
      // Centered whole-bar rests are glyph placement, not a musical time position.
      // getAbsoluteX uses the shared tick context; normal notes in either staff agree.
      const x = centered ? xStart : note.getAbsoluteX();
      const existing = onsets.get(units);
      if (!existing || (existing.centered && !centered)) onsets.set(units, { x, centered });
      units = addRhythmUnits(units,note.getTicks().value() * 16 / VexFlow.RESOLUTION);
    }
  }
  if (!onsets.has(0)) onsets.set(0, { x: xStart, centered: false });
  const anchors = [...onsets.entries()]
    .filter(([units]) => units < totalUnits)
    .sort(([a], [b]) => a - b)
    .map(([units, { x }]) => ({ units, x: Math.max(xStart, Math.min(xEnd, x)) }));
  anchors.push({ units: totalUnits, x: xEnd });
  return anchors;
}

function interpolateX(measure: MeasureGeometry, units: number) {
  const anchors = measure.anchors;
  if (units <= anchors[0].units) return anchors[0].x;
  for (let i = 1; i < anchors.length; i++) {
    const right = anchors[i], left = anchors[i - 1];
    if (units <= right.units) {
      const fraction = (units - left.units) / (right.units - left.units);
      return left.x + (right.x - left.x) * fraction;
    }
  }
  return measure.xEnd;
}

/** Interpolate only inside the current bar, so system changes never travel diagonally across the page. */
export function findCursor(layout: ScoreLayout, exercise: ExerciseData, bpm: number, seconds: number): ScoreCursor | null {
  if (!layout.measures.length || !exercise.measures.length) return null;
  const timeline = measureTimeline(exercise, bpm);
  const last = timeline[timeline.length - 1];
  const time = Math.max(0, Math.min(last.start + last.duration, Number.isFinite(seconds) ? seconds : 0));
  let index = timeline.findIndex(bar => time < bar.start + bar.duration);
  if (index < 0) index = timeline.length - 1;
  const measure = layout.measures.find(item => item.index === index);
  if (!measure) return null;
  const bar = timeline[index];
  const units = Math.max(0, Math.min(measure.totalUnits, (time - bar.start) / bar.secondsPerUnit));
  return {
    x: interpolateX(measure, units), y: measure.yTop,
    height: measure.yBottom - measure.yTop, row: measure.row,
    measureIndex: index, units, seconds: time,
  };
}

function distanceToRange(value: number, start: number, end: number) {
  return value < start ? start - value : value > end ? value - end : 0;
}

/** Score-space pointer coordinates select the nearest row, bar, and notated onset in either staff. */
export function hitTest(layout: ScoreLayout, exercise: ExerciseData, bpm: number, x: number, y: number): number {
  if (!layout.measures.length || !Number.isFinite(x) || !Number.isFinite(y)) return 0;
  const closestRow = layout.measures.reduce((best, measure) =>
    distanceToRange(y, measure.yTop, measure.yBottom) < distanceToRange(y, best.yTop, best.yBottom) ? measure : best,
  ).row;
  const row = layout.measures.filter(measure => measure.row === closestRow);
  const measure = row.reduce((best, item) =>
    distanceToRange(x, item.xStart, item.xEnd) < distanceToRange(x, best.xStart, best.xEnd) ? item : best,
  );
  // The final barline is an interpolation endpoint, not a playable onset.
  const onsets = measure.anchors.filter(anchor => anchor.units < measure.totalUnits);
  const nearest = onsets.reduce((best, anchor) => Math.abs(anchor.x - x) < Math.abs(best.x - x) ? anchor : best);
  const bar = measureTimeline(exercise, bpm)[measure.index];
  return bar ? bar.start + nearest.units * bar.secondsPerUnit : 0;
}
