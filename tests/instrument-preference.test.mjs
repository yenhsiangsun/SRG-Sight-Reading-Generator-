import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

const {INSTRUMENTS} = loadModule('src/music/instruments.ts');
const {INSTRUMENT_PREFERENCE_KEY} = loadModule('src/practice/instrumentPreference.ts');
const plain = value => JSON.parse(JSON.stringify(value));

function storage(initial) {
  const values = new Map(initial === undefined ? [] : [[INSTRUMENT_PREFERENCE_KEY, initial]]);
  return {getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value)};
}

function mount(localStorage) {
  const states = []; let cursor = 0;
  const react = {useState(initial) {
    const index = cursor++;
    if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
    return [states[index], next => {states[index] = typeof next === 'function' ? next(states[index]) : next;}];
  }};
  const hook = loadModule('src/hooks/useExercise.ts', 821, undefined, {react}, {
    localStorage, window: {matchMedia: () => ({matches: false})},
  });
  return () => {cursor = 0; return hook.useExercise();};
}

function assertInstrument(settings, instrument) {
  const profile = INSTRUMENTS[instrument];
  assert.equal(settings.instrument, instrument);
  assert.equal(settings.clef, profile.clef);
  assert.equal(settings.rangeMinMidi, profile.min);
  assert.equal(settings.rangeMaxMidi, profile.max);
}

test('first use starts with piano, its grand staff and full reference range', () => {
  assertInstrument(mount(storage())().settings, 'Piano');
});

test('selection is remembered immediately before generating, and the newest choice wins after restart', () => {
  const saved = storage(), render = mount(saved);
  const before = plain(render().settings);
  render().change('instrument', 'Pipa');
  assert.equal(render().current, null);
  assertInstrument(mount(saved)().settings, 'Pipa');
  assert.equal(render().settings.difficulty, before.difficulty);
  assert.equal(render().settings.rhythmLevel, before.rhythmLevel);
  render().change('instrument', 'Cello');
  assertInstrument(mount(saved)().settings, 'Cello');
  render().change('instrument', 'Piano');
  assertInstrument(mount(saved)().settings, 'Piano');
});

test('every supported instrument restores a matching clef and range, including legacy variants', () => {
  const saved = storage();
  const preferences = loadModule('src/practice/instrumentPreference.ts', 1, undefined, {}, {localStorage: saved});
  for (const instrument of Object.keys(INSTRUMENTS)) {
    preferences.rememberInstrument(instrument);
    assert.equal(preferences.loadPreferredInstrument(), instrument);
  }
  assertInstrument(mount(storage('Guan F'))().settings, 'Guan F');
});

test('invalid or retired preferences and unavailable storage safely fall back to piano', () => {
  for (const invalid of ['', 'Unknown', 'Gehu', 'Bass Gehu', 'Yunluo', '__proto__', 'constructor']) {
    assertInstrument(mount(storage(invalid))().settings, 'Piano');
  }
  const denied = {getItem() {throw Error('denied');}, setItem() {throw Error('quota');}};
  const render = mount(denied);
  assertInstrument(render().settings, 'Piano');
  render().change('instrument', 'Erhu');
  assertInstrument(render().settings, 'Erhu');
});

test('opening a saved exercise or generating from a preset remembers its instrument without rewriting its settings', () => {
  const saved = storage(), render = mount(saved);
  const preset = {...render().settings, instrument: 'Cello', clef: 'bass', rangeMinMidi: 48, rangeMaxMidi: 72, measureCount: 4};
  assert.equal(typeof render().generateFrom(preset, 80), 'number');
  assertInstrument(mount(saved)().settings, 'Cello');
  assert.equal(render().settings.rangeMinMidi, 48);
  const study = render().current;
  render().change('instrument', 'Piano');
  render().restore(study.exercise, study.settings);
  assert.deepEqual(plain(render().settings), plain(study.settings));
  assertInstrument(mount(saved)().settings, 'Cello');
});
