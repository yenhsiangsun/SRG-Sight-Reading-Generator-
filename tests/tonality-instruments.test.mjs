import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

const {INSTRUMENTS} = loadModule('src/music/instruments.ts');
const {SCALES, buildPitchMaterial, describeTonality} = loadModule('src/music/scales.ts');
const {getTonalityChoices, selectRandomTonality, signatureGroup} = loadModule('src/music/randomTonality.ts');
const {notePitches, midiFromKey} = loadModule('src/music/notePitches.ts');

test('every instrument can generate sharp, flat, natural and open-key scores through the app hook', () => {
  let state = [], cursor = 0, groupDraw = 0;
  const react = {useState(initial) {
    const index = cursor++;
    if (!(index in state)) state[index] = initial;
    return [state[index], next => {state[index] = typeof next === 'function' ? next(state[index]) : next;}];
  }};
  const hook = loadModule('src/hooks/useExercise.ts', 782, undefined, {
    react,
    '../music/randomTonality': {selectRandomTonality(ranges, _random, options) {
      let call = 0;
      assert.equal(options.allowAccidentals,false);
      return selectRandomTonality(ranges, () => call++ === 0 ? groupDraw : .47, options);
    }},
  }, {window: {matchMedia: () => ({matches: false})}});
  const render = () => {cursor = 0; return hook.useExercise();};
  for (const [instrument, profile] of Object.entries(INSTRUMENTS)) {
    state = [];
    render().change('instrument', instrument);
    const range = {min: profile.min, max: profile.max};
    const ranges = profile.clef === 'grand' && ['Piano', 'Yangqin'].includes(instrument)
      ? [range, {min: profile.min, max: 59}, {min: 60, max: profile.max}] : [range];
    const choices = getTonalityChoices(ranges,{allowAccidentals:false,difficulty:'beginner'});
    assert.deepEqual(Array.from(choices, scale => scale.scaleId), Array.from(SCALES, scale => scale.id), instrument);
    for (const [draw, expected] of [[.175, 'sharp'], [.525, 'flat'], [.8, 'natural'], [.975, 'open']]) {
      groupDraw = draw;
      const result = render().generateNew(80, {measureCount: 4, rhythmLevel: 'Complex', mixedMeters: true, allowAccidentals: false});
      assert.equal(typeof result, 'number', `${instrument}: ${render().error}`);
      const {exercise, settings} = render().current;
      assert.equal(signatureGroup(exercise.tonality.signature), expected, instrument);
      assert.equal(exercise.soundProfile, instrument);
      assert.equal(exercise.transposition, profile.transpose);
      assert.equal(settings.scaleId, exercise.tonality.scaleId);
      assert.equal(settings.allowAccidentals, false);
      const classes = buildPitchMaterial(exercise.tonality, range).pitchClasses;
      for (const measure of [...exercise.measures, ...exercise.lowerMeasures ?? []]) {
        assert.equal(measure.events.reduce((sum, note) => sum + Math.round(note.durationUnits * 12), 0), measure.totalUnits * 12);
        for (const pitch of measure.events.flatMap(notePitches)) {
          assert.ok(pitch.midi >= profile.min && pitch.midi <= profile.max, instrument);
          assert.ok(classes.includes(pitch.midi % 12), `${instrument}: ${pitch.key}`);
          assert.equal(midiFromKey(pitch.key), pitch.midi, instrument);
        }
      }
    }
  }
});

test('chromatic spelling follows the actual modal signature instead of stale legacy settings', () => {
  const base = {instrument:'Sheng', clef:'treble', difficulty:'advanced', timeSignature:'4/4', rhythmLevel:'complex', measures:16,
    tempo:80, range:{min:48,max:84}, allowAccidentals:true, mixedMeters:false, meters:['4/4'], scaleId:'major'};
  for (const [tonic, staleKey, expectedSign] of [['G', 'F', '#'], ['F', 'G', 'b']]) {
    const a = loadModule('src/music.ts', 174).generatePracticeExercise({...base, tonic, keySignature:staleKey});
    const b = loadModule('src/music.ts', 174).generatePracticeExercise({...base, tonic, keySignature:'C'});
    assert.equal(JSON.stringify(a.measures), JSON.stringify(b.measures));
    const classes = buildPitchMaterial(describeTonality(tonic, 'major'), base.range).pitchClasses;
    const chromatic = a.measures.flatMap(bar => bar.events).filter(note => !note.rest && !classes.includes(note.midi % 12));
    const altered = chromatic.filter(note => /[#b]/.test(note.key));
    assert.ok(altered.length > 0);
    assert.ok(altered.every(note => note.key.includes(expectedSign)), `${tonic}: ${altered.map(note => note.key)}`);
  }
});

test('failed preview generation can be retried and restoring a saved score exits preview', () => {
  let cursor = 0;
  const state = [];
  const react = {useState(initial) {
    const index = cursor++;
    if (!(index in state)) state[index] = initial;
    return [state[index], next => {state[index] = typeof next === 'function' ? next(state[index]) : next;}];
  }};
  const hook = loadModule('src/hooks/useExercise.ts', 782, undefined, {react}, {window: {matchMedia: () => ({matches: false})}});
  const render = () => {cursor = 0; return hook.useExercise({tonic:'C', scaleId:'pelog-pentatonic'});};
  assert.equal(render().generateNew(80, {rangeMinMidi:70, rangeMaxMidi:60}), false);
  assert.equal(render().previewPending, true);
  assert.equal(typeof render().generateNew(80), 'number');
  const saved = render().current;
  render().restore(saved.exercise, saved.settings);
  assert.equal(render().previewPending, false);
  assert.equal(render().current.isPreview, undefined);
  assert.equal(render().current.exercise, saved.exercise);
});
