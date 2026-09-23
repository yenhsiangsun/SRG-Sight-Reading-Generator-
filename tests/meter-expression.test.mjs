import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

const {createPlaybackEvents,createMetronomeEvents}=loadModule('src/audio/PlaybackController.ts');
const {addPerformanceMarks}=loadModule('src/music/performanceMarks.ts');
const {metricPosition,pulseGroups}=loadModule('src/music/meterFeel.ts');
const {assertMeasureRhythm}=loadModule('src/music/rhythmTiming.ts');
const {addModalPhrasing}=loadModule('src/music/modalPhrasing.ts');
const engine=loadModule('src/music.ts',923);
const plain=x=>JSON.parse(JSON.stringify(x));
const note=(startUnits,durationUnits=2)=>({key:'c/5',midi:72,octave:5,rest:false,startUnits,durationUnits,
  duration:durationUnits===1?'16':durationUnits===2?'8':'q',dots:0});
function eighths(meter) {
  const info=engine.TIME_SIGNATURES[meter];
  return {timeSignature:meter,totalUnits:info.units,groups:info.groups,beamGroups:info.groups,
    events:Array.from({length:info.units/2},(_,i)=>note(i*2))};
}

test('six identical eighths sound in 3+3 in 6/8 and 2+2+2 in 3/4 without time stretching',()=>{
  const six=createPlaybackEvents({timeSignature:'6/8',measures:[eighths('6/8')]},120);
  const three=createPlaybackEvents({timeSignature:'3/4',measures:[eighths('3/4')]},60);
  assert.deepEqual(plain(six.events.map(n=>[n.time,n.duration])),[[0,.5],[.5,.5],[1,.5],[1.5,.5],[2,.5],[2.5,.5]]);
  assert.deepEqual(plain(six.events.map(n=>n.time)),plain(three.events.map(n=>n.time)));
  const v=six.events.map(n=>n.velocity),w=three.events.map(n=>n.velocity);
  assert.ok(v[0]>v[3] && v[3]>v[1] && v[1]===v[2] && v[2]===v[4] && v[4]===v[5]);
  assert.ok(w[0]>w[2] && w[2]===w[4] && w[2]>w[1] && w[1]===w[3]);
  assert.equal(six.duration,three.duration);
});

test('mixed-meter clicks reset their musical pulse weights in ordinary playback while keeping the original eighth BPM',()=>{
  const ex={timeSignature:'4/4',measures:['4/4','6/8','7/8','9/8','12/8'].map(eighths)};
  const clicks=createMetronomeEvents(ex,60);
  const six=clicks.filter(n=>n.time>=4 && n.time<7);
  assert.deepEqual(plain(six.map(n=>n.time)),[4,4.5,5,5.5,6,6.5]);
  assert.deepEqual(plain(six.map(n=>n.velocity)),[.9,.4,.4,.72,.4,.4]);
  const seven=clicks.filter(n=>n.time>=7 && n.time<10.5);
  assert.deepEqual(plain(seven.map(n=>n.velocity)),[.9,.4,.72,.4,.72,.4,.4]);
  const single={timeSignature:'6/8',measures:[eighths('6/8')]};
  assert.deepEqual(plain(createMetronomeEvents(single,120).map(n=>n.time)),[0,.5,1,1.5,2,2.5]);
  assert.equal(createPlaybackEvents(single,120).duration,3);
});

test('compound-meter generation keeps sounded big beats, legal beaming groups and independent rhythmic levels',()=>{
  for(const timeSignature of ['6/8','9/8','12/8'])for(const rhythmLevel of ['simple','medium','complex']) {
    const ex=engine.generatePracticeExercise({instrument:'Sheng',clef:'treble',difficulty:'advanced',keySignature:'C',
      timeSignature,rhythmLevel,measures:32,tempo:100,range:{min:55,max:90},allowAccidentals:false,tonic:'C',scaleId:'major'});
    const shaped=addModalPhrasing(ex,{min:55,max:90},false);
    for(const bar of shaped.measures) {
      assertMeasureRhythm(bar,timeSignature);
      for(let onset=0;onset<bar.totalUnits;onset+=6)assert.equal(bar.events.find(n=>n.startUnits===onset)?.rest,false);
      assert.ok(bar.events.every(n=>Math.floor(n.startUnits/6)===Math.floor((n.startUnits+n.durationUnits-1e-6)/6)));
    }
    assert.equal(createPlaybackEvents(shaped,120).duration,32*engine.TIME_SIGNATURES[timeSignature].units/4);
  }
});

