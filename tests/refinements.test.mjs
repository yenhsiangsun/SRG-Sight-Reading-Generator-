import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadModule} from './helpers.mjs';
const {estimateCalibration}=loadModule('src/assessment/calibration.ts');
const notes=(offset=.12,jitter=()=>0)=>Array.from({length:8},(_,i)=>Array.from({length:4},(_,j)=>({time:i*.5+offset+jitter(i)+j*.04,midi:60,confidence:.99,rms:.2}))).flat();
test('calibration estimates consistent latency and rejects missing, unstable or silent playing',()=>{
  assert.equal(estimateCalibration(notes()).offsetMs,120);
  assert.equal(estimateCalibration(notes(-.05)).offsetMs,-50);
  assert.equal(estimateCalibration(notes(.12,i=>i%2?.012:-.012)).spreadMs,24);
  assert.equal(estimateCalibration([]),null);
  assert.equal(estimateCalibration(notes().slice(4)),null);
  assert.equal(estimateCalibration(notes(.12,i=>i%2?.15:-.12)),null);
  assert.equal(estimateCalibration(notes(.6)),null);
  assert.equal(estimateCalibration(notes().map(f=>({...f,confidence:.2}))),null);
});
test('calibration persists across mounts, rejects corrupt data and handles disabled storage',()=>{
  let saved=null;const api=loadModule('src/assessment/calibration.ts',1,undefined,{}, {localStorage:{getItem:()=>saved,setItem:(_,v)=>{saved=v;}}});
  const value=api.estimateCalibration(notes());assert.equal(api.saveCalibration(value),true);assert.equal(api.loadCalibration().offsetMs,120);
  saved='bad';assert.equal(api.loadCalibration(),null);saved='{"version":1,"offsetMs":999}';assert.equal(api.loadCalibration(),null);
  const blocked=loadModule('src/assessment/calibration.ts',1,undefined,{}, {localStorage:{getItem(){throw Error();},setItem(){throw Error();}}});
  assert.equal(blocked.loadCalibration(),null);assert.equal(blocked.saveCalibration(value),false);
});
test('single melody grand staff preserves timing and never schedules simultaneous pitches',()=>{
  const {generateGrandExercise}=loadModule('src/music/grandStaff.ts');
  const {createPlaybackEvents}=loadModule('src/audio/PlaybackController.ts');
  for(const range of [{min:38,max:86},{min:62,max:86},{min:36,max:55}])for(const timeSignature of ['4/4','6/8','7/8']){
    const e=generateGrandExercise({instrument:'Sheng',clef:'treble',difficulty:'advanced',keySignature:'C',timeSignature,rhythmLevel:'complex',measures:8,tempo:72,range,allowAccidentals:true,mixedMeters:true,meters:['4/4','6/8','7/8'],tonic:'C',scaleId:'major'},'mono');
    assert.equal(e.grandMode,'mono');
    for(let m=0;m<e.measures.length;m++){
      const top=e.measures[m],bottom=e.lowerMeasures[m];
      // Thirds use integer rhythm ticks; raw floating-point sums are not exact.
      assert.equal(top.events.reduce((n,e)=>n+Math.round(e.durationUnits*12),0),top.totalUnits*12);
      assert.equal(bottom.events.reduce((n,e)=>n+Math.round(e.durationUnits*12),0),top.totalUnits*12);
      for(let n=0;n<top.events.length;n++)assert.ok(top.events[n].rest||bottom.events[n].rest);
    }
    const played=createPlaybackEvents(e,72).events;
    for(let i=1;i<played.length;i++)assert.ok(played[i].time>=played[i-1].time+played[i-1].duration-1e-8);
  }
});
test('instrument choices exclude duplicate tuning variants and preserve source name',()=>{
  const {INSTRUMENT_LIST}=loadModule('src/music/instruments.ts');
  assert.equal(INSTRUMENT_LIST.filter(p=>p.name.startsWith('Bangdi ')).length,1);
  assert.equal(INSTRUMENT_LIST.filter(p=>p.name.startsWith('Qudi ')).length,1);
  assert.ok(INSTRUMENT_LIST.some(p=>p.note.includes('香港中樂團')));
  for(const p of INSTRUMENT_LIST)assert.ok(!p.family.includes('中樂'));
});
test('every mapped recording is bundled and is not a missing-file response',()=>{
  const manifest=JSON.parse(fs.readFileSync('src/audio/sampleManifest.json','utf8'));
  assert.equal(Object.keys(manifest).length,20);
  for(const p of Object.values(manifest))for(const f of Object.values(p.urls)){
    const data=fs.readFileSync('public/samples/'+p.folder+'/'+f);assert.ok(data.length>1000,f);assert.ok(data[0]===0xff||data.subarray(0,3).toString()==='ID3'||(data.subarray(0,4).toString()==='RIFF'&&data.subarray(8,12).toString()==='WAVE'),f);
  }
});
test('stopping during sample loading disposes late synth without starting playback',async()=>{
  const {PlaybackController}=loadModule('src/audio/PlaybackController.ts');let resolve,disposed=0,started=0;
  const controller=new PlaybackController({unlock:async()=>{},createSynth:()=>new Promise(r=>resolve=r),schedule(){return 0;},scheduleEnd(){return 1;},clear(){},start(){started++;},pause(){},stop(){},setTempo(){}},()=>{});
  const pending=controller.play({timeSignature:'4/4',measures:[{events:[{key:'c/4',rest:false,durationUnits:16}]}]},60);
  await new Promise(r=>setImmediate(r));controller.stop();resolve({dispose(){disposed++;},releaseAll(){},triggerAttackRelease(){}});await pending;
  assert.equal(disposed,1);assert.equal(started,0);
});
