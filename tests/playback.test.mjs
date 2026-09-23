import test from 'node:test';
import assert from 'node:assert/strict';
import { loadModule } from './helpers.mjs';

const { PlaybackController, createPlaybackEvents, createMetronomeEvents } = loadModule('src/audio/PlaybackController.ts');
const exercise = { measures: [{ events: [
  { key: 'c/4', rest: false, durationUnits: 4 },
  { key: 'b/4', rest: true, durationUnits: 2 },
  { key: 'eb/4', rest: false, durationUnits: 3 },
] }] };

function fixture(unlock = async () => {}, withClicks = false) {
  const log = [];
  const scheduled = new Map();
  let nextId = 0;
  let clock = 0;
  let running = false;
  const audio = {
    unlock,
    setLoop: (duration) => log.push(['loop', duration]),
    ...(withClicks ? { createClickSynth: () => ({
      triggerAttackRelease: (...args) => log.push(['click', ...args]),
      releaseAll: () => log.push('click-release'), dispose: () => log.push('click-dispose'),
    }) } : {}),
    createSynth: () => {
      log.push('create');
      return { triggerAttackRelease: (...args) => log.push(args), releaseAll: () => log.push('release'), dispose: () => log.push('dispose') };
    },
    schedule: (callback, time) => { const id = nextId++; scheduled.set(id, { callback, time }); return id; },
    scheduleEnd: (callback, time) => { const id = nextId++; scheduled.set(id, { callback, time }); return id; },
    clear: (id) => scheduled.delete(id),
    start: () => { running = true; log.push('start'); },
    pause: () => { running = false; log.push('pause'); },
    stop: () => { running = false; clock = 0; log.push('stop'); },
    getSeconds: () => clock,
    setTempo: (bpm) => log.push(['tempo', bpm]),
  };
  const states = [];
  const player = new PlaybackController(audio, (state, error) => states.push({state,error}));
  function advance(seconds) {
    if (!running) return;
    const end = clock + seconds;
    for (const [id, event] of [...scheduled].sort((a,b)=>a[1].time-b[1].time)) {
      if (event.time >= clock && event.time <= end) {
        scheduled.delete(id);
        event.callback(event.time);
        if (!running) return;
      }
    }
    clock = end;
  }
  return { player, states, log, scheduled, advance, audio };
}

test('score playback forwards marked velocity and staccato duration to the instrument',async()=>{
  const f=fixture();
  const ex={timeSignature:'4/4',measures:[{totalUnits:16,events:[{key:'c/4',rest:false,durationUnits:16,dynamic:'p',articulation:'staccato'}]}]};
  await f.player.play(ex,60);
  f.advance(0.1);
  assert.deepEqual(f.log.find(item=>Array.isArray(item)&&item[0]==='c4'),['c4',2,0,0.42]);
  f.player.stop();
});

test('seeking and resuming inside a chord retains every simultaneous pitch for only its remaining duration',async()=>{
  const f=fixture();
  const ex={timeSignature:'4/4',measures:[{totalUnits:16,events:[{key:'c/4',rest:false,durationUnits:16,
    chord:[{key:'c/4',octave:4,midi:60},{key:'e/4',octave:4,midi:64},{key:'g/4',octave:4,midi:67}],
  }]}]};
  await f.player.seek(ex,60,1);
  await f.player.play(ex,60);
  f.advance(.5);
  assert.deepEqual(f.log.filter(x=>Array.isArray(x)&&/^[ceg]4$/.test(x[0])).map(x=>x.slice(0,3)),[['c4',3,0],['e4',3,0],['g4',3,0]]);
  f.player.pause();await f.player.play(ex,60);f.advance(.1);
  assert.deepEqual(f.log.filter(x=>Array.isArray(x)&&/^[ceg]4$/.test(x[0])).slice(-3).map(x=>x.slice(0,2)),[['c4',2.5],['e4',2.5],['g4',2.5]]);
  f.player.stop();
});

