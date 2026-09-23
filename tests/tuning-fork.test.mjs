import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

const {TuningForkController, normalizeTuningFrequency, loadTuningFrequency, saveTuningFrequency} = loadModule('src/audio/tuningFork.ts');
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {resolve = yes; reject = no;});
  return {promise, resolve, reject};
}
function fixture(unlock = async () => {}) {
  const log = [], states = [];
  const controller = new TuningForkController({
    unlock,
    createVoice: () => {
      log.push('create');
      return {
        start: frequency => log.push(['start', frequency]),
        setFrequency: frequency => log.push(['frequency', frequency]),
        stop: () => log.push('stop'),
      };
    },
  }, state => states.push(state));
  return {controller, log, states};
}

test('tuning fork plays the exact reference Hz and updates the existing voice without retriggering', async () => {
  const f = fixture();
  await f.controller.start();
  f.controller.setFrequency(442.5);
  await f.controller.start();
  assert.deepEqual(f.log, ['create', ['start', 440], ['frequency', 442.5]]);
  assert.deepEqual(f.states, ['starting', 'playing']);
  f.controller.stop();
  f.controller.stop();
  assert.equal(f.log.filter(item => item === 'stop').length, 1);
  await f.controller.start();
  assert.deepEqual(f.log.at(-1), ['start', 442.5]);
});

test('closing or blocking the tuning fork cancels a pending audio unlock', async () => {
  for (const action of ['stop', 'dispose']) {
    const unlock = deferred();
    const f = fixture(() => unlock.promise);
    const started = f.controller.start();
    f.controller[action]();
    const previousStates = [...f.states];
    unlock.resolve();
    await started;
    assert.deepEqual(f.log, []);
    assert.deepEqual(f.states, previousStates);
  }
});

test('rapid reopening cannot resurrect an older tone and uses the latest reference frequency', async () => {
  const first = deferred(), second = deferred();
  let attempts = 0;
  const f = fixture(() => attempts++ === 0 ? first.promise : second.promise);
  const oldStart = f.controller.start();
  f.controller.stop();
  const newStart = f.controller.start();
  f.controller.setFrequency(415.3);
  first.resolve();
  await oldStart;
  assert.deepEqual(f.log, []);
  second.resolve();
  await newStart;
  assert.deepEqual(f.log, ['create', ['start', 415.3]]);
  f.controller.dispose();
  const lastStates = [...f.states];
  await f.controller.start();
  assert.equal(f.log.filter(item => item === 'create').length, 1);
  assert.deepEqual(f.states, lastStates);
});

test('audio unlock failures are recoverable and canceled failures do not reopen the panel', async () => {
  let attempts = 0;
  const f = fixture(async () => {if (attempts++ === 0) throw Error('audio unavailable');});
  await f.controller.start();
  assert.equal(f.states.at(-1), 'error');
  await f.controller.start();
  assert.equal(f.states.at(-1), 'playing');
  const canceled = deferred();
  const g = fixture(() => canceled.promise);
  const pending = g.controller.start();
  g.controller.stop();
  canceled.reject(Error('late failure'));
  await pending;
  assert.deepEqual(g.states, ['starting', 'idle']);
});

test('reference frequency keeps decimal precision and has safe finite bounds', () => {
  assert.equal(normalizeTuningFrequency(442.56), 442.6);
  assert.equal(normalizeTuningFrequency(300), 400);
  assert.equal(normalizeTuningFrequency(900), 480);
  for (const invalid of [NaN, Infinity, -Infinity, undefined, null, '442', {}])
    assert.equal(normalizeTuningFrequency(invalid), 440);
});

test('frequency survives reload while corrupt or unavailable storage retains a usable default', () => {
  let saved = null;
  const storage = () => ({getItem: () => saved, setItem: (_key, value) => {saved = value;}});
  assert.equal(loadTuningFrequency(storage), 440);
  assert.equal(saveTuningFrequency(442.5, storage), true);
  assert.equal(loadTuningFrequency(storage), 442.5);
  assert.equal(saveTuningFrequency(440, storage), true);
  assert.equal(loadTuningFrequency(storage), 440);
  for (const corrupt of ['{', '{}', 'null', '"442"', '{"frequency":"442"}']) {
    saved = corrupt;
    assert.equal(loadTuningFrequency(storage), 440);
  }
  const unavailable = () => {throw Error('private browsing');};
  assert.equal(loadTuningFrequency(unavailable), 440);
  assert.equal(saveTuningFrequency(442, unavailable), false);
});

test('Tone adapter uses a quiet sine in Hz, smooth frequency changes, and releases before disposal', async () => {
  const calls = [], timers = [];
  let voice;
  class Synth {
    volume = {value: 0};
    frequency = {rampTo: (...args) => calls.push(['ramp', ...args])};
    constructor(options) {voice = this; this.options = options;}
    toDestination() {return this;}
    triggerAttack(...args) {calls.push(['attack', ...args]);}
    triggerRelease(...args) {calls.push(['release', ...args]);}
    dispose() {calls.push(['dispose']);}
  }
  const tone = {Synth, start: async () => calls.push(['unlock']), immediate: () => 12.5};
  const {toneTuningAudio} = loadModule('src/audio/toneTuningFork.ts', 1, undefined, {tone}, {
    setTimeout: (fn, delay) => {timers.push({fn, delay});},
  });
  await toneTuningAudio.unlock();
  const fork = toneTuningAudio.createVoice();
  fork.start(442.5);
  fork.setFrequency(443.1);
  assert.equal(voice.options.oscillator.type, 'sine');
  assert.equal(voice.volume.value, -24);
  assert.ok(voice.options.envelope.attack > 0 && voice.options.envelope.release > 0);
  assert.deepEqual(calls, [['unlock'], ['attack', 442.5, 12.5], ['ramp', 443.1, 0.025, 12.5]]);
  fork.stop();
  fork.stop();
  assert.deepEqual(calls.at(-1), ['release', 12.5]);
  assert.equal(timers.length, 1);
  assert.ok(timers[0].delay >= voice.options.envelope.release * 1000);
  timers[0].fn();
  assert.deepEqual(calls.at(-1), ['dispose']);
});
