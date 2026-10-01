import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';

const manifest=JSON.parse(fs.readFileSync('src/audio/sampleManifest.json','utf8'));
const midi=note=>{const m=note.match(/^([A-G])(#?)(\d)$/);return 12*(+m[3]+1)+{C:0,D:2,E:4,F:5,G:7,A:9,B:11}[m[1]]+(m[2]?1:0);};

test('C-dizi and Guzheng contain verified recorded anchors with correct pitch maps and file hashes',()=>{
 for(const instrument of ['Qudi C','Guzheng']){
  const bank=manifest[instrument];
  const report=JSON.parse(fs.readFileSync(`public/samples/${bank.folder}/provenance.json`,'utf8'));
  assert.match(report.license,/CC0/);
  assert.ok(report.samples.length>=15);
  assert.equal(Object.keys(bank.urls).length,report.samples.length);
  for(const [note,name] of Object.entries(bank.urls)){
   const row=report.samples.find(r=>r.file===name);
   assert.ok(row);assert.equal(row.midi,midi(note));
   const bytes=fs.readFileSync(`public/samples/${bank.folder}/${name}`);
   assert.equal(createHash('sha256').update(bytes).digest('hex'),row.sha256);
   assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.readUInt16LE(20),1);
   assert.equal(bytes.readUInt32LE(24),44100);
   assert.ok(Math.abs(row.finalPitchCents??row.outputPitchCents)<5);
   assert.ok(row.peak>0&&row.peak<1);
   assert.ok((row.seconds??row.durationSeconds)>1.5);
  }
 }
});

test('solo strings stay within two semitones of recorded pitches and sparse wind gaps have closer anchors',()=>{
 for(const [instrument,low,high] of [['Viola',48,93],['Cello',36,81],['Bassoon',34,75],['French Horn',35,77],['Trombone',40,77]]){
  const roots=Object.keys(manifest[instrument].urls).map(midi);
  const limit=['Viola','Cello'].includes(instrument)?2:5;
  for(let note=low;note<=high;note++)assert.ok(Math.min(...roots.map(n=>Math.abs(n-note)))<=limit,`${instrument} ${note}`);
 }
});