test('passage loop schedules only the selected bar, four count-in clicks and repeating audio-clock cursor', async()=>{
  const ex={timeSignature:'4/4',measures:[
    {totalUnits:16,events:[{key:'c/4',rest:false,durationUnits:16}]},
    {timeSignature:'6/8',totalUnits:12,events:[{key:'d/4',rest:false,durationUnits:12}]},
    {totalUnits:16,events:[{key:'e/4',rest:false,durationUnits:16}]},
  ]};
  const f=fixture(undefined,true);
  await f.player.playLoop(ex,60,2,2);
  assert.ok(f.player.isLooping());
  assert.deepEqual(f.log.filter(x=>Array.isArray(x)&&x[0]==='loop').at(-1),['loop',5]);
  assert.equal(f.player.getPosition(),4);
  f.advance(2.5);
  assert.equal(f.log.filter(x=>Array.isArray(x)&&x[0]==='click').length,4);
  assert.deepEqual(f.log.filter(x=>Array.isArray(x)&&/^[a-g]4$/.test(x[0])),[['d4',3,2,.73]]);
  assert.equal(f.player.getPosition(),4.5);
  f.player.pause();await f.player.play(ex,60);
  f.advance(0.1);
  assert.equal(f.log.filter(x=>Array.isArray(x)&&x[0]==='d4').at(-1)[1],2.5);
  f.advance(3);
  assert.equal(f.player.getPosition(),4);
  await f.player.seek(ex,60,1);
  assert.equal(f.player.isLooping(),false);
  f.player.stop();assert.equal(f.scheduled.size,0);
});

test('stopping while loop samples load disposes late audio and never restarts',async()=>{
  let resolve,loaded;const f=fixture();let disposed=false;
  const loading=new Promise(r=>{loaded=r;});
  f.audio.createSynth=()=>new Promise(r=>{resolve=r;loaded();});
  const pending=f.player.playLoop(exercise,60,1,1);
  await loading;
  f.player.stop();
  resolve({triggerAttackRelease(){throw Error('stale audio');},releaseAll(){},dispose(){disposed=true;}});
  await pending;
  assert.equal(disposed,true);assert.equal(f.scheduled.size,0);assert.ok(!f.log.includes('start'));
});

test('resuming during loop count-in never sounds the preceding bar',async()=>{
  const ex={timeSignature:'4/4',measures:[{events:[{key:'c/4',rest:false,durationUnits:16}]},{events:[{key:'d/4',rest:false,durationUnits:16}]}]};
  const f=fixture(undefined,true);await f.player.playLoop(ex,60,2,2);
  f.advance(1);f.player.pause();await f.player.play(ex,60);f.advance(2);
  assert.equal(f.log.filter(x=>Array.isArray(x)&&x[0]==='c4').length,0);
  assert.equal(f.log.filter(x=>Array.isArray(x)&&x[0]==='d4').length,0);
  f.player.stop();
});

test('quarter-note BPM preserves rest gaps and dotted durations', () => {
  const result = createPlaybackEvents(exercise, 60);
  assert.equal(result.duration, 2.25);
  assert.equal(JSON.stringify(result.events), JSON.stringify([
    {note:'c4',duration:1,time:0}, {note:'eb4',duration:.75,time:1.5},
  ]));
  assert.equal(createPlaybackEvents(exercise, 120).duration, 1.125);
});

test('pause can last beyond original end; resume retains schedule until musical completion', async () => {
  const f = fixture();
  await f.player.play(exercise, 60);
  f.advance(.5);
  f.player.pause();
  f.advance(100);
  assert.equal(f.states.at(-1).state, 'paused');
  assert.equal(f.log.filter(x=>x==='dispose').length, 0);
  await f.player.play(exercise, 60);
  assert.equal(f.log.filter(x=>x==='create').length, 1);
  f.advance(2.1);
  assert.equal(f.states.at(-1).state, 'idle');
  assert.equal(f.scheduled.size, 0);
  assert.equal(f.log.filter(x=>Array.isArray(x)&&x[0]==='eb4').length,1);
});

test('replay while playing or paused starts a new schedule at zero', async () => {
  const f = fixture();
  await f.player.play(exercise, 72);
  f.advance(.2);
  await f.player.replay(exercise, 72);
  assert.equal(f.states.at(-1).state, 'playing');
  assert.equal(f.log.filter(x=>x==='create').length,2);
  assert.equal([...f.scheduled.values()][0].time,0);
  f.player.pause();
  await f.player.replay(exercise, 72);
  assert.equal(f.states.at(-1).state,'playing');
  assert.equal(f.log.filter(x=>x==='create').length,3);
  assert.equal(f.scheduled.size,3);
});

