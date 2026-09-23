import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';
const {measureTimeline,tempoMark}=loadModule('src/audio/tempo.ts');
const {createPlaybackEvents,createMetronomeEvents}=loadModule('src/audio/PlaybackController.ts');
const {loopWindow}=loadModule('src/practice/loop.ts');
const plain=value=>JSON.parse(JSON.stringify(value));
function bar(meter){
  const [count,denominator]=meter.split('/').map(Number),units=16/denominator;
  return {timeSignature:meter,totalUnits:count*units,events:Array.from({length:count},(_,i)=>({key:'c/4',rest:false,startUnits:i*units,durationUnits:units}))};
}

test('3/4 → 6/8 → 4/4 → 7/8 → 3/4 doubles and halves pulse speed without changing note values',()=>{
  const ex={timeSignature:'3/4',measures:['3/4','6/8','4/4','7/8','3/4'].map(bar)};
  const bars=measureTimeline(ex,60);
  assert.deepEqual(plain(bars.map(b=>[b.start,b.duration,b.unit*b.secondsPerUnit])),[[0,3,1],[3,3,.5],[6,4,1],[10,3.5,.5],[13.5,3,1]]);
  const played=createPlaybackEvents(ex,60);
  assert.equal(played.duration,16.5);
  assert.deepEqual(plain(played.events.map(n=>n.time)),[0,1,2,3,3.5,4,4.5,5,5.5,6,7,8,9,10,10.5,11,11.5,12,12.5,13,13.5,14.5,15.5]);
  assert.deepEqual(plain(createMetronomeEvents(ex,60).map(n=>n.time)),plain(played.events.map(n=>n.time)));
  assert.equal(tempoMark(ex,60),'♩ = 60 · ♪ = 120');
  // A quarter note in the /8 bar still lasts one second.
  ex.measures[1].events=[{key:'d/4',rest:false,durationUnits:4},{key:'d/4',rest:false,durationUnits:8}];
  assert.equal(createPlaybackEvents(ex,60).events.find(n=>n.time===3).duration,1);
  const grand={...ex,lowerMeasures:ex.measures.map(m=>({...m,events:[{key:'c/3',rest:false,durationUnits:m.totalUnits}]}))};
  assert.deepEqual(plain(createPlaybackEvents(grand,60).events.filter(n=>n.note==='c3').map(n=>[n.time,n.duration])),[[0,3],[3,3],[6,4],[10,3.5],[13.5,3]]);
});

test('opening /8 BPM is retained; switching to /4 halves the pulse rate and returning restores it',()=>{
  const ex={timeSignature:'6/8',measures:['6/8','3/4','7/8'].map(bar)};
  assert.deepEqual(plain(measureTimeline(ex,60).map(b=>[b.start,b.duration,b.unit*b.secondsPerUnit])),[[0,6,1],[6,6,2],[12,7,1]]);
  assert.equal(tempoMark(ex,60),'♪ = 60 · ♩ = 30');
  assert.equal(tempoMark({...ex,measures:[bar('6/8')]},60),'♪ = 60');
  assert.equal(loopWindow(ex,60,2,2).lead,8);
});

test('loop count-in uses the selected bar pulse, even when the passage spans denominator changes',()=>{
  const ex={timeSignature:'4/4',measures:['4/4','6/8','3/4'].map(bar)};
  assert.deepEqual(plain(loopWindow(ex,60,2,3)),{start:4,end:10,lead:2,cycle:8});
  assert.equal(loopWindow(ex,60,3,3).lead,4);
});
