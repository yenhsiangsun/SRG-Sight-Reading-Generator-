import test from 'node:test';
import assert from 'node:assert/strict';
import { loadModule } from './helpers.mjs';
import * as VF from 'vexflow';

// Real VexFlow beam geometry with approximate font metrics; visual QA is separate.
globalThis.document = { createElement: () => ({ style: {
  fontFamily: 'Bravura', fontSize: '30px', fontWeight: 'normal', fontStyle: 'normal',
  set font(value) { const match = value.match(/([\d.]+(?:px|pt))\s+(.+)$/); if (match) { this.fontSize = match[1]; this.fontFamily = match[2]; } },
} }) };
VF.Element.setTextMeasurementCanvas({ getContext: () => ({ measureText: text => ({ width: text.length * 8, actualBoundingBoxLeft: 0, actualBoundingBoxRight: text.length * 8, actualBoundingBoxAscent: 12, actualBoundingBoxDescent: 3, fontBoundingBoxAscent: 12, fontBoundingBoxDescent: 3 }) }) });
const { createMeasureNotation, prepareNotationForDrawing } = loadModule('src/notation/createMeasureNotation.ts', 1, undefined, { vexflow: VF });

function bar(meter, durations, rests = [], groups) {
  let startUnits = 0;
  const events = durations.map((durationUnits, index) => {
    const duration = { 1: '16', 2: '8', 3: '8', 4: 'q', 6: 'q', 8: 'h' }[durationUnits];
    const event = { key: 'c/4', octave: 4, midi: 60, rest: rests.includes(index), duration,
      dots: [3, 6].includes(durationUnits) ? 1 : 0, startUnits, durationUnits };
    startUnits += durationUnits;
    return event;
  });
  return { events, totalUnits: startUnits, timeSignature: meter, groups, beamGroups: groups };
}
function notation(measure) {
  const result = createMeasureNotation(measure, 'treble', 'C', measure.timeSignature);
  const stave = new VF.Stave(20, 0, 1100).setNoteStartX(100);
  result.voice.setStave(stave);
  result.notes.forEach(note => note.setStave(stave));
  new VF.Formatter().joinVoices([result.voice]).format([result.voice], 980);
  return result;
}

test('tenuto uses finalized descending sixteenth-beam stems with extra clearance',()=>{
  const measure=bar('4/4',Array(16).fill(1),[],[4,4,4,4]);
  measure.events.forEach((event,index)=>{event.key=['f#/5','d/5','e/4','db/4'][index%4];if(index%4===0)event.articulation='tenuto';});
  const result=notation(measure);
  prepareNotationForDrawing(result,result.notes[0].getStave());
  assert.ok(result.beams.every(beam=>beam.postFormatted));
  const stems=result.notes.map(note=>({...note.getStemExtents()}));
  for(const index of [0,4,8,12]) {
    const tenuto=result.notes[index].getModifiers().find(mod=>mod instanceof VF.Articulation);
    assert.ok(Math.abs(tenuto.getYShift()+3)<1e-6);
  }
  result.beams.forEach(beam=>beam.postFormat());
  assert.deepEqual(result.notes.map(note=>({...note.getStemExtents()})),stems);
});

test('expression modifiers render on sounded notes without breaking the strict voice or beams',()=>{
  const measure=bar('4/4',[2,2,2,2,2,2,2,2],[],[4,4,4,4]);
  measure.events[0].dynamic='mf';
  measure.events[0].articulation='staccato';
  measure.events[2].articulation='tenuto';
  measure.events[4].articulation='accent';
  const result=notation(measure);
  assert.equal(result.voice.isComplete(),true);
  assert.equal(result.beams.length,4);
  assert.equal(result.notes[0].getModifiers().filter(mod=>mod instanceof VF.Annotation).length,1);
  for(const i of [0,2,4]) assert.equal(result.notes[i].getModifiers().filter(mod=>mod instanceof VF.Articulation).length,1);
});

test('octave display preserves strict durations and beaming while spelling displaced accidentals', () => {
  const measure = bar('4/4', [2,2,2,2,2,2,2,2], [], [4,4,4,4]);
  measure.events.forEach((event,index) => {event.key = index % 2 ? 'c/7' : 'c#/7'; event.midi = index % 2 ? 96 : 97; event.octave = 7;});
  const source = JSON.stringify(measure);
  const original = createMeasureNotation(measure, 'treble', 'C', '4/4');
  const shifted = createMeasureNotation(measure, 'treble', 'C', '4/4', Array(8).fill(1));
  assert.equal(shifted.voice.isComplete(), true);
  assert.equal(shifted.beams.length, original.beams.length);
  shifted.notes.forEach((note,index) => {
    assert.equal(note.getKeys()[0], index % 2 ? 'c/6' : 'c#/6');
    assert.equal(note.getTicks().value(), original.notes[index].getTicks().value());
    assert.equal(note.getModifiers().length, original.notes[index].getModifiers().length);
  });
  assert.equal(JSON.stringify(measure), source);
});
function stemX(note) { return note.getStemX() - VF.Stem.WIDTH / 2; }
function endpoints(beam, duration) { return Array.from(beam.getBeamLines(duration), line => [line.start, line.end]); }

