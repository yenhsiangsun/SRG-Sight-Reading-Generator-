import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

const base = {
  instrument: 'Sheng', clef: 'treble', difficulty: 'advanced', keySignature: 'C',
  timeSignature: '4/4', rhythmLevel: 'complex', measures: 32, tempo: 72,
  range: {min: 48, max: 84}, allowAccidentals: false, mixedMeters: false,
  meters: ['4/4'], tonic: 'C', scaleId: 'major',
};
const difficulties = ['beginner', 'intermediate', 'advanced'];
const rhythms = ['simple', 'medium', 'complex'];

function inspectContinuity(exercise) {
  let previousRest = false, restUnits = 0, totalUnits = 0, beatStartRests = 0;
  assert.equal(exercise.measures[0].events[0].rest, false, 'an exercise opens with a sounded note');
  for (const measure of exercise.measures) {
    const meter = measure.timeSignature ?? exercise.timeSignature;
    const groups = meter === '5/4' ? [4, 4, 4, 4, 4] : measure.groups;
    let ticks = 0, barRests = 0;
    for (const note of measure.events) {
      assert.equal(note.startUnits, ticks / 12);
      ticks += Math.round(note.durationUnits * 12);
      assert.ok(!(previousRest && note.rest), 'no consecutive rests, including across bars');
      if (note.rest) barRests += note.durationUnits;
      else assert.ok(Number.isFinite(note.midi));
      previousRest = note.rest;
    }
    assert.equal(ticks, measure.totalUnits * 12);
    assert.ok(barRests <= measure.totalUnits / 4, 'no more than a quarter of a bar is silent');
    let beatStart = 0;
    for (const units of groups) {
      const events = measure.events.filter(note => note.startUnits >= beatStart && note.startUnits < beatStart + units);
      const rests = events.filter(note => note.rest).reduce((sum, note) => sum + note.durationUnits, 0);
      assert.ok(events.some(note => !note.rest), 'every primary beat contains sounded music');
      assert.ok(rests <= units / 2, 'short rests never empty a primary beat');
      if (events[0].rest) beatStartRests++;
      beatStart += units;
    }
    totalUnits += measure.totalUnits;
    restUnits += barRests;
  }
  return {restUnits, totalUnits, beatStartRests};
}

test('seeded practice across all meters and levels preserves sounded continuity and rhythm variety', () => {
  let beatStartRests = 0;
  const durations = new Set();
  const densities = new Map();
  for (const seed of [5173, 90210, 20260918]) {
    const engine = loadModule('src/music.ts', seed);
    for (const timeSignature of Object.keys(engine.TIME_SIGNATURES)) {
      for (const difficulty of difficulties) for (const rhythmLevel of rhythms) {
        const exercise = engine.generatePracticeExercise({...base, timeSignature, difficulty, rhythmLevel});
        const result = inspectContinuity(exercise);
        beatStartRests += result.beatStartRests;
        const key = `${difficulty}/${rhythmLevel}`;
        const totals = densities.get(key) ?? {rest: 0, units: 0};
        totals.rest += result.restUnits;
        totals.units += result.totalUnits;
        densities.set(key, totals);
        for (const note of exercise.measures.flatMap(measure => measure.events)) {
          if (!note.rest) durations.add(note.durationUnits);
        }
      }
    }
  }
  assert.ok(beatStartRests > 100, 'short leading rests still exercise offbeat entries');
  for (const units of [1, 2, 3, 4, 6]) assert.ok(durations.has(units), `retains sounded rhythm length ${units}`);
  for (const [key, {rest, units}] of densities) {
    const density = rest / units;
    assert.ok(density >= .01 && density <= .11, `${key}: ${(density * 100).toFixed(2)}% rests`);
  }
});

test('advanced complex rests occupy about 6–10% of duration rather than the legacy 22.5%', () => {
  const engine = loadModule('src/music.ts', 20260918);
  let allRest = 0, allUnits = 0;
  for (const timeSignature of Object.keys(engine.TIME_SIGNATURES)) {
    let rest = 0, total = 0;
    for (let sample = 0; sample < 16; sample++) {
      const result = inspectContinuity(engine.generatePracticeExercise({...base, timeSignature}));
      rest += result.restUnits;
      total += result.totalUnits;
    }
    const density = rest / total;
    // A new 3/8 bar has only six units: its unchanged quarter-bar cap allows
    // at most one sixteenth rest, so its duration share is naturally lower.
    const bounds = timeSignature === '3/8' ? [.02, .10] : [.05, .11];
    assert.ok(density >= bounds[0] && density <= bounds[1], `${timeSignature}: ${(density * 100).toFixed(2)}% rests`);
    allRest += rest;
    allUnits += total;
  }
  assert.ok(allRest / allUnits >= .06 && allRest / allUnits <= .10);
});

test('plain and mixed-meter practice both use the rest policy without requiring optional tonality', () => {
  const engine = loadModule('src/music.ts', 419);
  for (const mixedMeters of [false, true]) {
    for (const difficulty of difficulties) {
      const exercise = engine.generatePracticeExercise({...base, scaleId: undefined, tonic: undefined,
        mixedMeters, difficulty, meters: ['4/4', '6/8', '7/8']});
      inspectContinuity(exercise);
      if (mixedMeters) assert.ok(new Set(exercise.measures.map(measure => measure.timeSignature)).size > 1);
    }
  }
});

test('denser playing retains custom pitch bounds, modal pitch material, and optional chromatic notes', () => {
  const engine = loadModule('src/music.ts', 8675309);
  const pitchClasses = new Set([0, 2, 4, 7, 9]);
  for (const allowAccidentals of [false, true]) {
    const exercise = engine.generatePracticeExercise({...base, scaleId: 'major-pentatonic',
      range: {min: 60, max: 74}, allowAccidentals, mixedMeters: true, meters: ['3/4', '6/8', '7/8']});
    const notes = exercise.measures.flatMap(measure => measure.events).filter(note => !note.rest);
    inspectContinuity(exercise);
    for (const note of notes) {
      assert.ok(note.midi >= 60 && note.midi <= 74);
      if (!allowAccidentals) assert.ok(pitchClasses.has(note.midi % 12));
    }
    if (allowAccidentals) assert.ok(notes.some(note => !pitchClasses.has(note.midi % 12)));
  }
});
