import test from 'node:test';
import assert from 'node:assert/strict';
import { loadModule } from './helpers.mjs';
import * as VF from 'vexflow';

// Musical tick positions use real VexFlow; approximate font metrics do not claim visual layout coverage.
globalThis.document = { createElement: () => ({ style: {
  fontFamily: 'Bravura', fontSize: '30px', fontWeight: 'normal', fontStyle: 'normal',
  set font(value) { const match = value.match(/([\d.]+(?:px|pt))\s+(.+)$/); if (match) { this.fontSize = match[1]; this.fontFamily = match[2]; } },
} }) };
VF.Element.setTextMeasurementCanvas({ getContext: () => ({ measureText: text => ({ width: text.length * 8, actualBoundingBoxLeft: 0, actualBoundingBoxRight: text.length * 8, actualBoundingBoxAscent: 12, actualBoundingBoxDescent: 3, fontBoundingBoxAscent: 12, fontBoundingBoxDescent: 3 }) }) });
const { collectMeasureAnchors, findCursor, hitTest } = loadModule('src/notation/scoreGeometry.ts', 1, undefined, { vexflow: VF });
const { prepareGrandMeasure } = loadModule('src/notation/drawGrandScore.ts', 1, undefined, { vexflow: VF });
const { createMeasureNotation } = loadModule('src/notation/createMeasureNotation.ts', 1, undefined, { vexflow: VF });

function measure(meter, events = []) {
  const [n, d] = meter.split('/').map(Number);
  return { timeSignature: meter, totalUnits: n * 16 / d, events, groups: [], beamGroups: [] };
}
function geometry(index, row, xStart, xEnd, totalUnits, onsets = [0, 4, 8, 12]) {
  return { index, row, xStart, xEnd, yTop: row * 200 + 30, yBottom: row * 200 + 140, totalUnits,
    anchors: [...onsets, totalUnits].map(units => ({ units, x: xStart + units / totalUnits * (xEnd - xStart) })) };
}
const mixedExercise = { timeSignature: '4/4', measures: [measure('4/4'), measure('6/8'), measure('7/8')] };
const mixedLayout = { width: 900, height: 500, measures: [
  geometry(0, 0, 100, 450, 16), geometry(1, 0, 480, 880, 12, [0, 2, 4, 6, 8, 10]),
  geometry(2, 1, 100, 450, 14, [0, 2, 4, 6, 8, 10, 12]),
] };

test('cursor preserves note-value timing across 4/4, 6/8 and 7/8 changes', () => {
  assert.equal(findCursor(mixedLayout, mixedExercise, 60, 2).units, 8);
  const compound = findCursor(mixedLayout, mixedExercise, 60, 5.5);
  assert.equal(compound.measureIndex, 1);
  assert.equal(compound.units, 6);
  assert.equal(compound.x, 680);
  const asymmetric = findCursor(mixedLayout, mixedExercise, 60, 8);
  assert.equal(asymmetric.measureIndex, 2);
  assert.equal(asymmetric.units, 4);
});

test('measure boundaries jump immediately to the next system without diagonal interpolation', () => {
  const before = findCursor(mixedLayout, mixedExercise, 60, 6.999);
  const boundary = findCursor(mixedLayout, mixedExercise, 60, 7);
  assert.equal(before.row, 0);
  assert.ok(before.x > 879);
  assert.equal(boundary.row, 1);
  assert.equal(boundary.x, 100);
  assert.equal(boundary.y, 230);
  assert.equal(findCursor(mixedLayout, mixedExercise, 60, -1).x, 100);
  const end = findCursor(mixedLayout, mixedExercise, 60, 999);
  assert.equal(end.measureIndex, 2);
  assert.equal(end.x, 450);
  assert.equal(end.units, 14);
});

test('seeking snaps to a notated onset in the selected row and respects mixed-meter seconds', () => {
  assert.equal(hitTest(mixedLayout, mixedExercise, 60, 681, 80), 5.5);
  assert.equal(hitTest(mixedLayout, mixedExercise, 60, 250, 250), 8.5);
  assert.equal(hitTest(mixedLayout, mixedExercise, 60, 999, 250), 10);
  assert.equal(hitTest(mixedLayout, mixedExercise, 60, 1, 250), 7);
  assert.equal(hitTest(mixedLayout, mixedExercise, 120, 681, 80), 2.75);
});

