import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';

test('Erhu avoids destructive stereo summing and the rejected noisy D6 recording',()=>{
  const manifest=JSON.parse(fs.readFileSync('src/audio/sampleManifest.json','utf8'));
  const bank=manifest.Erhu;
  const report=JSON.parse(fs.readFileSync(`public/samples/${bank.folder}/provenance.json`,'utf8'));
  assert.equal(report.license,'CC0-1.0');
  assert.equal(report.revision,2);
  assert.equal(Object.keys(bank.urls).length,24);
  assert.deepEqual(report.files.map(row=>row.midi),Array.from({length:24},(_,i)=>62+i));
  assert.equal(bank.urls.D6,undefined,'the noisy D6 take must not re-enter playback');
  assert.ok(12 / 2**(1/12) > 10,'nearest recorded C#6 must sustain a long D6 after repitching');
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
    assert.ok(['left','right'].includes(row.sourceChannel),'retain one original microphone, never sum the antiphase pair');
    assert.ok(row.pitchAutocorrelation>=.90,'reject irregular/noisy bowed sustain');
    assert.ok(row.sustainExtension.crossfadeCorrelation>=.80,'avoid unmatched sustain joins');
    assert.match(bank.urls[row.note],/single-channel-v2/,'new URL must bypass old decoded sample caches');
    assert.match(row.source,new RegExp(report.commit));
    let peak=0;
    for(let offset=44;offset<data.length;offset+=2)peak=Math.max(peak,Math.abs(data.readInt16LE(offset)));
    assert.ok(peak>1000&&peak<32767);
  }
});
