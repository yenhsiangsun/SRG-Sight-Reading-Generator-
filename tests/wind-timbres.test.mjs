import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadModule} from './helpers.mjs';

const manifest = JSON.parse(fs.readFileSync('src/audio/sampleManifest.json', 'utf8'));
const {INSTRUMENTS} = loadModule('src/music/instruments.ts');
const {createTimbrePreview} = loadModule('src/audio/timbres.ts');
const {createPlaybackEvents} = loadModule('src/audio/PlaybackController.ts');
const {samplesForNotes} = loadModule('src/audio/loadRecordedSamples.ts');
const westernBanks = [
  ['Flute', 'flute', 'C4'],
  ['Clarinet', 'clarinet', 'A#3'],
  ['Oboe', 'oboe', 'C4'],
  ['Bassoon', 'bassoon', 'C4'],
  ['Trumpet', 'trumpet', 'C4'],
  ['French Horn', 'french-horn', 'F3'],
  ['Trombone', 'trombone', 'C4'],
  ['Tuba', 'tuba', 'C4'],
  ['Alto Saxophone', 'saxophone', 'D#3'],
  ['Tenor Saxophone', 'tenor-saxophone', 'A#2'],
];
// These are written ranges and existing sounding-pitch offsets. A temporary
// playback sound alias must not turn the selected instrument into a Flute score.
const diziRanges = [
  ['Bangdi G', 62, 88, 12], ['Bangdi F', 60, 86, 12],
  ['Bangdi A', 64, 90, 12], ['Bangdi C', 67, 93, 12],
  ['Qudi C', 55, 81, 12], ['Qudi Bb', 53, 79, 12],
  ['Qudi D', 57, 83, 12], ['Qudi E', 59, 85, 12],
  ['Xindi G', 62, 88, 0], ['Xindi F', 60, 86, 0],
  ['Xindi A', 64, 90, 0], ['Xindi Bb', 65, 91, 0],
];
const winds = Object.keys(INSTRUMENTS).filter(name =>
  ['木管', '銅管', '國樂・吹管'].includes(INSTRUMENTS[name].family));
const plain = value => JSON.parse(JSON.stringify(value));
const midiNote = midi => ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][midi % 12] + (Math.floor(midi / 12) - 1);

function fixture() {
  const synths = [], samplers = [], loads = [];
  const destination = {name: 'destination'};
  class Voice {
    volume = {value: 0};
    connections = [];
    attacks = [];
    released = 0;
    disposed = 0;
    connect(node) { this.connections.push(node); return this; }
    toDestination() { return this.connect(destination); }
    triggerAttackRelease(...args) { this.attacks.push(args); }
    releaseAll() { this.released++; }
    dispose() { this.disposed++; }
  }
  const tone = {
    Destination: destination,
    MonoSynth: class {},
    FMSynth: class {},
    PolySynth: class extends Voice {
      constructor(voiceType, options) {
        super(); this.voiceType = voiceType; this.options = options; synths.push(this);
      }
    },
    Sampler: class extends Voice {
      constructor(options) { super(); this.options = options; samplers.push(this); }
    },
    getContext: () => ({}),
  };
  for (const name of ['Filter', 'Chorus', 'Phaser', 'EQ3', 'Reverb', 'FeedbackDelay', 'Vibrato', 'AutoFilter', 'Compressor']) {
    tone[name] = class { constructor() { throw Error(`Wind voice unexpectedly created ${name}`); } };
  }
  const {createInstrumentSynth} = loadModule('src/audio/createInstrumentSynth.ts', 1, undefined, {tone});
  const source = fs.readFileSync('src/audio/createPlaybackInstrument.ts', 'utf8')
    .replace('import.meta.env.BASE_URL', "'/practice/'")
    .replace('import.meta.env.VITE_LOCAL_PIPA', 'false');
  const {createPlaybackInstrument, getPlaybackSoundProfile, hasSamples} = loadModule('src/audio/createPlaybackInstrument.ts', 1, source, {
    tone,
    './sampleManifest.json': manifest,
    './createInstrumentSynth': {createInstrumentSynth},
    './loadRecordedSamples': {
      samplesForNotes,
      loadRecordedSamples: async options => {
        loads.push(options);
        return Object.fromEntries(Object.entries(options.urls).map(([note, file]) =>
          [note, {length: 48000, numberOfChannels: 2, source: options.baseUrl + file}]));
      },
    },
  }, {document: {baseURI: 'capacitor://localhost/practice/'}});
  return {tone, destination, synths, samplers, loads, createInstrumentSynth, createPlaybackInstrument, getPlaybackSoundProfile, hasSamples};
}

