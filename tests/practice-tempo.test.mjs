import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';
const {practiceTempoRange,selectPracticeTempo,tempoInputRange}=loadModule('src/practice/tempo.ts');
const {measureTimeline}=loadModule('src/audio/tempo.ts');
const fixture=(duration=4,difficulty='beginner',meter='4/4')=>({difficulty,timeSignature:meter,measures:[{timeSignature:meter,totalUnits:16,events:Array.from({length:16/duration},(_,i)=>({durationUnits:duration,rest:false,midi:60+i%3}))}]});

test('fresh studies vary speed without repeating the preceding BPM',()=>{
  const ex=fixture();let previous=72;const seen=new Set();
  for(let i=0;i<100;i++){
    const next=selectPracticeTempo(ex,previous);
    assert.notEqual(next,previous);assert.ok(next>=48&&next<=160);
    seen.add(next);previous=next;
  }
  assert.ok(seen.size>10);
});

test('an isolated sixteenth and octave leap no longer cap advanced studies at 84',()=>{
  const ex=fixture(4,'advanced');
  ex.measures[0].events=[1,3,4,4,4].map((durationUnits,i)=>({durationUnits,rest:false,midi:i===1?84:60}));
  assert.equal(practiceTempoRange(ex).max,160);
  assert.equal(selectPracticeTempo(ex,84,()=>1),160);
  assert.ok(practiceTempoRange(fixture(1,'advanced')).max<160);
});

test('manual tempo reaches 400 and playback uses exactly the displayed beat unit',()=>{
  for(const meter of ['4/4','6/8','7/8']){
    const ex=fixture(4,'advanced',meter);
    assert.equal(tempoInputRange(ex).max,400);
    const bar=measureTimeline(ex,400)[0];
    assert.equal(bar.unit*bar.secondsPerUnit,60/400);
  }
});

test('every difficulty can reach quarter 160 with playable rhythms, without old 108/132 caps',()=>{
  for(const level of ['beginner','intermediate','advanced']){
    const quarter=fixture(4,level);
    assert.equal(practiceTempoRange(quarter).max,160);
    assert.equal(selectPracticeTempo(quarter,72,()=>1),160);
    assert.equal(selectPracticeTempo(fixture(4,level,'6/8'),72,()=>1),320);
    const samples=Array.from({length:100},()=>selectPracticeTempo(quarter,72));
    assert.ok(samples.some(bpm=>bpm>132));
    assert.ok(practiceTempoRange(fixture(1,level)).max<160);
  }
});

test('short subdivisions limit speed at every skill level, including lower staff and mixed meters',()=>{
  for(const level of ['beginner','intermediate','advanced']){
    const ex=fixture(4,level);
    ex.measures.push({...fixture(1,level,'6/8').measures[0]});
    const fast=selectPracticeTempo(ex,0,()=>.999);
    assert.ok(1/measureTimeline(ex,fast)[1].secondsPerUnit<=7);
    assert.ok(fast<practiceTempoRange(fixture(4,level)).max);
    const grand={...fixture(4,level),grandMode:'two-hand',lowerMeasures:fixture(1,level).measures};
    assert.ok(practiceTempoRange(grand).max<fast);
  }
});

test('pitch difficulty alone never changes the tempo range for the same written rhythm',()=>{
  for(const duration of [1,2,4])for(const meter of ['4/4','6/8','7/8']){
    const expected=practiceTempoRange(fixture(duration,'advanced',meter));
    for(const level of ['beginner','intermediate'])assert.deepEqual(practiceTempoRange(fixture(duration,level,meter)),expected);
  }
});

test('all densities, meters and levels stay within 48–160 and can change even at the floor',()=>{
  for(const level of ['beginner','intermediate','advanced']) for(const meter of ['4/4','6/8','7/8']) for(const duration of [1,2,4]){
    const ex={...fixture(duration,level,meter),grandMode:'two-hand',lowerMeasures:fixture(1,level,meter).measures};
    ex.measures[0].events[0].midi=90;
    const {min,max}=practiceTempoRange(ex);
    const factor=meter.endsWith('/8')?2:1;
    assert.equal(min,48*factor);assert.ok(max>=49*factor&&max<=160*factor);
    assert.notEqual(selectPracticeTempo(ex,min,()=>0),min);
    assert.ok(selectPracticeTempo(ex,0,()=>1)<=160*factor);
  }
  assert.equal(selectPracticeTempo(fixture(4,'advanced'),0,()=>1),160);
});

test('quarter 160 equals eighth 320; opening meter controls input and mixed-meter playback',()=>{
  const ex=fixture(4,'advanced','6/8');
  assert.equal(selectPracticeTempo(ex,0,()=>1),320);
  assert.equal(tempoInputRange(ex).min,96);
  assert.equal(tempoInputRange(ex).max,400);
  ex.measures.push(fixture(4,'advanced','4/4').measures[0]);
  for(const bar of measureTimeline(ex,320)) assert.equal(bar.secondsPerUnit*4,60/160);
  ex.measures.reverse();
  assert.equal(tempoInputRange(ex).min,48);
  assert.equal(tempoInputRange(ex).max,400);
  for(const bar of measureTimeline(ex,160)) assert.equal(bar.secondsPerUnit*4,60/160);
});

test('eighth-note BPM uses the same physical speed limit without a global leap penalty',()=>{
  const quarter=fixture(1), eighth=fixture(1,'beginner','7/8');
  assert.ok(Math.abs(practiceTempoRange(eighth).max / 2 - practiceTempoRange(quarter).max) <= 1);
  eighth.measures[0].events[1].midi=84;
  assert.equal(practiceTempoRange(eighth).max,practiceTempoRange(fixture(1,'beginner','7/8')).max);
});


