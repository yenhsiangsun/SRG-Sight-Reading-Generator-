import test from 'node:test';
import assert from 'node:assert/strict';
import * as VF from 'vexflow';
import { loadModule } from './helpers.mjs';

// Use actual VexFlow voices, tick contexts, and beam lines with approximate font metrics.
// This validates musical alignment; browser inspection covers engraving appearance.
globalThis.document = { createElement: () => ({ style: {
  fontFamily: 'Bravura', fontSize: '30px', fontWeight: 'normal', fontStyle: 'normal',
  set font(value) { const match = value.match(/([\d.]+(?:px|pt))\s+(.+)$/); if (match) { this.fontSize = match[1]; this.fontFamily = match[2]; } },
} }) };
VF.Element.setTextMeasurementCanvas({ getContext: () => ({ measureText: text => ({ width: text.length * 8, actualBoundingBoxLeft: 0, actualBoundingBoxRight: text.length * 8, actualBoundingBoxAscent: 12, actualBoundingBoxDescent: 3, fontBoundingBoxAscent: 12, fontBoundingBoxDescent: 3 }) }) });
const plain = value => JSON.parse(JSON.stringify(value));
const { TIME_SIGNATURES } = loadModule('src/music.ts');
const { generateGrandExercise } = loadModule('src/music/grandStaff.ts', 831);
const { createMeasureNotation } = loadModule('src/notation/createMeasureNotation.ts', 1, undefined, { vexflow: VF });
const { prepareGrandMeasure } = loadModule('src/notation/drawGrandScore.ts', 1, undefined, { vexflow: VF });
const { simplifyStaffRests } = loadModule('src/notation/simplifyStaffRests.ts');
const { collectMeasureAnchors, findCursor, hitTest } = loadModule('src/notation/scoreGeometry.ts', 1, undefined, { vexflow: VF });
const { measureTimeline } = loadModule('src/audio/tempo.ts');
const { createPlaybackEvents, createMetronomeEvents } = loadModule('src/audio/PlaybackController.ts');

function measure(meter, units = 1, key = 'c/5', rest = false) {
  const count = Number(meter.split('/')[0]) * 2;
  const groups = { '3/8': [6], '6/8': [6, 6], '7/8': [4, 4, 6] }[meter];
  return { timeSignature: meter, totalUnits: count, groups, beamGroups: groups,
    events: Array.from({ length: count / units }, (_, i) => ({
      key, octave: Number(key.split('/')[1]), rest, duration: units === 1 ? '16' : '8',
      dots: 0, startUnits: i * units, durationUnits: units,
    })),
  };
}
function mixedGrand() {
  const meters = ['3/8', '6/8', '7/8'];
  return { timeSignature: '3/8', measures: meters.map(meter => measure(meter)),
    lowerMeasures: meters.map(meter => measure(meter, 2, 'c/3')), grandMode: 'two-hand' };
}

test('3/8 is a six-unit meter and produces complete mono and two-hand grand scores', () => {
  assert.ok(TIME_SIGNATURES['3/8']);
  assert.equal(TIME_SIGNATURES['3/8'].numerator, 3);
  assert.equal(TIME_SIGNATURES['3/8'].denominator, 8);
  assert.equal(TIME_SIGNATURES['3/8'].units, 6);
  assert.deepEqual(plain(TIME_SIGNATURES['3/8'].groups), [6]);
  const options = { instrument: 'Piano', clef: 'treble', difficulty: 'advanced', keySignature: 'C',
    timeSignature: '3/8', rhythmLevel: 'complex', measures: 6, tempo: 60, range: { min: 36, max: 84 },
    allowAccidentals: true, mixedMeters: false, tonic: 'C', scaleId: 'major' };
  for (const mode of ['mono', 'two-hand']) {
    const exercise = generateGrandExercise(options, mode);
    assert.equal(exercise.measures.length, 6);
    assert.equal(exercise.lowerMeasures.length, 6);
    for (let i = 0; i < exercise.measures.length; i++) {
      const upper = exercise.measures[i], lower = exercise.lowerMeasures[i];
      assert.equal(upper.timeSignature, '3/8');
      assert.equal(lower.timeSignature, '3/8');
      assert.equal(upper.totalUnits, 6);
      assert.equal(lower.totalUnits, 6);
      const notation = prepareGrandMeasure(upper, lower, 'C', '3/8', true);
      assert.ok(notation.voices.every(voice => voice.isComplete()));
    }
    assert.equal(createPlaybackEvents(exercise, 60).duration, 18);
  }
});

