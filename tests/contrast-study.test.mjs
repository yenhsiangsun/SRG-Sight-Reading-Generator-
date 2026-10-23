import test from 'node:test';import assert from 'node:assert/strict';import {loadModule}from'./helpers.mjs';
const base={compositionStyle:'auto',instrument:'Piano',instrumentProfile:'Piano',clef:'treble',difficulty:'intermediate',keySignature:'C',tonic:'C',scaleId:'major',timeSignature:'4/4',rhythmLevel:'medium',measures:8,tempo:80,range:{min:36,max:84},allowAccidentals:false,mixedMeters:false,meters:['4/4']};
const plain=x=>JSON.parse(JSON.stringify(x)),timing=ex=>JSON.stringify(ex.measures.map(b=>b.events.map(n=>[n.durationUnits,n.rest,n.tuplet])));
const {planContrastIntent}=loadModule('src/music/contrastRhythm.ts');
const {validMusicalIntent,planMusicalIntent}=loadModule('src/music/musicalIntent.ts');
const {assertMeasureRhythm}=loadModule('src/music/rhythmTiming.ts');
const {validateGeneratedExercise}=loadModule('src/music/exerciseQuality.ts');
const {buildPitchMaterial,describeTonality}=loadModule('src/music/scales.ts');

test('two independent candidates change whole phrase architecture and the actual opening duration inventory',()=>{
 const a=planMusicalIntent({...base,compositionStyle:'classical'},()=>.1),b=planContrastIntent(base,'dialogue',()=>.1),c=planContrastIntent(base,'long-line',()=>.1);
 assert.equal(new Set([a,b,c].map(p=>JSON.stringify(p.phrases.map(f=>f.endBar-f.startBar+1)))).size,3);
 assert.equal(new Set([a,b,c].map(p=>p.rhythm[0].notes.map(n=>n.units).sort((x,y)=>x-y).join(','))).size,3,'not just equal-inventory permutations');
 assert.equal(b.rhythm[0].notes[0].rest,true);assert.equal(c.rhythm[0].notes[0].rest,false);assert.equal(c.rhythm[0].notes[0].units,8);
 for(const p of [b,c]){assert.ok(validMusicalIntent(p,8));assert.equal(p.phrases.at(-1).cadence,'home');assert.equal(p.harmony.at(-1).root,0);}
});

test('every candidate tier keeps complete bars, a real compound pulse and separated challenge density',()=>{
 for(const family of ['dialogue','long-line'])for(const meter of ['2/4','3/4','4/4','5/4','3/8','6/8','7/8','9/8','12/8'])for(const measures of [4,8,12,16]){
  const stats=[];
  for(const rhythmLevel of ['simple','medium','complex']){
   const p=planContrastIntent({...base,timeSignature:meter,measures,rhythmLevel},family,()=>.37);
   const all=p.rhythm.flatMap(b=>b.notes),sounds=all.filter(n=>!n.rest),total=all.reduce((s,n)=>s+n.units,0);
   stats.push({density:sounds.length/total*4,short:sounds.filter(n=>n.units<=1).length/sounds.length});
   assert.ok(validMusicalIntent(p,measures));
   for(const b of p.rhythm){const [top,bottom]=meter.split('/').map(Number);assertMeasureRhythm({totalUnits:top*16/bottom,events:b.notes.map(n=>({...n,durationUnits:n.units}))},meter);}
  }
  if(['4/4','6/8'].includes(meter)){assert.ok(stats[1].density>stats[0].density+.35,JSON.stringify({family,meter,measures,stats}));assert.ok(stats[2].density>stats[1].density*1.15);assert.ok(stats[2].short>.55);}
 }
});

test('completed candidates preserve independent pitch grades, legal voices, endings and actual pulse durations',()=>{
 for(const family of ['dialogue','long-line'])for(const instrument of ['Piano','Yangqin']){
  let rhythm;
  for(const difficulty of ['beginner','intermediate','advanced']){
   const o={...base,instrumentProfile:instrument,difficulty,rhythmLevel:'complex',timeSignature:instrument==='Piano'?'4/4':'6/8',scaleId:instrument==='Piano'?'major':'major-pentatonic'};
   const ex=loadModule('src/music/contrastStudy.ts',88213).composeContrastStudy(o,family,'two-hand');
   validateGeneratedExercise(ex,o.range,false);rhythm??=timing(ex);assert.equal(timing(ex),rhythm);
   const allowed=buildPitchMaterial(describeTonality('C',o.scaleId),o.range).pitches.map(p=>p.midi),limit={beginner:7,intermediate:12,advanced:24}[difficulty];
   for(const voice of [ex.measures,ex.lowerMeasures]){const notes=voice.flatMap(b=>b.events.filter(n=>!n.rest));assert.ok(notes.every(n=>allowed.includes(n.midi)));assert.ok(notes.slice(1).every((n,i)=>Math.abs(n.midi-notes[i].midi)<=limit));assert.equal(notes.at(-1).midi%12,0);}
   assert.deepEqual(plain(ex.harmonyPlan),plain(ex.musicalIntent.harmony));
  }
 }
});

test('the rendered candidate melody and opening are not merely labels on a transposed copy',()=>{
 const scores=['dialogue','long-line'].map(f=>loadModule('src/music/contrastStudy.ts',88227).composeContrastStudy(base,f,'two-hand'));
 const opening=ex=>{const notes=ex.measures.slice(0,2).flatMap(b=>b.events.filter(n=>!n.rest));return notes.map(n=>n.midi-notes[0].midi).join(',');};
 assert.notEqual(opening(scores[0]),opening(scores[1]));assert.notEqual(timing(scores[0]),timing(scores[1]));
 assert.ok(scores[0].measures[0].events[0].rest);assert.equal(scores[1].measures[0].events[0].durationUnits,8);
 const bars=scores[0].measures.map((b,i)=>JSON.stringify(b.events.map(n=>[n.midi,n.durationUnits,n.rest]))!==JSON.stringify(scores[1].measures[i].events.map(n=>[n.midi,n.durationUnits,n.rest])));
 assert.ok(bars.filter(Boolean).length>=6,'contrast must develop beyond a few first notes');
});

test('candidate entry is explicit and unsupported specialist options do not silently switch family',()=>{
 const {composeContrastStudy}=loadModule('src/music/contrastStudy.ts');
 for(const patch of [{mixedMeters:true},{allowAccidentals:true},{pitchFocus:'scales'},{rhythmFocus:'dotted'}])assert.throws(()=>composeContrastStudy({...base,...patch},'dialogue','two-hand'),/獨立候選/);
});

test('a monophonic staff transfer keeps one sounding line when realizing an explicit candidate',()=>{
 for(const family of ['dialogue','long-line']){
  const options={...base,instrumentProfile:'Guzheng',range:{min:48,max:84}};
  const ex=loadModule('src/music/contrastStudy.ts',88311).composeContrastStudy(options,family,'mono');
  validateGeneratedExercise(ex,options.range,false);
  for(const [b,bar]of ex.measures.entries())for(const [i,n]of bar.events.entries())assert.ok(n.rest||ex.lowerMeasures[b].events[i].rest,'one melody, not two sounding voices');
  const merged=ex.measures.flatMap((bar,b)=>bar.events.map((n,i)=>n.rest?ex.lowerMeasures[b].events[i]:n)).filter(n=>!n.rest);
  assert.ok(merged.length>0);assert.equal(merged.at(-1).midi%12,0);
 }
});