function eighthBar(restAt = []) {
  return { ...measure('4/4'), groups: [4, 4, 4, 4], beamGroups: [4, 4, 4, 4], events: Array.from({ length: 8 }, (_, i) => ({
    key: 'c/4', octave: 4, midi: 60, rest: restAt.includes(i), duration: '8', dots: 0, startUnits: i * 2, durationUnits: 2,
  })) };
}
function formatGrand(upper, lower, simplify = true) {
  const result = prepareGrandMeasure(upper, lower, 'C', '4/4', simplify);
  for (const [i, hand] of [result.right, result.left].entries()) {
    const stave = new VF.Stave(20, i * 150, 750).setNoteStartX(100);
    hand.voice.setStave(stave);
    for (const note of hand.notes) note.setStave(stave);
  }
  result.formatter.format(result.voices, 620);
  return result;
}

test('grand cursor retains lower-hand onsets after the upper staff compresses to a whole-bar rest', () => {
  const result = formatGrand(eighthBar([0, 1, 2, 3, 4, 5, 6, 7]), eighthBar());
  assert.equal(result.right.notes.length, 1);
  assert.ok(result.right.notes[0].isCenterAligned());
  const anchors = collectMeasureAnchors([result.right.notes, result.left.notes], 16, 100, 740);
  assert.deepEqual(Array.from(anchors, anchor => anchor.units), [0, 2, 4, 6, 8, 10, 12, 14, 16]);
  for (let i = 0; i < result.left.notes.length; i++) assert.equal(anchors[i].x, result.left.notes[i].getAbsoluteX());
});

test('grand anchors use the union of independently simplified voices, including silent regions', () => {
  const upper = eighthBar([1, 2, 3, 4, 5, 6, 7]);
  const lower = eighthBar([0, 1, 3, 4, 6, 7]);
  const result = formatGrand(upper, lower);
  assert.ok(result.right.notes.length < upper.events.length);
  assert.ok(result.left.notes.length < lower.events.length);
  const anchors = collectMeasureAnchors([result.right.notes, result.left.notes], 16, 100, 740);
  assert.deepEqual(Array.from(anchors, anchor => anchor.units), [0, 2, 4, 6, 8, 10, 12, 16]);
  const layout = { width: 800, height: 350, measures: [{ ...geometry(0, 0, 100, 740, 16), anchors }] };
  const exercise = { timeSignature: '4/4', measures: [upper], lowerMeasures: [lower] };
  assert.equal(hitTest(layout, exercise, 60, anchors.find(anchor => anchor.units === 10).x, 100), 2.5);
  assert.equal(findCursor(layout, exercise, 60, 2.5).x, anchors.find(anchor => anchor.units === 10).x);
});

test('whole-measure rests start at the note area and traverse the complete silent duration', () => {
  const silent = { ...measure('7/8'), groups: [4, 4, 6], beamGroups: [4, 4, 6], events: [{
    key: 'b/4', octave: 4, rest: true, duration: 'w', dots: 0, measureRest: true, startUnits: 0, durationUnits: 14,
  }] };
  const result = createMeasureNotation(silent, 'treble', 'C', '7/8');
  const stave = new VF.Stave(20, 0, 600).setNoteStartX(100);
  result.voice.setStave(stave);
  result.notes.forEach(note => note.setStave(stave));
  new VF.Formatter().joinVoices([result.voice]).format([result.voice], 450);
  const anchors = collectMeasureAnchors([result.notes], 14, 100, 580);
  assert.deepEqual(Array.from(anchors, anchor => [anchor.units, anchor.x]), [[0, 100], [14, 580]]);
  const layout = { width: 600, height: 200, measures: [{ ...geometry(0, 0, 100, 580, 14), anchors }] };
  const exercise = { timeSignature: '7/8', measures: [silent] };
  assert.equal(findCursor(layout, exercise, 60, 3.5).x, 340);
  assert.equal(hitTest(layout, exercise, 60, 400, 80), 0);
});