test('rapid play clicks share one pending audio startup', async () => {
  let resolve;
  let unlocks = 0;
  const f = fixture(() => { unlocks++; return new Promise(r=>{resolve=r;}); });
  const pending = f.player.play(exercise,72);
  await f.player.play(exercise,72);
  assert.equal(unlocks,1);
  resolve();
  await pending;
  assert.equal(f.log.filter(x=>x==='create').length,1);
});

test('stop during audio startup prevents an obsolete exercise from playing', async () => {
  let resolve;
  const f = fixture(() => new Promise(r=>{resolve=r;}));
  const pending = f.player.play(exercise,72);
  f.player.stop();
  resolve();
  await pending;
  assert.equal(f.scheduled.size,0);
  assert.equal(f.log.includes('create'),false);
  assert.equal(f.states.at(-1).state,'idle');
});

test('replay supersedes a pending startup and old completion callbacks', async () => {
  const resolvers=[];
  const f=fixture(()=>new Promise(r=>resolvers.push(r)));
  const first=f.player.play(exercise,72);
  const second=f.player.replay(exercise,72);
  resolvers[0](); await first;
  assert.equal(f.log.includes('create'),false);
  resolvers[1](); await second;
  const oldEnd=[...f.scheduled.values()].at(-1).callback;
  const third=f.player.replay(exercise,72);
  resolvers[2](); await third;
  oldEnd();
  assert.equal(f.states.at(-1).state,'playing');
});

test('unmount disposes resources and prevents late UI updates', async () => {
  const f=fixture();
  await f.player.play(exercise,72);
  const oldEnd=[...f.scheduled.values()].at(-1).callback;
  const count=f.states.length;
  f.player.dispose();
  oldEnd();
  assert.equal(f.scheduled.size,0);
  assert.equal(f.states.length,count);
  assert.equal(f.log.filter(x=>x==='dispose').length,1);
});

test('audio unlock failure reports an error and permits retry', async () => {
  let fail=true;
  const f=fixture(async()=>{if(fail) throw Error('Audio unavailable');});
  await f.player.play(exercise,72);
  assert.equal(f.states.at(-1).state,'idle');
  assert.equal(f.states.at(-1).error,'播放未能啟動，請再試一次。');
  fail=false;
  await f.player.play(exercise,72);
  assert.equal(f.states.at(-1).state,'playing');
});

test('metronome counts denominator beats in /4 and /8 with shared mixed-meter boundaries', () => {
  const mixed = {timeSignature:'3/4', measures:[
    {timeSignature:'3/4',totalUnits:12,groups:[4,4,4],events:[]},
    {timeSignature:'6/8',totalUnits:12,groups:[6,6],events:[]},
    {timeSignature:'7/8',totalUnits:14,groups:[4,4,6],events:[]},
  ]};
  assert.equal(JSON.stringify(createMetronomeEvents(mixed,60).map(({time,accent})=>({time,accent}))),JSON.stringify([
    {time:0,accent:true},{time:1,accent:false},{time:2,accent:false},
    {time:3,accent:true},{time:3.5,accent:false},{time:4,accent:false},{time:4.5,accent:false},{time:5,accent:false},{time:5.5,accent:false},
    {time:6,accent:true},{time:6.5,accent:false},{time:7,accent:false},{time:7.5,accent:false},{time:8,accent:false},{time:8.5,accent:false},{time:9,accent:false},
  ]));
});

test('metronome can be toggled during score playback without restarting notes', async () => {
  const f=fixture(undefined,true);
  await f.player.play(exercise,60);
  const count=f.scheduled.size;
  f.player.setMetronome(true);
  f.advance(.5);
  assert.equal(f.log.filter(x=>Array.isArray(x)&&x[0]==='click').length,1);
  f.player.setMetronome(false);
  f.advance(1.6);
  assert.equal(f.log.filter(x=>Array.isArray(x)&&x[0]==='click').length,1);
  assert.equal(f.log.filter(x=>x==='start').length,1);
  assert.ok(count>3);
  f.player.stop();
  assert.equal(f.log.filter(x=>x==='click-dispose').length,1);
});