function playPreview(voice, events, node, name) {
  for (const event of events) voice.triggerAttackRelease(event.note, event.duration, event.time + 7.125, event.velocity);
  assert.deepEqual(node.attacks, Array.from(events, event =>
    [event.note, event.duration, event.time + 7.125, event.velocity]), `${name}: preserve pitch, gate, clock and dynamics`);
  voice.releaseAll();
  voice.dispose();
  assert.equal(node.released, 1, name);
  assert.equal(node.disposed, 1, name);
}

test('all ten Western wind previews retain their own recorded bank and sounding pitch', async () => {
  const f = fixture();
  const selectedFolders = new Set();
  for (const [name, folder, firstSoundingPitch] of westernBanks) {
    const {events} = createPlaybackEvents(createTimbrePreview(name), 100);
    assert.equal(events[0].note.toUpperCase(), firstSoundingPitch, `${name}: written-to-sounding transposition`);
    const voice = await f.createPlaybackInstrument(name, events.map(event => event.note));
    const sampler = f.samplers.at(-1), load = f.loads.at(-1);
    assert.equal(f.synths.length, 0, `${name}: recordings must not become generic synthetic winds`);
    assert.equal(load.baseUrl, `/practice/samples/${folder}/`, name);
    assert.ok(Object.keys(load.urls).length > 0, name);
    for (const [root, file] of Object.entries(load.urls)) {
      assert.equal(file, manifest[name].urls[root], `${name}: root belongs to selected bank`);
      assert.equal(sampler.options.urls[root].source, `/practice/samples/${folder}/${file}`);
    }
    assert.equal(sampler.options.volume, manifest[name].volume, `${name}: calibrated recording level`);
    assert.deepEqual(sampler.connections, [f.destination], `${name}: direct recorded sound`);
    playPreview(voice, events, sampler, name);
    selectedFolders.add(load.baseUrl);
  }
  assert.equal(f.samplers.length, 10);
  assert.equal(f.loads.length, 10);
  assert.equal(selectedFolders.size, 10, 'no shared substitute wind bank');
});

test('every synthetic wind and explicit synth voice for recorded winds plays dry with unchanged event arguments', async () => {
  const f = fixture();
  for (const name of winds) {
    const {events} = createPlaybackEvents(createTimbrePreview(name), 100);
    // Recorded winds use their banks in production. Exercise their synth factory
    // separately so its direct-output contract also survives future callers.
    const voice = f.hasSamples(name)
      ? f.createInstrumentSynth(name)
      : await f.createPlaybackInstrument(name, events.map(event => event.note));
    const synth = f.synths.at(-1);
    assert.equal(synth.voiceType, f.tone.MonoSynth, name);
    assert.deepEqual(synth.connections, [f.destination], `${name}: no shared phase sweep or delay`);
    assert.equal(synth.maxPolyphony, 24, `${name}: retain chord capacity`);
    playPreview(voice, events, synth, name);
  }
  assert.equal(f.synths.length, winds.length);
  assert.equal(f.samplers.length, 0);
  assert.equal(f.loads.length, 0);
});

test('transposing Chinese wind previews are not transposed again by either sampled or dry voices', async () => {
  const f = fixture();
  for (const [name, expected] of [['Bangdi G', 'D5'], ['Qudi C', 'C5'], ['Alto Guan', 'D3']]) {
    const {events} = createPlaybackEvents(createTimbrePreview(name), 100);
    assert.equal(events[0].note, expected, name);
    const voice = await f.createPlaybackInstrument(name);
    const node = f.hasSamples(name) ? f.samplers.at(-1) : f.synths.at(-1);
    playPreview(voice, events, node, name);
    assert.equal(node.attacks[0][0], expected, `${name}: transpose exactly once`);
  }
});