test('articulation follows whole pulse groups and sustained arrivals rather than every fourth note',()=>{
  const seen=new Set();
  for(let sample=0;sample<80;sample++) {
    const source={timeSignature:'6/8',measures:Array.from({length:8},()=>eighths('6/8'))};
    // Include a weak-beat opening, an internal silence, a long arrival and a final short pickup.
    source.measures[0].events[0].rest=true;
    source.measures[2].events[1].rest=true;
    source.measures[3].events=[note(0),note(2),note(4),{...note(6,6),dots:1}];
    source.measures[7].events=[{...note(0,4)},{...note(4)},{...note(6,4)},note(10,1),note(11,1)];
    const before=JSON.stringify(source),marked=addPerformanceMarks(source);
    assert.equal(JSON.stringify(source),before);
    for(const [barIndex,bar]of marked.measures.entries()) {
      assertMeasureRhythm(bar,'6/8');
      assert.ok(bar.events.filter(n=>n.articulation==='accent').length<=1);
      for(const n of bar.events) {
        if(n.rest){assert.equal(n.articulation,undefined);assert.equal(n.dynamic,undefined);continue;}
        const p=metricPosition(bar,n.startUnits);
        if(n.articulation)seen.add(n.articulation);
        if(n.articulation==='accent')assert.ok(p.onPulse && n.durationUnits>=2);
        if(n.articulation==='tenuto')assert.ok(p.onPulse && n.durationUnits>=p.units/2);
        if(n.articulation==='staccato') {
          const group=bar.events.filter(other=>other.startUnits>=p.start && other.startUnits<p.start+p.units);
          assert.ok(group.length>=2 && group.every(other=>!other.rest && other.articulation==='staccato' && other.durationUnits<=2));
        }
        if(n.dynamic)assert.equal(barIndex%4,0);
      }
    }
    assert.equal(marked.measures[7].events.at(-1).articulation,undefined);
    assert.equal(marked.measures[0].events[1].articulation,undefined,'no accidental accent on a delayed weak-beat entrance');
  }
  assert.equal(seen.size,3,'all three articulation studies remain available in suitable contexts');
});

test('both hands share dynamics without f-to-p wrapping and all meters retain exact source notes',()=>{
  for(const meter of Object.keys(engine.TIME_SIGNATURES)) {
    const upper=Array.from({length:12},()=>eighths(meter));
    const source={timeSignature:meter,measures:upper,lowerMeasures:plain(upper)};
    const before=JSON.stringify(source),marked=addPerformanceMarks(source,()=>.99);
    const levels=['p','mp','mf','f'];
    const dynamics=marked.measures.flatMap(m=>m.events).filter(n=>n.dynamic).map(n=>levels.indexOf(n.dynamic));
    for(let i=1;i<dynamics.length;i++)assert.equal(Math.abs(dynamics[i]-dynamics[i-1]),1);
    assert.deepEqual(plain(marked.measures.map(m=>m.events.map(n=>n.dynamic))),plain(marked.lowerMeasures.map(m=>m.events.map(n=>n.dynamic))));
    for(const staff of [marked.measures,marked.lowerMeasures])for(const bar of staff) {
      assertMeasureRhythm(bar,meter);
      assert.equal(pulseGroups(bar).reduce((a,b)=>a+b,0),bar.totalUnits);
    }
    const clean=plain(marked);
    for(const staff of [clean.measures,clean.lowerMeasures])for(const bar of staff)for(const n of bar.events){delete n.articulation;delete n.dynamic;}
    assert.equal(JSON.stringify(clean),before);
  }
});
