import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadModule} from './helpers.mjs';

const manifest=JSON.parse(fs.readFileSync('src/audio/sampleManifest.json','utf8'));
const report=JSON.parse(fs.readFileSync('public/samples/western-source-report.json','utf8'));
const {INSTRUMENTS}=loadModule('src/music/instruments.ts');
const western=Object.entries(INSTRUMENTS).filter(([name,p])=>!p.family.startsWith('國樂')&&name!=='Voice');
const midi=n=>{const m=n.match(/^([A-G])(#?)(\d)$/);return 12*(Number(m[3])+1)+{C:0,D:2,E:4,F:5,G:7,A:9,B:11}[m[1]]+(m[2]?1:0);};

test('all 17 Western instruments have distinct recorded banks covering their sounding ranges',()=>{
 assert.equal(western.length,17);
 assert.equal(new Set(western.map(([name])=>manifest[name].folder)).size,17);
 for(const [name,profile] of western){
  const bank=manifest[name];assert.ok(bank,name);
  assert.ok(Number.isFinite(bank.volume)&&bank.volume>=-20&&bank.volume<=6,name);
  const roots=Object.keys(bank.urls).map(midi);
  for(let pitch=profile.min+profile.transpose;pitch<=profile.max+profile.transpose;pitch++){
   assert.ok(Math.min(...roots.map(n=>Math.abs(n-pitch)))<=12,`${name}: unsupported sounding MIDI ${pitch}`);
  }
 }
});

test('each Western asset has decode, level, tuning and pinned source evidence',()=>{
 for(const [name] of western)for(const [note,file] of Object.entries(manifest[name].urls)){
  const row=report.find(r=>r.instrument===name&&r.midi===midi(note));
  assert.ok(row,`${name} ${note}`);
  assert.equal(row.file,`${manifest[name].folder}/${file}`);
  assert.ok(row.seconds>1&&row.peak>.001&&row.peak<=1&&row.rms>0);
  assert.ok(row.cents!==null&&Math.abs(row.cents)<=45,`${name} ${note} tuning`);
  assert.match(row.source,/github.com\/[^/]+\/[^/]+\/blob\/[a-f0-9]{40}\//);
  assert.ok(fs.statSync(`public/samples/${row.file}`).size>1000);
 }
 assert.equal(manifest.Clarinet.urls['F#6'],undefined,'excluded mistuned source');
});
