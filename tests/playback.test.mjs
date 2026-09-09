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
  return { player, states, log, scheduled, advance };
}

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
  assert.equal(JSON.stringify(createMetronomeEvents(mixed,60)),JSON.stringify([
    {time:0,accent:true},{time:1,accent:false},{time:2,accent:false},
    {time:3,accent:true},{time:4,accent:false},{time:5,accent:false},{time:6,accent:false},{time:7,accent:false},{time:8,accent:false},
    {time:9,accent:true},{time:10,accent:false},{time:11,accent:false},{time:12,accent:false},{time:13,accent:false},{time:14,accent:false},{time:15,accent:false},
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