test('3/8 sixteenths and whole-bar silence retain strict durations in all four clefs', () => {
  const sounding = measure('3/8');
  const silent = simplifyStaffRests(measure('3/8', 1, 'c/4', true), '3/8');
  assert.equal(silent.events.length, 1);
  assert.equal(silent.events[0].measureRest, true);
  assert.equal(silent.events[0].durationUnits, 6);
  for (const clef of ['treble', 'bass', 'alto', 'tenor']) {
    const played = createMeasureNotation(sounding, clef, 'C', '3/8');
    assert.ok(played.voice.isComplete());
    assert.equal(played.notes.length, 6);
    assert.equal(played.beams.length, 1);
    assert.equal(played.beams[0].getNotes().length, 6);
    const rests = createMeasureNotation(silent, clef, 'C', '3/8');
    assert.ok(rests.voice.isComplete());
    assert.equal(rests.notes.length, 1);
    assert.ok(rests.notes[0].isCenterAligned());
    assert.equal(rests.notes[0].getDuration(), 'w');
    assert.equal(rests.notes[0].getTicks().value(), VF.VexFlow.RESOLUTION * 6 / 16);
    assert.equal(rests.beams.length, 0);
  }
});

test('3/8 to 6/8 to 7/8 playback and both-hand timelines last 3 + 6 + 7 eighth beats', () => {
  const exercise = mixedGrand();
  const result = createPlaybackEvents(exercise, 60);
  assert.equal(result.duration, 16);
  const upper = result.events.filter(event => event.note === 'c5');
  const lower = result.events.filter(event => event.note === 'c3');
  assert.deepEqual(plain(upper.map(event => event.time)), Array.from({ length: 32 }, (_, i) => i / 2));
  assert.deepEqual(plain(lower.map(event => event.time)), Array.from({ length: 16 }, (_, i) => i));
  assert.ok(upper.every(event => event.duration === 0.5));
  assert.ok(lower.every(event => event.duration === 1));
  const expected = [[0, 3, 0.5], [3, 6, 0.5], [9, 7, 0.5]];
  for (const staff of [exercise.measures, exercise.lowerMeasures]) {
    assert.deepEqual(plain(measureTimeline(exercise, 60, staff).map(bar => [bar.start, bar.duration, bar.secondsPerUnit])), expected);
  }
  const clicks = createMetronomeEvents(exercise, 60);
  assert.deepEqual(plain(clicks.map(event => event.time)), Array.from({ length: 16 }, (_, i) => i));
  assert.deepEqual(plain(clicks.filter(event => event.accent).map(event => event.time)), [0, 3, 9]);
  assert.equal(createPlaybackEvents(exercise, 120).duration, 8);
});

test('grand cursor and seeking share 3/8 mixed-meter boundaries and actual sixteenth onsets', () => {
  const exercise = mixedGrand();
  const layout = { width: 1000, height: 950, measures: [] };
  exercise.measures.forEach((upper, index) => {
    const prepared = prepareGrandMeasure(upper, exercise.lowerMeasures[index], 'C', upper.timeSignature);
    [prepared.right, prepared.left].forEach((hand, staff) => {
      const stave = new VF.Stave(20, index * 300 + staff * 130, 950).setNoteStartX(100);
      hand.voice.setStave(stave);
      hand.notes.forEach(note => note.setStave(stave));
    });
    prepared.formatter.format(prepared.voices, 820);
    layout.measures.push({ index, row: index, xStart: 100, xEnd: 950,
      yTop: index * 300 + 20, yBottom: index * 300 + 220, totalUnits: upper.totalUnits,
      anchors: collectMeasureAnchors([prepared.right.notes, prepared.left.notes], upper.totalUnits, 100, 950) });
  });
  for (const [seconds, index] of [[0, 0], [3, 1], [9, 2]]) {
    const cursor = findCursor(layout, exercise, 60, seconds);
    assert.equal(cursor.measureIndex, index);
    assert.equal(cursor.row, index);
    assert.equal(cursor.units, 0);
    assert.equal(cursor.x, layout.measures[index].anchors[0].x);
  }
  const startTimes = [0, 3, 9];
  layout.measures.forEach((bar, index) => {
    for (const anchor of bar.anchors.filter(anchor => anchor.units < bar.totalUnits)) {
      const expected = startTimes[index] + anchor.units / 2;
      assert.equal(hitTest(layout, exercise, 60, anchor.x, bar.yTop + 100), expected);
      assert.equal(findCursor(layout, exercise, 60, expected).x, anchor.x);
    }
  });
  assert.equal(findCursor(layout, exercise, 60, 16).x, 950);
  assert.equal(findCursor(layout, exercise, 60, 16).measureIndex, 2);
});
