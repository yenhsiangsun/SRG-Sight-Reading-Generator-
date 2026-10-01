import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';

const bank=JSON.parse(fs.readFileSync('src/audio/sampleManifest.json','utf8')).Erhu;
const directory=`public/samples/${bank.folder}`;

test('Erhu replaces rejected AliExpress recordings with attributed BISA performances',()=>{
  const report=JSON.parse(fs.readFileSync(`${directory}/provenance.json`,'utf8'));
  assert.equal(bank.folder,'erhu-bisa');
  assert.deepEqual(Object.keys(bank.urls).sort(),['A4','E5']);
  assert.match(JSON.stringify(report),/Yu Chun Chan/);
  assert.ok(JSON.stringify(report).includes('remix.berklee.edu'));
  assert.match(report.license,/CC BY/);
  assert.equal(report.files.length,2,'do not present shifted copies as independent recordings');
  for(const row of report.files){
    const data=fs.readFileSync(`${directory}/${bank.urls[row.note]}`);
    assert.equal(createHash('sha256').update(data).digest('hex'),row.outputSha256);
    assert.equal(data.toString('ascii',0,4),'RIFF');
    assert.equal(data.toString('ascii',8,12),'WAVE');
    assert.equal(data.readUInt16LE(20),1,'PCM supported by native WebAudio');
    assert.equal(data.readUInt16LE(34),16);
    const seconds=data.readUInt32LE(40)/data.readUInt32LE(28);
    assert.equal(seconds,24);
    assert.ok(Math.abs(row.outputTuningErrorCents)<5);
    let peak=0;
    for(let offset=44;offset<data.length;offset+=2)peak=Math.max(peak,Math.abs(data.readInt16LE(offset)));
    assert.ok(peak>1000&&peak<30000,'preserve headroom without clipping');
    const original=fs.readFileSync(`${directory}/${row.note}-original.wav`);
    assert.equal(createHash('sha256').update(original).digest('hex'),row.sourceSha256,'original audition must stay unmodified');
  }
});

test('Erhu replacement covers sustained high notes without exhausting the recording',()=>{
  const roots=[{note:'A4',midi:69},{note:'E5',midi:76}];
  for(let midi=62;midi<=86;midi++){
    const nearest=roots.reduce((a,b)=>Math.abs(b.midi-midi)<=Math.abs(a.midi-midi)?b:a);
    const data=fs.readFileSync(`${directory}/${bank.urls[nearest.note]}`);
    const rate=data.readUInt32LE(24),channels=data.readUInt16LE(22);
    const speed=2**((midi-nearest.midi)/12);
    const duration=data.readUInt32LE(40)/data.readUInt32LE(28)/speed;
    assert.ok(duration>12,`MIDI ${midi} must sustain at least 12 seconds after repitching`);
    let square=0,count=0;
    for(let frame=Math.floor(7*speed*rate);frame<Math.floor(7.8*speed*rate);frame++){
      const value=data.readInt16LE(44+frame*channels*2)/32768;
      square+=value*value;count++;
    }
    assert.ok(Math.sqrt(square/count)>.01,`MIDI ${midi} sustained tail must remain audible`);
  }
});
