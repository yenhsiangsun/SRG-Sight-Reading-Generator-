import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { loadModule, baselineExercises } from './helpers.mjs';

const baseline = JSON.parse(readFileSync(new URL('./stable-baseline.json', import.meta.url), 'utf8'));

test('864 combinations preserve the stable version rhythm, pitch and random draw sequence', () => {
  const engine = loadModule('src/music.ts');
  const exercises = baselineExercises(engine);
  assert.equal(exercises.length, 864);
  const hash = createHash('sha256').update(JSON.stringify(exercises)).digest('hex');
  assert.equal(hash, baseline.sha256);
  for (const exercise of exercises) {
    let previousPitch;
    const leap = { beginner: 7, intermediate: 12, advanced: 24 }[exercise.difficulty];
    for (const measure of exercise.measures) {
      let elapsed = 0;
      for (const note of measure.events) {
        assert.equal(note.startUnits, elapsed);
        elapsed += note.durationUnits;
        if (!note.rest) {
          assert.ok(note.midi >= 48 && note.midi <= 84);
          if (previousPitch !== undefined) assert.ok(Math.abs(note.midi - previousPitch) <= leap);
          previousPitch = note.midi;
        }
      }
      assert.equal(elapsed, measure.totalUnits);
      assert.equal(measure.groups.reduce((a, b) => a + b, 0), measure.totalUnits);
    }
  }
});

test('custom range matches the old global-override output, without changing defaults', () => {
  const engine = loadModule('src/music.ts', 12345);
  const defaults = JSON.stringify(engine.INSTRUMENT_RANGES);
  const exercises = [];
  for (const instrument of Object.keys(engine.INSTRUMENT_RANGES)) {
    for (const range of [{ min: 24, max: 108 }, { min: 60, max: 61 }, { min: 79, max: 84 }]) {
      const exercise = engine.generateExercise(instrument, 'bass', 'advanced', 'Db', '7/8', 'complex', 4, 100, range);
      exercises.push(exercise);
      for (const measure of exercise.measures) for (const note of measure.events) {
        if (!note.rest) assert.ok(note.midi >= range.min && note.midi <= range.max);
      }
    }
  }
  assert.equal(createHash('sha256').update(JSON.stringify(exercises)).digest('hex'), baseline.customRangeSha256);
  assert.equal(JSON.stringify(engine.INSTRUMENT_RANGES), defaults);
});

test('invalid ranges fail explicitly instead of corrupting future generations', () => {
  const engine = loadModule('src/music.ts');
  for (const range of [{ min: 60, max: 60 }, { min: 80, max: 40 }, { min: NaN, max: 80 }, { min: -1, max: 80 }]) {
    assert.throws(() => engine.generateExercise('Sheng', 'treble', 'beginner', 'C', '4/4', 'simple', 4, 72, range));
  }
  assert.equal(engine.INSTRUMENT_RANGES.Sheng.min, 48);
});
