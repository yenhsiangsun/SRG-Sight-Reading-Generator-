import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';
const {INSTRUMENTS}=loadModule('src/music/instruments.ts');
const {generatePracticeExercise}=loadModule('src/music.ts',421);
const {generateGrandExercise}=loadModule('src/music/grandStaff.ts',311);
const {createPlaybackEvents,createMetronomeEvents}=loadModule('src/audio/PlaybackController.ts');
const base={instrument:'Piano',clef:'treble',difficulty:'intermediate',keySignature:'C',timeSignature:'4/4',rhythmLevel:'complex',measures:4,tempo:72,range:{min:48,max:84},allowAccidentals:false,mixedMeters:true,meters:['4/4','6/8'],tonic:'C',scaleId:'major'};
test('instrument profiles generate within written bounds and transpose into audible MIDI range',()=>{
  for(const [name,p] of Object.entries(INSTRUMENTS)) {
    assert.ok(p.min<p.max,name);
    assert.ok(p.min+p.transpose>=0&&p.max+p.transpose<=127,name);
    // Voice is customizable; Alto Sheng uses the user's explicitly supplied range.
    if(!['Voice','Alto Sheng'].includes(name))assert.match(p.source,/^https:\/\//,name);
    const e=generatePracticeExercise({...base,clef:['grand','mixedStaff'].includes(p.clef)?'treble':p.clef,range:{min:p.min,max:p.max}});
    for(const m of e.measures)for(const n of m.events)if(!n.rest)assert.ok(n.midi>=p.min&&n.midi<=p.max,name);
  }
  assert.equal(INSTRUMENTS.Piano.min,21);
  assert.equal(INSTRUMENTS.Piano.max,108);
  assert.equal(INSTRUMENTS.Sheng.min,55);
  assert.equal(INSTRUMENTS.Sheng.max,90);
});
test('grand playback schedules both hands together and metronome counts only one shared timeline',()=>{
  const e=generateGrandExercise(base);
  const upper=createPlaybackEvents({...e,lowerMeasures:undefined},72);
  const lower=createPlaybackEvents({...e,measures:e.lowerMeasures,lowerMeasures:undefined},72);
  const both=createPlaybackEvents(e,72);
  assert.equal(both.events.length,upper.events.length+lower.events.length);
  assert.equal(both.duration,upper.duration);
  assert.equal(both.duration,lower.duration);
  assert.ok(both.events.filter(n=>n.time===0).length===2);
  const encode=e=>JSON.stringify(e);
  assert.deepEqual(Array.from(both.events,encode).sort(),[...upper.events,...lower.events].map(encode).sort());
  assert.equal(createMetronomeEvents(e,72).length,createMetronomeEvents({...e,lowerMeasures:undefined},72).length);
});
test('written pitches transpose correctly, including enharmonic octave boundaries',()=>{
  const make=(key,transposition)=>createPlaybackEvents({...base,transposition,measures:[{events:[{key,durationUnits:4,rest:false}]}]},60).events[0].note;
  assert.equal(make('c/4',-2),'A#3');
  assert.equal(make('c/4',-9),'D#3');
  assert.equal(make('c/4',-14),'A#2');
  assert.equal(make('e/3',-12),'E2');
  assert.equal(make('d/4',12),'D5');
  assert.equal(make('b#/3',-2),'A#3');
  assert.equal(make('cb/4',-2),'A3');
});
