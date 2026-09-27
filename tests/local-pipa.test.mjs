import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadModule} from './helpers.mjs';

for(const local of [true,false])test(`Pipa selects ${local?'local user samples':'distributable samples'} and disposes normally`,async()=>{
 let options,loadOptions,disposed=false;
 const source=fs.readFileSync('src/audio/createPlaybackInstrument.ts','utf8').replace('import.meta.env.BASE_URL',"'/'").replace('import.meta.env.VITE_LOCAL_PIPA',String(local));
 const factory=loadModule('src/audio/createPlaybackInstrument.ts',1,source,{
  tone:{getContext:()=>({}),Sampler:class{constructor(o){options=o;}toDestination(){return this;}dispose(){disposed=true;}}},
  './sampleManifest.json':{Pipa:{folder:'pipa',urls:{A3:'A3-recital.wav'}}},
  './createInstrumentSynth':{createInstrumentSynth(){throw Error('Unexpected synth');}},
  './loadRecordedSamples':{samplesForNotes:urls=>urls,loadRecordedSamples:async o=>{loadOptions=o;return {A3:{length:8000,numberOfChannels:2}};}},
 },{document:{baseURI:'capacitor://localhost/'}});
 const voice=await factory.createPlaybackInstrument('Pipa');
 assert.equal(loadOptions.baseUrl,local?'/__local-pipa/':'/samples/pipa/');
 assert.equal(!!loadOptions.cacheContext,!local,'live local recordings bypass reusable production PCM');
 assert.equal(Object.keys(loadOptions.urls).length,local?9:1);
 assert.equal(options.urls.A3.length,8000,'Tone receives decoded buffers, not native media URLs');
 voice.dispose();assert.equal(disposed,true);
});