test('continuous sixteenths join both beams within each /8 primary group, never across groups', () => {
  for (const [meter, groups] of [['3/8', [6]], ['6/8', [6, 6]], ['7/8', [4, 4, 6]], ['9/8', [6, 6, 6]], ['12/8', [6, 6, 6, 6]]]) {
    const result = notation(bar(meter, Array(groups.reduce((a, b) => a + b, 0)).fill(1), [], groups));
    assert.deepEqual(Array.from(result.beams, beam => beam.getNotes().length), groups);
    for (const beam of result.beams) {
      const notes = beam.getNotes();
      assert.deepEqual(endpoints(beam, '4'), [[stemX(notes[0]), stemX(notes.at(-1))]]);
      assert.deepEqual(endpoints(beam, '8'), [[stemX(notes[0]), stemX(notes.at(-1))]]);
    }
  }
});

test('simple-meter sixteenths keep the complete quarter-note beam group', () => {
  const result = notation(bar('4/4', Array(16).fill(1), [], [4, 4, 4, 4]));
  assert.equal(result.beams.length, 4);
  for (const beam of result.beams) {
    const notes = beam.getNotes();
    const fullBeat = [[stemX(notes[0]), stemX(notes.at(-1))]];
    assert.deepEqual(endpoints(beam, '4'), fullBeat);
    assert.deepEqual(endpoints(beam, '8'), fullBeat);
  }
});

test('a leading sixteenth rest does not fragment the following continuous run', () => {
  const result = notation(bar('6/8', [1, 1, 1, 1, 1, 1, 6], [0, 6], [6, 6]));
  assert.equal(result.beams.length, 1);
  const beam = result.beams[0], notes = beam.getNotes();
  const lines = endpoints(beam, '8');
  assert.deepEqual(lines, [[stemX(notes[0]), stemX(notes.at(-1))]]);
});

test('measure 3 regression: eighth chord then four sixteenths has one continuous secondary beam on notes 2–5', () => {
  const measure = bar('6/8', [2,1,1,1,1, 1,1,1,3], [], [6,6]);
  const keys = ['b/4','d/5','b/4','g#/4','c#/5','g/4','e#/4','a/5','e/4'];
  measure.events.forEach((note,index)=>{note.key=keys[index];});
  measure.events[0].chord=[{key:'d/4',octave:4,midi:62},{key:'b/4',octave:4,midi:71}];
  const before = JSON.stringify(measure);
  const result = notation(measure);
  assert.ok(result.voice.isComplete());
  assert.equal(result.notes[0].getKeys().length,2);
  assert.deepEqual(Array.from(result.beams,beam=>Array.from(beam.getNotes(),note=>result.notes.indexOf(note))),[[0,1,2,3,4],[5,6,7,8]]);
  assert.deepEqual(endpoints(result.beams[0],'8'),[[stemX(result.notes[1]),stemX(result.notes[4])]]);
  assert.equal(JSON.stringify(measure),before,'source pitches, chord and timing stay unchanged');
});

test('isolated secondary hooks point into the correct eighth subdivision', () => {
  const result = notation(bar('6/8', [2, 1, 2, 1, 6], [4], [6, 6]));
  const beam = result.beams[0];
  assert.equal(beam.getNotes().length, 4);
  const lines = endpoints(beam, '8');
  assert.equal(lines.length, 2);
  assert.ok(lines[0][1] > lines[0][0], 'sixteenth at subdivision start points right');
  assert.ok(lines[1][1] < lines[1][0], 'sixteenth at subdivision end points left');
});

test('consecutive leading and trailing rests never become beam endpoints', () => {
  const result = notation(bar('6/8', Array(12).fill(1), [0, 1, 4, 5, 6, 7, 10, 11], [6, 6]));
  assert.deepEqual(Array.from(result.beams, beam => Array.from(beam.getNotes(), note => result.notes.indexOf(note))), [[2, 3], [8, 9]]);
  for (const beam of result.beams) {
    assert.ok(!beam.getNotes()[0].isRest());
    assert.ok(!beam.getNotes().at(-1).isRest());
  }
  const solo = notation(bar('6/8', Array(12).fill(1), [0, 1, 3, 4, 5, 6, 7, 9, 10, 11], [6, 6]));
  assert.equal(solo.beams.length, 0);
  assert.ok(!solo.notes[2].hasBeam());
  assert.ok(!solo.notes[8].hasBeam());
});

test('eighth C and sixteenth F retain their primary beam across the internal rest', () => {
  const measure = bar('3/4', [2, 1, 1, 4, 4], [1], [4, 4, 4]);
  measure.events[2].key = 'f/5';
  const result = notation(measure);
  assert.equal(result.beams.length, 1);
  assert.deepEqual(Array.from(result.beams[0].getNotes(), note => result.notes.indexOf(note)), [0, 1, 2]);
  assert.equal(result.beams[0].renderOptions.showStemlets, false);
  assert.equal(endpoints(result.beams[0], '4').length, 1);
  assert.ok(result.voice.isComplete());
});
