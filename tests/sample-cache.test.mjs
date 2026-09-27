import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

const wav = new TextEncoder().encode('RIFF0000WAVE0000').buffer;
const response = () => ({ok:true,status:200,type:'basic',arrayBuffer:async()=>wav});
const buffer = () => ({length:2,numberOfChannels:1});
const options = {urls:{C4:'C4.wav'},baseUrl:'/samples/piano/',pageUrl:'capacitor://localhost/',decode:async()=>buffer()};
const setup = fetch => loadModule('src/audio/loadRecordedSamples.ts',1,undefined,{}, {fetch,URL,setTimeout,clearTimeout});
const deferred = () => {let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};

test('replay and overlapping note sets reuse decoded samples only for their original context and URL',async()=>{
  let requests=0,decodes=0;
  const {loadRecordedSamples}=setup(async()=>{requests++;return response();});
  const cacheContext={};
  const load=overrides=>loadRecordedSamples({...options,cacheContext,decode:async()=>{decodes++;return buffer();},...overrides});
  const first=await load({urls:{C4:'C4.wav',E4:'E4.wav'}});
  const replay=await load({});
  assert.equal(replay.C4,first.C4);
  assert.equal(requests,2);assert.equal(decodes,2);
  const overlap=await load({urls:{E4:'E4.wav',G4:'G4.wav'}});
  assert.equal(overlap.E4,first.E4);assert.equal(requests,3);
  await load({cacheContext:{}});
  await load({baseUrl:'/samples/flute/'});
  assert.equal(requests,5,'new contexts and recording folders are decoded independently');
});

test('decoded cache evicts least recently used entries at both PCM byte and entry limits',async()=>{
  for(const limits of [[16,64],[1024,2]]) {
    const requests=[];
    const {RecordedSampleCache,loadRecordedSamples}=setup(async url=>{requests.push(new URL(url).pathname);return response();});
    const cache=new RecordedSampleCache(...limits),cacheContext={};
    const load=name=>loadRecordedSamples({...options,cache,cacheContext,urls:{[name]:`${name}.wav`}});
    const first=await load('C4');await load('E4');
    assert.equal((await load('C4')).C4,first.C4);
    await load('G4'); // Touching C4 protects it; E4 is the oldest entry.
    assert.equal((await load('C4')).C4,first.C4);
    await load('E4');
    assert.deepEqual(requests,['/samples/piano/C4.wav','/samples/piano/E4.wav','/samples/piano/G4.wav','/samples/piano/E4.wav']);
  }
});

test('recordings larger than the PCM budget play without being retained',async()=>{
  let requests=0;
  const {RecordedSampleCache,loadRecordedSamples}=setup(async()=>{requests++;return response();});
  const settings={...options,cache:new RecordedSampleCache(4),cacheContext:{}};
  await loadRecordedSamples(settings);await loadRecordedSamples(settings);
  assert.equal(requests,2);
});

test('canceling a pending bank aborts every active fetch and allows immediate retry',async()=>{
  const signals=[];let retry=false;
  const {loadRecordedSamples}=setup(async(_, {signal})=>{
    signals.push(signal);
    if(retry)return response();
    return new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(Error('fetch aborted')),{once:true}));
  });
  const controller=new AbortController(),cacheContext={};
  const loading=loadRecordedSamples({...options,cacheContext,signal:controller.signal,urls:{C4:'C4.wav',D4:'D4.wav',E4:'E4.wav',F4:'F4.wav'}});
  controller.abort();
  await assert.rejects(loading,{name:'AbortError'});
  assert.equal(signals.length,3);assert.ok(signals.every(signal=>signal.aborted));
  retry=true;
  const result=await loadRecordedSamples({...options,cacheContext});
  assert.equal(result.C4.length,2);assert.equal(signals.length,4);
  const canceled=new AbortController();canceled.abort();
  await assert.rejects(loadRecordedSamples({...options,cacheContext,signal:canceled.signal}),{name:'AbortError'});
  assert.equal(signals.length,4,'already canceled calls do not use the cache or start requests');
});

test('cancel during noncancelable decode settles promptly and never publishes a late buffer to cache',async()=>{
  let requests=0;const decodeStarted=deferred(),decoding=deferred();
  const {loadRecordedSamples}=setup(async()=>{requests++;return response();});
  const controller=new AbortController(),cacheContext={};
  const canceled=loadRecordedSamples({...options,cacheContext,signal:controller.signal,decode:()=>{decodeStarted.resolve();return decoding.promise;}});
  await decodeStarted.promise;controller.abort();
  await assert.rejects(canceled,{name:'AbortError'});
  const retry=await loadRecordedSamples({...options,cacheContext});
  decoding.resolve({length:8,numberOfChannels:1});
  await new Promise(setImmediate);
  const reused=await loadRecordedSamples({...options,cacheContext});
  assert.equal(reused.C4,retry.C4);assert.equal(requests,2);
});

test('concurrent consumers can cancel independently and reuse the surviving completed decode',async()=>{
  const pending=[];
  const {loadRecordedSamples}=setup((_,{signal})=>new Promise((resolve,reject)=>{
    pending.push({resolve,signal});signal.addEventListener('abort',()=>reject(Error('fetch aborted')),{once:true});
  }));
  const cacheContext={},controller=new AbortController();
  const first=loadRecordedSamples({...options,cacheContext,signal:controller.signal});
  const second=loadRecordedSamples({...options,cacheContext});
  controller.abort();await assert.rejects(first,{name:'AbortError'});
  assert.equal(pending[1].signal.aborted,false);
  pending[1].resolve(response());const result=await second;
  assert.equal((await loadRecordedSamples({...options,cacheContext})).C4,result.C4);
  assert.equal(pending.length,2);
});
