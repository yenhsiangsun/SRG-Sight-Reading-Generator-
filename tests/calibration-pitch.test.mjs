import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

const {selectCalibrationPitch} = loadModule('src/assessment/calibrationPitch.ts');
const {INSTRUMENTS} = loadModule('src/music/instruments.ts');
const noteNames = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];
const note = midi => ({midi, key: `${noteNames[midi % 12]}/${Math.floor(midi / 12) - 1}`, rest: false});
function exercise(name, pitches = [], overrides = {}) {
  const profile = INSTRUMENTS[name];
  return {instrument: profile.engineInstrument, soundProfile: name, transposition: profile.transpose,
    clef: ['grand', 'mixedStaff'].includes(profile.clef) ? 'treble' : profile.clef,
    ...(profile.clef === 'grand' ? {grandMode: 'two-hand'} : {}),
    ...(profile.clef === 'mixedStaff' ? {staffMode: 'mixed'} : {}),
    measures: [{events: pitches.map(note)}], ...overrides};
}

test('calibration reference stays within every instrument and sounding detector range', () => {
  for (const [name, profile] of Object.entries(INSTRUMENTS)) {
    const selected = selectCalibrationPitch(exercise(name));
    assert.ok(selected.midi >= profile.min && selected.midi <= profile.max, name);
    assert.ok(selected.midi + profile.transpose >= 36 && selected.midi + profile.transpose <= 90, name);
    assert.ok(!selected.noteKey.includes('#'), name);
  }
});

test('fixed treble, bass, alto and tenor references use the corresponding readable staff centre', () => {
  for (const [clef, name, midi, noteKey] of [
    ['treble', 'Violin', 71, 'b/4'], ['bass', 'Cello', 50, 'd/3'],
    ['alto', 'Viola', 60, 'c/4'], ['tenor', 'Cello', 57, 'a/3'],
  ]) {
    const selected = selectCalibrationPitch(exercise(name, [], {clef}));
    assert.equal(selected.clef, clef); assert.equal(selected.midi, midi); assert.equal(selected.noteKey, noteKey);
  }
});

test('current written register narrows the reference without transposing the displayed pitch', () => {
  for (const name of ['Clarinet', 'Alto Saxophone', 'Tenor Saxophone', 'Guitar', 'Bangdi G', 'Zhongruan']) {
    const selected = selectCalibrationPitch(exercise(name, [64, 65, 67]));
    assert.ok(selected.midi >= 64 && selected.midi <= 67, name);
    assert.equal(selected.noteKey, note(selected.midi).key);
  }
});

test('mixed and grand staff references switch clef for a low register, and include the lower voice', () => {
  for (const name of ['Pipa', 'Alto Sheng', 'Piano']) {
    assert.equal(selectCalibrationPitch(exercise(name, [48, 50, 55])).clef, 'bass');
    assert.equal(selectCalibrationPitch(exercise(name, [64, 67, 72])).clef, 'treble');
  }
  const selected = selectCalibrationPitch(exercise('Piano', [], {lowerMeasures: [{events: [note(48), note(55)]}]}));
  assert.equal(selected.clef, 'bass'); assert.equal(selected.midi, 50);
});

test('chord notes and older note keys without MIDI retain the selected register; rests do not', () => {
  const selected = selectCalibrationPitch(exercise('Violin', [], {measures: [{events: [
    {key: 'c/4', rest: true, midi: 60},
    {key: 'f#/5', rest: false, chord: [{key: 'a/5', midi: 81}]},
  ]}]}));
  assert.equal(selected.midi, 79); assert.equal(selected.noteKey, 'g/5');
});

test('single accidental register is retained instead of suggesting a pitch outside it', () => {
  const selected = selectCalibrationPitch(exercise('Violin', [66]));
  assert.equal(selected.midi, 66); assert.equal(selected.noteKey, 'f#/4');
});

test('extreme pitches outside detection fall back to a comfortable instrument reference', () => {
  for (const [name, pitches] of [['Piano', [21, 23]], ['Piano', [105, 108]], ['Bangdi G', [86, 88]]]) {
    const selected = selectCalibrationPitch(exercise(name, pitches));
    const sounding = selected.midi + INSTRUMENTS[name].transpose;
    assert.ok(sounding >= 36 && sounding <= 90, name);
    assert.ok(!selected.noteKey.includes('#'), name);
  }
});

test('calibration selection leaves the exercise unchanged and can read legacy engine-only profiles', () => {
  const source = exercise('Clarinet', [64, 67]);
  delete source.soundProfile; delete source.transposition;
  const before = JSON.stringify(source);
  const selected = selectCalibrationPitch(source);
  assert.equal(selected.midi, 67);
  assert.equal(JSON.stringify(source), before);
});