test('membrane dizi use actual C-dizi recordings, Xindi retains flute substitution, and all preserve sounding ranges', async () => {
  const f = fixture();
  assert.deepEqual(Object.keys(INSTRUMENTS).filter(name => /^(?:Bangdi|Qudi|Xindi) /.test(name)), diziRanges.map(([name]) => name));
  for (const [name, min, max, transpose] of diziRanges) {
    const profile = INSTRUMENTS[name], preview = createTimbrePreview(name);
    assert.deepEqual([profile.min, profile.max, profile.transpose], [min, max, transpose], `${name}: original instrument range`);
    assert.equal(preview.soundProfile, name, `${name}: score still identifies the chosen dizi`);
    assert.equal(preview.transposition, transpose, name);
    assert.ok(preview.measures[0].events.every(note => note.midi >= min && note.midi <= max), `${name}: preview stays in written range`);
    const sound = name.startsWith('Xindi ') ? 'Flute' : 'Qudi C';
    const bank = manifest[sound];
    assert.equal(f.getPlaybackSoundProfile(name), sound, name);
    assert.equal(f.hasSamples(name), true, `${name}: UI and playback both report a recording`);
    const writtenPitches = Array.from({length: max - min + 1}, (_, i) => min + i);
    const exercise = {...preview, measures: [{totalUnits: writtenPitches.length, events: writtenPitches.map((midi, i) => ({
      key: midiNote(midi).replace(/(-?\d+)$/, '/$1').toLowerCase(), midi,
      rest: false, durationUnits: 1, startUnits: i,
    }))}]};
    const {events} = createPlaybackEvents(exercise, 100);
    assert.deepEqual(Array.from(events, event => event.note.toUpperCase()), writtenPitches.map(midi => midiNote(midi + transpose)), `${name}: original sounding range`);
    const voice = await f.createPlaybackInstrument(name, events.map(event => event.note));
    const sampler = f.samplers.at(-1), load = f.loads.at(-1);
    assert.equal(load.baseUrl, `/practice/samples/${bank.folder}/`, name);
    assert.ok(Object.keys(load.urls).length > 0, name);
    for (const [root, file] of Object.entries(load.urls)) {
      assert.equal(file, bank.urls[root], `${name}: actual recording root`);
      assert.equal(sampler.options.urls[root].source, `/practice/samples/${bank.folder}/${file}`);
    }
    assert.equal(sampler.options.volume, bank.volume, `${name}: recording level`);
    assert.deepEqual(sampler.connections, [f.destination], `${name}: clean recorded output`);
    playPreview(voice, events, sampler, name);
  }
  assert.equal(f.synths.length, 0, 'dizi variants must never use their synthetic whistle-like voices');
  assert.equal(f.samplers.length, 12);
  assert.equal(f.loads.length, 12);
});

test('dizi bank routing leaves every other instrument playback profile and recording status unchanged', () => {
  const f = fixture(), dizi = new Set(diziRanges.map(([name]) => name));
  for (const name of Object.keys(INSTRUMENTS).filter(name => !dizi.has(name))) {
    assert.equal(f.getPlaybackSoundProfile(name), name, name);
    assert.equal(f.hasSamples(name), Object.hasOwn(manifest, name), name);
  }
});

test('the approved soprano Sheng voice preserves its complete synthesis settings', () => {
  const f = fixture();
  const voice = f.createInstrumentSynth('Sheng'), synth = f.synths[0];
  assert.deepEqual(plain(synth.options), {
    oscillator: {type: 'custom', partials: [1, .52, .33, .17, .11, .04]},
    envelope: {attack: .045, decay: .12, sustain: .88, release: .12},
    filter: {type: 'lowpass', rolloff: -12, Q: .68},
    filterEnvelope: {attack: .045, decay: .12, sustain: .88, release: .12, baseFrequency: 1850, octaves: 2.5},
  });
  assert.equal(synth.volume.value, -18);
  assert.equal(synth.maxPolyphony, 24);
  assert.deepEqual(synth.connections, [f.destination]);
  voice.dispose();
  assert.equal(synth.disposed, 1);
});
