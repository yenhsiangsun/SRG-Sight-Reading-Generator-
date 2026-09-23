import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

const eighthMeters = ['3/8', '6/8', '7/8', '9/8', '12/8'];
const difficulties = ['beginner', 'intermediate', 'advanced'];
const levels = ['simple', 'medium', 'complex'];
const base = {
  instrument: 'Sheng', clef: 'treble', keySignature: 'C', measures: 32, tempo: 72,
  range: {min: 48, max: 84}, allowAccidentals: false, mixedMeters: false,
  meters: ['4/4'], tonic: 'C', scaleId: 'major',
};

function countSounded(exercise) {
  const result = {notes: 0, triplets: 0, sixteenths: 0, eighths: 0, dottedEighths: 0, soundingUnits: 0};
  for (const note of exercise.measures.flatMap(measure => measure.events)) {
    if (note.rest) continue;
    result.notes++;
    if (note.tuplet === 3) result.triplets++;
    result.soundingUnits += note.durationUnits;
    if (note.durationUnits === 1) result.sixteenths++;
    if (note.durationUnits === 2) result.eighths++;
    if (note.durationUnits === 3) result.dottedEighths++;
  }
  return result;
}

test('every /8 meter and pitch difficulty has sounded sixteenths with a clear simple < medium < complex hierarchy', () => {
  const totals = new Map();
  for (const seed of [971, 5173, 20260921]) {
    const engine = loadModule('src/music.ts', seed);
    for (const timeSignature of eighthMeters) for (const difficulty of difficulties) {
      for (const rhythmLevel of levels) for (let sample = 0; sample < 6; sample++) {
        const result = countSounded(engine.generatePracticeExercise({...base, timeSignature, difficulty, rhythmLevel}));
        const key = `${timeSignature}/${difficulty}/${rhythmLevel}`;
        const total = totals.get(key) ?? {notes: 0, sixteenths: 0, eighths: 0, dottedEighths: 0, soundingUnits: 0};
        for (const field of Object.keys(total)) total[field] += result[field];
        totals.set(key, total);
      }
    }
  }
  for (const meter of eighthMeters) for (const difficulty of difficulties) {
    const values = levels.map(level => totals.get(`${meter}/${difficulty}/${level}`));
    const shares = values.map(value => value.sixteenths / value.notes);
    const timeShares = values.map(value => value.sixteenths / value.soundingUnits);
    assert.ok(shares[0] > .15 && shares[0] < .32, `${meter} ${difficulty}: simple = ${shares[0]}`);
    assert.ok(shares[1] > .30 && shares[1] < .53, `${meter} ${difficulty}: medium = ${shares[1]}`);
    assert.ok(shares[2] > .55 && shares[2] < .80, `${meter} ${difficulty}: complex = ${shares[2]}`);
    assert.ok(shares[1] > shares[0] + .08 && shares[2] > shares[1] + .08);
    assert.ok(timeShares[1] > timeShares[0] + .04 && timeShares[2] > timeShares[1] + .10);
    assert.ok(values[0].eighths > values[0].sixteenths, 'simple remains mainly eighth notes');
    assert.ok(values[1].dottedEighths > 0 && values[2].dottedEighths > 0, 'retain dotted rhythms at higher levels');
  }
});

test('new 3/8 is simple triple and every /8 group remains complete with no notes crossing its boundary', () => {
  const engine = loadModule('src/music.ts', 829);
  assert.equal(engine.TIME_SIGNATURES['3/8'].numerator, 3);
  assert.equal(engine.TIME_SIGNATURES['3/8'].denominator, 8);
  assert.equal(engine.TIME_SIGNATURES['3/8'].compound, false);
  assert.equal(JSON.stringify(engine.TIME_SIGNATURES['3/8'].groups), '[6]');
  for (const timeSignature of eighthMeters) for (const rhythmLevel of levels) {
    const exercise = engine.generatePracticeExercise({...base, timeSignature, rhythmLevel, difficulty: 'advanced'});
    for (const measure of exercise.measures) {
      let groupStart = 0;
      for (const units of measure.groups) {
        const events = measure.events.filter(note => note.startUnits >= groupStart && note.startUnits < groupStart + units);
        assert.equal(events.reduce((sum, note) => sum + note.durationUnits, 0), units);
        assert.ok(events.every(note => note.startUnits + note.durationUnits <= groupStart + units));
        groupStart += units;
      }
      assert.equal(groupStart, measure.totalUnits);
    }
  }
});

test('simple /8 practice includes subdivisions without optional tonality or accidental settings', () => {
  const engine = loadModule('src/music.ts', 1043);
  for (const timeSignature of eighthMeters) {
    const exercise = engine.generatePracticeExercise({...base, timeSignature, scaleId: undefined,
      tonic: undefined, rhythmLevel: 'simple', difficulty: 'beginner'});
    assert.ok(countSounded(exercise).sixteenths > 0, timeSignature);
  }
});

test('both piano hands inherit simple /8 subdivisions without changing their shared bar boundaries', () => {
  const {generateGrandExercise} = loadModule('src/music/grandStaff.ts', 992);
  for (const timeSignature of eighthMeters) {
    const exercise = generateGrandExercise({...base, instrument: 'Piano', range: {min: 36, max: 84},
      timeSignature, rhythmLevel: 'simple', difficulty: 'beginner'}, 'two-hand');
    assert.ok(countSounded(exercise).sixteenths > 0, `upper ${timeSignature}`);
    assert.ok(countSounded({...exercise, measures: exercise.lowerMeasures}).sixteenths > 0, `lower ${timeSignature}`);
    for (let index = 0; index < exercise.measures.length; index++) {
      const top = exercise.measures[index], bottom = exercise.lowerMeasures[index];
      assert.equal(top.totalUnits, bottom.totalUnits);
      assert.equal(bottom.events.reduce((sum, note) => sum + note.durationUnits, 0), top.totalUnits);
    }
  }
});

test('/4 beginner complex rhythms have sounded sixteenths, dotted rhythms and more subdivision than medium', () => {
  for (const timeSignature of ['2/4', '3/4', '4/4', '5/4']) for(const difficulty of difficulties) {
    const values=levels.map(rhythmLevel=>countSounded(loadModule('src/music.ts',20260921).generatePracticeExercise({...base,timeSignature,difficulty,rhythmLevel})));
    // Triplets are an additional subdivision; retain the original hierarchy
    // among the ordinary rhythms instead of counting triplets as plain eighths.
    const shares=values.map(value=>value.sixteenths/(value.notes-value.triplets));
    assert.equal(shares[0],0);
    assert.ok(shares[1]>.2 && shares[1]<.5,`${timeSignature} medium ${shares[1]}`);
    assert.ok(shares[2]>.5 && shares[2]>shares[1]+.1,`${timeSignature} complex ${shares[2]}`);
    assert.ok(values[1].dottedEighths>0 && values[2].dottedEighths>0);
  }
});
