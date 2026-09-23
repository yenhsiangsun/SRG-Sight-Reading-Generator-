import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadModule} from './helpers.mjs';

test('recording load failure is reported instead of silently playing synthetic Erhu',async()=>{
  let disposed=0,synthetic=0;
  const source=fs.readFileSync('src/audio/createPlaybackInstrument.ts','utf8').replace('import.meta.env.BASE_URL',"'/'").replace('import.meta.env.VITE_LOCAL_PIPA','false');
  const factory=loadModule('src/audio/createPlaybackInstrument.ts',1,source,{
    tone:{Sampler:class {constructor(options){Promise.resolve().then(()=>options.onerror());}dispose(){disposed++;}}},
    './sampleManifest.json':{Erhu:{folder:'erhu',urls:{A4:'A4-natural.wav'}}},
    './createInstrumentSynth':{createInstrumentSynth(){synthetic++;}},
  },{setTimeout,clearTimeout});
  await assert.rejects(factory.createPlaybackInstrument('Erhu'),/無法載入/);
  assert.equal(disposed,1);
  assert.equal(synthetic,0);
});
