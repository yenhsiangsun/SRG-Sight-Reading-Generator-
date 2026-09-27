import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadModule} from './helpers.mjs';
const {assess}=loadModule('src/assessment/scoring.ts');
const {detectOnsets}=loadModule('src/assessment/onsets.ts');
const exercise={timeSignature:'4/4',measures:[{totalUnits:16,events:Array.from({length:4},(_,i)=>({key:'c/4',midi:60,rest:false,durationUnits:4,startUnits:i*4}))}]};
const frame=(time,midi=60,rms=.2)=>({time,midi,rms,confidence:.99});

test('reattacks on the same pitch count as new notes; a sustained tone and vibrato do not',()=>{
  const repeated=Array.from({length:400},(_,i)=>frame(i/100+.02,60,i%100<8?.02:.2));
  // The initial low-level attack is ignored here; every phrase starts at its real onset.
  const attacks=detectOnsets(repeated.filter(f=>f.time>=.1));
  assert.equal(attacks.length,4);
  const res=assess(exercise,60,repeated.filter(f=>f.time>=.1));assert.equal(res.rhythm,100);assert.equal(res.pitch,100);
  const sustained=Array.from({length:400},(_,i)=>frame(i/100+.02,60+Math.sin(i/10)*.18));
  assert.equal(detectOnsets(sustained).length,1);assert.equal(assess(exercise,60,sustained).rhythm,25);
});

test('short successive pitches get distinct onset windows instead of sharing one frame',()=>{
  const fast={timeSignature:'4/4',measures:[{totalUnits:16,events:Array.from({length:16},(_,i)=>({key:['c/4','d/4'][i%2],midi:i%2?62:60,rest:false,durationUnits:1,startUnits:i}))}]};
  const frames=Array.from({length:16},(_,i)=>Array.from({length:8},(_,j)=>frame(i*.09375+j*.01+.006,i%2?62:60))).flat();
  const result=assess(fast,160,frames);
  assert.equal(result.pitch,100);assert.equal(result.rhythm,100);assert.equal(result.completion,100);assert.equal(result.reliable,true);
  assert.equal(new Set(detectOnsets(frames).map(n=>n.time)).size,16);
});

test('rest feedback distinguishes silence from sustained pitch without counting staccato tails as written rests',()=>{
  const rest={...exercise,measures:[{...exercise.measures[0],events:exercise.measures[0].events.map((n,i)=>({...n,rest:i===1}))}]};
  const observations=Array.from({length:400},(_,i)=>i>=100&&i<200?{time:i/100,midi:0,rms:.001,confidence:0}:frame(i/100));
  assert.equal(assess(rest,60,observations).restAccuracy,100);
  assert.equal(assess(rest,60,Array.from({length:400},(_,i)=>frame(i/100))).restAccuracy,0);
  const short={...exercise,measures:[{...exercise.measures[0],events:exercise.measures[0].events.map(n=>({...n,articulation:'staccato'}))}]};
  assert.equal(assess(short,60,observations).restAccuracy,undefined);
  const clipping=assess(exercise,60,observations.map(f=>({...f,clipped:true})));
  assert.equal(clipping.clipped,true);assert.equal(clipping.reliable,false);
  assert.equal(assess(exercise,60,observations.map(f=>({...f,confidence:.4}))).reliable,false);
});

test('latency belongs to a specific input, sample rate and output route and survives switching back',()=>{
  let raw=null;const api=loadModule('src/assessment/calibration.ts',1,undefined,{}, {localStorage:{getItem:()=>raw,setItem:(_,value)=>raw=value}});
  const keys=['speakers','wired','bluetooth'].map(route=>api.audioRouteKey('mic-A',48000,route));
  assert.equal(new Set(keys).size,3);assert.notEqual(api.audioRouteKey('mic-B',48000,'speakers'),keys[0]);assert.notEqual(api.audioRouteKey('mic-A',44100,'speakers'),keys[0]);
  for(const [i,key] of keys.entries())assert.equal(api.saveCalibration({version:1,offsetMs:40+i*70,spreadMs:8,measuredAt:'2026-09-23',routeKey:key,outputRoute:['speakers','wired','bluetooth'][i]}),true);
  assert.equal(api.loadCalibration(keys[0]).offsetMs,40);assert.equal(api.loadCalibration(keys[2]).offsetMs,180);assert.equal(api.loadCalibration('unknown'),null);
  assert.ok(!raw.includes('mic-A'),'raw hardware ids never persist');
});

test('rejecting a changed microphone route stops tracks before any count-in or recording',async()=>{
  let stopped=0,closed=0,finished=0;
  class Context{sampleRate=48000;resume(){return Promise.resolve();}close(){closed++;return Promise.resolve();}}
  const source=fs.readFileSync('src/assessment/MicrophoneSession.ts','utf8').replace('import.meta.env.BASE_URL',"'/'");
  const track={stop(){stopped++;},getSettings(){return {deviceId:'different-mic'};}};
  const {MicrophoneSession}=loadModule('src/assessment/MicrophoneSession.ts',1,source,{}, {AudioContext:Context,window:{AudioWorkletNode:class{}},navigator:{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[track],getAudioTracks:()=>[track]})}},clearInterval(){}});
  await assert.rejects(new MicrophoneSession().start(30,60,4,()=>{},()=>finished++,{onRoute(){throw new Error('CALIBRATION_REQUIRED');}}),/CALIBRATION_REQUIRED/);
  assert.equal(stopped,1);assert.equal(closed,1);assert.equal(finished,0);
});
