import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';

test('Erhu uses recorded chromatic roots with enough sustain for slow whole notes across D4–D6',()=>{
  const manifest=JSON.parse(fs.readFileSync('src/audio/sampleManifest.json','utf8'));
  const bank=manifest.Erhu;
  const report=JSON.parse(fs.readFileSync(`public/samples/${bank.folder}/provenance.json`,'utf8'));
  assert.equal(report.license,'CC0-1.0');
  assert.equal(Object.keys(bank.urls).length,25);
  assert.deepEqual(report.files.map(row=>row.midi),Array.from({length:25},(_,i)=>62+i));
  for(const row of report.files){
    const data=fs.readFileSync(`public/samples/${bank.folder}/${bank.urls[row.note]}`);
    assert.equal(createHash('sha256').update(data).digest('hex'),row.outputSha256);
    assert.equal(data.toString('ascii',0,4),'RIFF');
    assert.equal(data.toString('ascii',8,12),'WAVE');
    assert.equal(data.readUInt16LE(20),1);
    assert.equal(data.readUInt16LE(22),1);
    const seconds=data.readUInt32LE(40)/data.readUInt32LE(28);
    assert.equal(seconds,12);
    assert.ok(Math.abs(row.outputTuningErrorCents)<5);
    assert.match(row.source,new RegExp(report.commit));
    let peak=0;
    for(let offset=44;offset<data.length;offset+=2)peak=Math.max(peak,Math.abs(data.readInt16LE(offset)));
    assert.ok(peak>1000&&peak<32767);
  }
});
