import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';
const {addPerformanceMarks}=loadModule('src/music/performanceMarks.ts');
const {createPlaybackEvents}=loadModule('src/audio/PlaybackController.ts');
const bar=()=>({timeSignature:'4/4',totalUnits:16,groups:[4,4,4,4],beamGroups:[4,4,4,4],events:Array.from({length:4},(_,i)=>({key:'c/5',octave:5,midi:72,rest:false,duration:'q',dots:0,startUnits:i*4,durationUnits:4}))});
const exercise=()=>({timeSignature:'4/4',tempo:60,measures:Array.from({length:8},bar),lowerMeasures:Array.from({length:8},bar)});

test('expression preserves pitches, timing and source data while adding coherent dynamics to both hands',()=>{
  const source=exercise(), before=JSON.stringify(source);
  const marked=addPerformanceMarks(source,()=>0);
  const clean=JSON.parse(JSON.stringify(marked));
  for(const staff of [clean.measures,clean.lowerMeasures])for(const measure of staff)for(const note of measure.events){delete note.articulation;delete note.dynamic;}
  assert.equal(JSON.stringify(clean),before);
  assert.equal(JSON.stringify(source),before);
  for(const staff of [marked.measures,marked.lowerMeasures]){
    assert.equal(staff[0].events[0].dynamic,'p');
    assert.equal(staff[4].events[0].dynamic,'mp');
    assert.equal(staff[1].events[0].dynamic,undefined);
    // Sustained quarters must not be dotted just to force every symbol into the score.
    assert.ok(staff.flatMap(m=>m.events).every(n=>!n.articulation || n.articulation==='tenuto'));
  }
});

test('initial silent measures defer the dynamic marking until the first sounded note',()=>{
  const source=exercise();
  source.measures[0].events.forEach(note=>note.rest=true);
  const marked=addPerformanceMarks(source,()=>0);
  assert.ok(marked.measures[0].events.every(note=>!note.dynamic&&!note.articulation));
  assert.equal(marked.measures[1].events[0].dynamic,'p');
});

test('playback expresses staccato, tenuto and accents while metric weight preserves written onsets and duration',()=>{
  const source={timeSignature:'4/4',tempo:60,measures:[bar()]};
  const original=createPlaybackEvents(source,60);
  Object.assign(source.measures[0].events[0],{dynamic:'p',articulation:'staccato'});
  Object.assign(source.measures[0].events[1],{articulation:'tenuto'});
  Object.assign(source.measures[0].events[2],{articulation:'accent'});
  Object.assign(source.measures[0].events[3],{dynamic:'f'});
  const marked=createPlaybackEvents(source,60);
  assert.equal(marked.duration,original.duration);
  assert.deepEqual(Array.from(marked.events,e=>e.time),Array.from(original.events,e=>e.time));
  assert.equal(marked.events[0].duration,0.5);
  assert.equal(marked.events[1].duration,1);
  assert.ok(marked.events[2].velocity>marked.events[1].velocity);
  assert.ok(marked.events[3].velocity>marked.events[0].velocity);
  assert.ok(original.events.every(event=>event.duration===1 && event.velocity>0));
  assert.ok(original.events[0].velocity>original.events[1].velocity);
});