test('standalone metronome loops silently, then full-score play resets to the first bar', async () => {
  const f=fixture(undefined,true);
  f.player.setMetronome(true);
  await f.player.play(exercise,60,true);
  assert.equal(f.log.includes('create'),false);
  assert.ok(f.log.some(x=>Array.isArray(x)&&x[0]==='loop'&&x[1]===2.25));
  await f.player.play(exercise,60);
  assert.equal(f.log.filter(x=>x==='create').length,1);
  assert.equal(f.states.at(-1).state,'playing');
  assert.ok(f.log.some(x=>Array.isArray(x)&&x[0]==='loop'&&x[1]===null));
  f.player.stop();
  await f.player.play(exercise,60,true);
  f.player.setMetronome(false);
  assert.equal(f.states.at(-1).state,'idle');
  assert.equal(f.scheduled.size,0);
});

test('position follows the audio clock, freezes when paused, and remains at the end until replay', async () => {
  const f = fixture();
  await f.player.play(exercise, 60);
  f.advance(.5);
  assert.equal(f.player.getPosition(), .5);
  f.player.pause();
  f.advance(10);
  assert.equal(f.player.getPosition(), .5);
  await f.player.play(exercise, 60);
  f.advance(.25);
  assert.equal(f.player.getPosition(), .75);
  f.advance(2);
  assert.equal(f.player.getPosition(), 2.25);
  assert.equal(f.states.at(-1).state, 'idle');
  await f.player.play(exercise, 60);
  assert.equal(f.player.getPosition(), 0);
  f.advance(.2);
  f.player.stop();
  assert.equal(f.player.getPosition(), 0);
});

test('idle seek is silent and begins the next play inside the selected note', async () => {
  const f = fixture();
  await f.player.seek(exercise, 60, .4);
  assert.equal(f.player.getPosition(), .4);
  assert.equal(f.states.at(-1).state, 'idle');
  assert.equal(f.log.includes('create'), false);
  assert.equal(f.scheduled.size, 0);
  await f.player.play(exercise, 60);
  f.advance(.1);
  assert.equal(f.player.getPosition(), .5);
  assert.deepEqual(f.log.find(x => Array.isArray(x) && x[0] === 'c4'), ['c4', .6, 0]);
  assert.equal([...f.scheduled.values()].at(-1).time, 2.15);
});

test('seek into a rest preserves its remaining gap instead of playing the preceding note', async () => {
  const f = fixture();
  await f.player.seek(exercise, 60, 1.25);
  await f.player.play(exercise, 60);
  f.advance(.24);
  assert.equal(f.log.some(x => Array.isArray(x) && ['c4', 'eb4'].includes(x[0])), false);
  f.advance(.02);
  assert.deepEqual(f.log.find(x => Array.isArray(x) && x[0] === 'eb4'), ['eb4', .75, .25]);
});

test('paused seek stays paused and trims both hands at the new start', async () => {
  const grand = { measures: [{events: [{key:'c/5', rest:false, durationUnits:8}]}],
    lowerMeasures: [{events: [{key:'c/3', rest:false, durationUnits:4}, {key:'g/3', rest:false, durationUnits:4}]}] };
  const f = fixture();
  await f.player.play(grand, 60);
  f.advance(.1);
  f.player.pause();
  await f.player.seek(grand, 60, 1.25);
  assert.equal(f.states.at(-1).state, 'paused');
  assert.equal(f.player.getPosition(), 1.25);
  assert.equal(f.scheduled.size, 0);
  const before = f.log.length;
  await f.player.play(grand, 60);
  f.advance(.01);
  const resumed = f.log.slice(before).filter(x => Array.isArray(x) && ['c5','c3','g3'].includes(x[0]));
  assert.deepEqual(resumed, [['c5', .75, 0], ['g3', .75, 0]]);
});

test('pause and resume restore a sounding note tail without replaying its full duration', async () => {
  const f = fixture();
  await f.player.play(exercise, 60);
  f.advance(.4);
  f.player.pause();
  await f.player.play(exercise, 60);
  f.advance(.01);
  assert.deepEqual(f.log.filter(x => Array.isArray(x) && x[0] === 'c4'), [['c4', 1, 0], ['c4', .6, .4]]);
  assert.equal(f.log.filter(x => x === 'create').length, 1);
});

