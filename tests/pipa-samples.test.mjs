import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('Pipa anchors are audible stereo PCM, correctly tuned, with silent boundaries',()=>{
 const manifest=JSON.parse(fs.readFileSync('src/audio/sampleManifest.json','utf8'));
 for(const [note,hz] of [['A3',220],['B3',246.94165]]){
  const data=fs.readFileSync(`public/samples/pipa/${manifest.Pipa.urls[note]}`);
  assert.equal(data.toString('ascii',8,12),'WAVE');
  assert.equal(data.readUInt16LE(22),2);
  const rate=data.readUInt32LE(24),samples=[];
  for(let i=44;i<data.length;i+=4)samples.push((data.readInt16LE(i)+data.readInt16LE(i+2))/2);
  assert.ok(samples.length/rate>.6);
  assert.equal(samples[0],0);assert.equal(samples.at(-1),0);
  let best=-Infinity,lag=0;
  for(let l=Math.floor(rate/(hz*1.04));l<=Math.ceil(rate/(hz*.96));l++){
   let sum=0;for(let i=rate*.15|0;i<rate*.35;i++)sum+=samples[i]*samples[i+l];
   if(sum>best){best=sum;lag=l;}
  }
  assert.ok(Math.abs(1200*Math.log2(rate/lag/hz))<20,`${note} tuning`);
 }
});
