import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('Erhu uses valid local PCM recordings with enough sustain for slow whole notes across D4–D6',()=>{
  const manifest=JSON.parse(fs.readFileSync('src/audio/sampleManifest.json','utf8'));
  assert.equal(manifest.Erhu.folder,'erhu');
  for(const [note,midi] of [['A4',69],['E5',76]]){
    const data=fs.readFileSync(`public/samples/erhu/${manifest.Erhu.urls[note]}`);
    assert.equal(data.toString('ascii',0,4),'RIFF');
    assert.equal(data.toString('ascii',8,12),'WAVE');
    assert.equal(data.readUInt16LE(20),1);
    assert.equal(data.readUInt16LE(22),2);
    const seconds=data.readUInt32LE(40)/data.readUInt32LE(28);
    const highestMapped=note==='A4'?72:86;
    assert.ok(seconds/2**((highestMapped-midi)/12)>5);
    let peak=0;
    for(let offset=44;offset<data.length;offset+=2)peak=Math.max(peak,Math.abs(data.readInt16LE(offset)));
    assert.ok(peak>1000&&peak<32767);
  }
});
