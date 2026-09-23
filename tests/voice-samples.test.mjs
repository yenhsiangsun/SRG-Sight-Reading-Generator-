import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadModule} from './helpers.mjs';

test('every selectable non-Chinese instrument, including Voice, uses a recording',()=>{
 const {INSTRUMENT_LIST}=loadModule('src/music/instruments.ts');
 const manifest=JSON.parse(fs.readFileSync('src/audio/sampleManifest.json','utf8'));
 const profiles=INSTRUMENT_LIST.filter(p=>!p.family.startsWith('國樂'));
 assert.equal(profiles.length,18);
 for(const p of profiles){
  assert.ok(manifest[p.name],p.name);
  for(const filename of Object.values(manifest[p.name].urls))assert.ok(fs.statSync(`public/samples/${manifest[p.name].folder}/${filename}`).size>1000);
 }
});

test('voice recording is tuned to C#5 with enough sustain for default C4-C5 whole notes',()=>{
 const data=fs.readFileSync('public/samples/voice/Cs5-vowel.wav');
 assert.equal(data.toString('ascii',8,12),'WAVE');assert.equal(data.readUInt16LE(22),2);
 const rate=data.readUInt32LE(24),x=[];
 for(let i=44;i<data.length;i+=4)x.push((data.readInt16LE(i)+data.readInt16LE(i+2))/2);
 assert.ok(x.length/rate>7.5);assert.equal(x[0],0);assert.equal(x.at(-1),0);
 const pitches=[];
 for(const t of [1,2,3,4,5,6]){
  const ac=[];
  for(let l=74;l<=86;l++){let sum=0;for(let i=t*rate;i<(t+.08)*rate;i++)sum+=x[i]*x[i+l];ac[l]=sum;}
  let lag=75;for(let l=76;l<=85;l++)if(ac[l]>ac[lag])lag=l;
  const delta=.5*(ac[lag-1]-ac[lag+1])/(ac[lag-1]-2*ac[lag]+ac[lag+1]);pitches.push(rate/(lag+delta));
 }
 pitches.sort((a,b)=>a-b);const hz=(pitches[2]+pitches[3])/2;
 assert.ok(Math.abs(1200*Math.log2(hz/(440*2**(4/12))))<20);
});
