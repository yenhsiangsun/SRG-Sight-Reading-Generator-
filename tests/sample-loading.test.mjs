import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadModule} from './helpers.mjs';

test('recording load failure is reported before creating audio instead of silently playing synthetic Erhu',async()=>{
  let constructed=0,synthetic=0;
  const source=fs.readFileSync('src/audio/createPlaybackInstrument.ts','utf8').replace('import.meta.env.BASE_URL',"'/'").replace('import.meta.env.VITE_LOCAL_PIPA','false');
  const factory=loadModule('src/audio/createPlaybackInstrument.ts',1,source,{
    tone:{getContext:()=>({}),Sampler:class {constructor(){constructed++;}}},
    './sampleManifest.json':{Erhu:{folder:'erhu',urls:{A4:'A4-natural.wav'}}},
    './createInstrumentSynth':{createInstrumentSynth(){synthetic++;}},
    './loadRecordedSamples':{samplesForNotes:urls=>urls,loadRecordedSamples:async()=>{throw Error('decode failed');}},
  },{document:{baseURI:'capacitor://localhost/'}});
  await assert.rejects(factory.createPlaybackInstrument('Erhu'),/無法載入/);
  assert.equal(constructed,0);
  assert.equal(synthetic,0);
});

test('instrument startup passes its context and cancel signal, and never creates a sampler after cancellation',async()=>{
  let constructed=0,finish,loaded;
  const context={decodeAudioData:async()=>({length:2,numberOfChannels:1})};
  const controller=new AbortController();
  const loading=new Promise(resolve=>{loaded=resolve;});
  const source=fs.readFileSync('src/audio/createPlaybackInstrument.ts','utf8').replace('import.meta.env.BASE_URL',"'/'").replace('import.meta.env.VITE_LOCAL_PIPA','false');
  const {createPlaybackInstrument}=loadModule('src/audio/createPlaybackInstrument.ts',1,source,{
    tone:{getContext:()=>context,Sampler:class{constructor(){constructed++;}}},
    './sampleManifest.json':{Erhu:{folder:'erhu',urls:{A4:'A4-natural.wav'}}},
    './createInstrumentSynth':{createInstrumentSynth(){throw Error('Unexpected synthetic voice');}},
    './loadRecordedSamples':{samplesForNotes:urls=>urls,loadRecordedSamples:options=>{
      assert.equal(options.cacheContext,context);assert.equal(options.signal,controller.signal);loaded();
      return new Promise(resolve=>{finish=resolve;});
    }},
  },{document:{baseURI:'capacitor://localhost/'}});
  const pending=createPlaybackInstrument('Erhu',['A4'],controller.signal);
  await loading;controller.abort();finish({A4:{length:2,numberOfChannels:1}});
  await assert.rejects(pending,{name:'AbortError'});assert.equal(constructed,0);
});