test('playing seek disposes prior voices and ignores obsolete scheduled callbacks', async () => {
  const f = fixture();
  await f.player.play(exercise, 60);
  const obsolete = [...f.scheduled.values()].map(x => x.callback);
  f.advance(.2);
  await f.player.seek(exercise, 60, 1.75);
  assert.equal(f.states.at(-1).state, 'playing');
  assert.equal(f.player.getPosition(), 1.75);
  assert.equal(f.log.filter(x => x === 'dispose').length, 1);
  const before = f.log.length;
  obsolete.forEach(callback => callback(999));
  assert.equal(f.log.length, before);
  assert.equal(f.states.at(-1).state, 'playing');
  f.advance(.01);
  assert.deepEqual(f.log.findLast(x => Array.isArray(x) && x[0] === 'eb4'), ['eb4', .5, 0]);
});

test('rapid seeks supersede pending sample loads and only the latest target starts', async () => {
  const f = fixture();
  const loads = [];
  let disposed = 0;
  f.audio.createSynth = () => new Promise(resolve => loads.push(() => resolve({
    triggerAttackRelease: () => {}, releaseAll: () => {}, dispose: () => { disposed++; },
  })));
  const first = f.player.play(exercise, 60);
  await new Promise(setImmediate);
  const second = f.player.seek(exercise, 60, .5);
  await new Promise(setImmediate);
  const third = f.player.seek(exercise, 60, 1.75);
  await new Promise(setImmediate);
  assert.equal(loads.length, 3);
  loads[1](); await second;
  loads[0](); await first;
  assert.equal(disposed, 2);
  assert.equal(f.log.includes('start'), false);
  loads[2](); await third;
  assert.equal(f.log.filter(x => x === 'start').length, 1);
  assert.equal(f.player.getPosition(), 1.75);
  assert.equal([...f.scheduled.values()].at(-1).time, .8);
});

test('stop cancels a pending seek load without resetting the next session later', async () => {
  const f = fixture();
  await f.player.play(exercise, 60);
  let finish;
  let disposed = 0;
  f.audio.createSynth = () => new Promise(resolve => { finish = () => resolve({
    triggerAttackRelease: () => {}, releaseAll: () => {}, dispose: () => { disposed++; },
  }); });
  const seeking = f.player.seek(exercise, 60, .75);
  await new Promise(setImmediate);
  f.player.stop();
  finish();
  await seeking;
  assert.equal(disposed, 1);
  assert.equal(f.states.at(-1).state, 'idle');
  assert.equal(f.player.getPosition(), 0);
  assert.equal(f.scheduled.size, 0);
});

test('metronome-only time never advances score position', async () => {
  const f = fixture(undefined, true);
  f.player.setMetronome(true);
  await f.player.play(exercise, 60, true);
  f.advance(1.5);
  assert.equal(f.player.getPosition(), 0);
  await f.player.play(exercise, 60);
  f.advance(.25);
  assert.equal(f.player.getPosition(), .25);
});

test('seek clamps out-of-range targets and a different exercise starts from zero', async () => {
  const f = fixture();
  await f.player.seek(exercise, 60, -10);
  assert.equal(f.player.getPosition(), 0);
  await f.player.seek(exercise, 60, 100);
  assert.equal(f.player.getPosition(), 2.25);
  await f.player.seek(exercise, 60, 1);
  await f.player.play({...exercise}, 60);
  assert.equal(f.player.getPosition(), 0);
  await f.player.seek(exercise, 60, 100);
  assert.equal(f.states.at(-1).state, 'idle');
  assert.equal(f.scheduled.size, 0);
  assert.equal(f.player.getPosition(), 2.25);
});

test('a fractional seek keeps metronome clicks aligned with score beats', async () => {
  const f = fixture(undefined, true);
  f.player.setMetronome(true);
  await f.player.seek(exercise, 60, .75);
  await f.player.play(exercise, 60);
  f.advance(.24);
  assert.equal(f.log.some(x => Array.isArray(x) && x[0] === 'click'), false);
  f.advance(.02);
  assert.deepEqual(f.log.find(x => Array.isArray(x) && x[0] === 'click'), ['click', 'G5', .025, .25, .72]);
});

