import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadModule} from './helpers.mjs';

for(const local of [true,false])test(`Pipa selects ${local?'local user samples':'distributable samples'} and disposes normally`,async()=>{
 let options,disposed=false;
 const source=fs.readFileSync('src/audio/createPlaybackInstrument.ts','utf8').replace('import.meta.env.BASE_URL',"'/'").replace('import.meta.env.VITE_LOCAL_PIPA',String(local));
 const factory=loadModule('src/audio/createPlaybackInstrument.ts',1,source,{
  tone:{Sampler:class{constructor(o){options=o;queueMicrotask(()=>o.onload());}toDestination(){return this;}dispose(){disposed=true;}}},
  './sampleManifest.json':{Pipa:{folder:'pipa',urls:{A3:'A3-recital.wav'}}},
  './createInstrumentSynth':{createInstrumentSynth(){throw Error('Unexpected synth');}},
 },{setTimeout,clearTimeout});
 const voice=await factory.createPlaybackInstrument('Pipa');
 assert.equal(options.baseUrl,local?'/__local-pipa/':'/samples/pipa/');
 assert.equal(Object.keys(options.urls).length,local?9:1);
 voice.dispose();assert.equal(disposed,true);
});