test('an idle tempo change can retain the same musical point by scaling seek seconds', async () => {
  const f = fixture();
  await f.player.seek(exercise, 60, 1.75);
  await f.player.seek(exercise, 120, f.player.getPosition() * 60 / 120);
  assert.equal(f.player.getPosition(), .875);
  await f.player.play(exercise, 120);
  f.advance(.01);
  assert.deepEqual(f.log.find(x => Array.isArray(x) && x[0] === 'eb4'), ['eb4', .25, 0]);
});

test('standalone metronome starts at beat zero and preserves the selected score start', async () => {
  const f = fixture(undefined, true);
  await f.player.seek(exercise, 60, 1.75);
  f.player.setMetronome(true);
  await f.player.play(exercise, 60, true);
  assert.equal([...f.scheduled.values()][0].time, 0);
  f.advance(.5);
  assert.equal(f.player.getPosition(), 1.75);
  assert.deepEqual(f.log.find(x => Array.isArray(x) && x[0] === 'click'), ['click', 'C6', .025, 0, .9]);
  await f.player.play(exercise, 60);
  assert.equal(f.player.getPosition(), 1.75);
  f.advance(.01);
  assert.deepEqual(f.log.find(x => Array.isArray(x) && x[0] === 'eb4'), ['eb4', .5, 0]);
});

test('turning standalone metronome off retains bookmark, while explicit stop clears it', async () => {
  const f = fixture(undefined, true);
  await f.player.seek(exercise, 60, 1.25);
  f.player.setMetronome(true);
  await f.player.play(exercise, 60, true);
  f.advance(.5);
  f.player.setMetronome(false);
  assert.equal(f.states.at(-1).state, 'idle');
  assert.equal(f.player.getPosition(), 1.25);
  await f.player.play(exercise, 60);
  f.advance(.1);
  assert.equal(f.log.some(x => Array.isArray(x) && ['c4', 'eb4'].includes(x[0])), false);
  f.player.stop();
  assert.equal(f.player.getPosition(), 0);
  await f.player.seek(exercise, 60, 1.25);
  f.player.setMetronome(true);
  await f.player.play(exercise, 60, true);
  f.player.stop();
  assert.equal(f.player.getPosition(), 0);
  await f.player.play(exercise, 60);
  assert.equal(f.player.getPosition(), 0);
});

test('a quick pause also pauses a Tone start still scheduled inside audio lookahead', async () => {
  let now = 0;
  const states = [{time: 0, state: 'stopped'}];
  const stateAt = time => states.filter(event => event.time <= time).at(-1)?.state;
  let eventId = 0;
  const transport = {
    bpm: {value: 60}, position: 0,
    start(time = now + .1) { states.push({time, state: 'started'}); },
    pause(time) {
      // This is Tone Clock.pause's contract: a pause before the pending start is ignored.
      if (stateAt(time) === 'started') states.push({time, state: 'paused'});
    },
    stop(time) {
      while (states.at(-1)?.time >= time) states.pop();
      states.push({time, state: 'stopped'});
    },
    getSecondsAtTime: () => 0,
    schedule: () => eventId++, scheduleOnce: () => eventId++, clear: () => {},
  };
  class Synth {
    volume = {value: 0};
    toDestination() { return this; }
    triggerAttackRelease() {}
    releaseAll() {}
    dispose() {}
  }
  const {usePlayback} = loadModule('src/hooks/usePlayback.ts', 90210, undefined, {
    react: {
      useEffect: effect => effect(), useRef: current => ({current}),
      useState: value => [value, () => {}], useCallback: callback => callback,
    },
    tone: {
      getTransport: () => transport, now: () => now + .1, immediate: () => now,
      start: async () => {}, PolySynth: Synth, Synth,
    },
    '../audio/createPlaybackInstrument': {createPlaybackInstrument: () => new Synth()},
  });
  const playback = usePlayback();
  await playback.play(exercise, 60);
  playback.pause();
  now = .2;
  assert.equal(stateAt(now), 'paused');
  await playback.play(exercise, 60);
  playback.pause();
  now = .4;
  assert.equal(stateAt(now), 'paused');
  playback.stop();
});
