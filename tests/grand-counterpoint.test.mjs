import test from 'node:test';import assert from 'node:assert/strict';import {loadModule}from'./helpers.mjs';
const {coordinateGrandCounterpoint}=loadModule('src/music/grandCounterpoint.ts');
const {describeTonality,buildPitchMaterial}=loadModule('src/music/scales.ts');
const {midiFromKey}=loadModule('src/music/notePitches.ts');
const plain=value=>JSON.parse(JSON.stringify(value)),names=['c','c#','d','d#','e','f','f#','g','g#','a','a#','b'];
function note(midi,startUnits,durationUnits){const octave=Math.floor(midi/12)-1;return{midi,octave,key:names[midi%12]+'/'+octave,startUnits,durationUnits,duration:durationUnits===16?'w':durationUnits===8?'h':durationUnits===4?'q':'8',dots:0,rest:false};}
const bar=events=>({timeSignature:'4/4',totalUnits:16,groups:[4,4,4,4],beamGroups:[4,4,4,4],events});
function study(){return{instrument:'Piano',soundProfile:'Piano',grandMode:'two-hand',difficulty:'intermediate',clef:'treble',tempo:80,timeSignature:'4/4',keySignature:'C',rhythmLevel:'medium',tonality:describeTonality('C','major'),
 measures:[[72,74,76,77],[79,77,74,72]].map(keys=>bar(keys.map((m,i)=>note(m,i*4,4)))),
 lowerMeasures:[[48,50,52,53],[55,53,50,48]].map(keys=>bar(keys.map((m,i)=>note(m,i*4,4)))),
 harmonyPlan:[{root:0,pitches:[0,4,7],role:'home'},{root:0,pitches:[0,4,7],role:'arrive'}]};}
function forbidden(ex){const upper=ex.measures.flatMap(b=>b.events).filter(n=>!n.rest),lower=ex.lowerMeasures.flatMap(b=>b.events).filter(n=>!n.rest);let violations=0;
 for(let i=1;i<upper.length;i++){const du=upper[i].midi-upper[i-1].midi,db=lower[i].midi-lower[i-1].midi,a=((upper[i-1].midi-lower[i-1].midi)%12+12)%12,b=((upper[i].midi-lower[i].midi)%12+12)%12;
  if(du*db>0&&[0,7].includes(b)&&(a===b||Math.abs(du)>2))violations++;
 }return violations;}

test('a root-doubling fixture is rebuilt without actual parallel or hidden perfect outer intervals',()=>{
 const source=study(),before=JSON.stringify(source);assert.ok(forbidden(source)>0);
 const result=coordinateGrandCounterpoint(source,{min:36,max:84});assert.ok(result);assert.equal(forbidden(result),0);
 assert.equal(JSON.stringify(source),before);assert.deepEqual(plain(result.measures),plain(source.measures));
 assert.deepEqual(result.lowerMeasures.flatMap(b=>b.events.map(n=>[n.startUnits,n.durationUnits,n.rest])),source.lowerMeasures.flatMap(b=>b.events.map(n=>[n.startUnits,n.durationUnits,n.rest])));
 assert.equal(result.lowerMeasures.at(-1).events.at(-1).midi%12,0);
});

test('a bass-relative fourth is not treated as an interchangeable stable third or sixth',()=>{
 const source=study();source.measures=[bar([note(65,0,16)]),bar([note(72,0,16)])];source.lowerMeasures=[bar([note(48,0,16)]),bar([note(48,0,16)])];
 const result=coordinateGrandCounterpoint(source,{min:48,max:84});assert.ok(result);
 const bass=result.lowerMeasures[0].events[0].midi;assert.notEqual((65-bass)%12,5);assert.equal(bass,50);
 assert.equal(result.measures[0].events[0].midi,65);
});

test('a real weak neighbour between consonances can retain its held tonic instead of forcing a fresh bass for each note',()=>{
 const source=study();source.measures=[bar([note(72,0,2),note(74,2,2),note(72,4,4),note(76,8,8)]),bar([note(72,0,16)])];
 source.lowerMeasures=[bar([note(48,0,16)]),bar([note(48,0,16)])];
 const result=coordinateGrandCounterpoint(source,{min:36,max:84});assert.ok(result);assert.equal(result.lowerMeasures[0].events[0].midi%12,0);
 assert.deepEqual(plain(result.measures),plain(source.measures));
});

test('re-running the final pass is idempotent even when the original has no harmonic plan',()=>{
 const source=study();delete source.harmonyPlan;
 const first=coordinateGrandCounterpoint(source,{min:36,max:84}),second=coordinateGrandCounterpoint(first,{min:36,max:84});
 assert.ok(first&&second);assert.deepEqual(plain(second),plain(first));
});

test('both written and sounding bass pitches remain in the mode with independent difficulty limits',()=>{
 for(const scaleId of ['major','natural-minor','dorian','major-pentatonic'])for(const difficulty of ['beginner','advanced']){
  const source=study();source.tonality=describeTonality('C',scaleId);source.difficulty=difficulty;
  const result=coordinateGrandCounterpoint(source,{min:36,max:84});assert.ok(result);
  const bass=result.lowerMeasures.flatMap(b=>b.events);for(const n of bass)assert.equal(midiFromKey(n.key),n.midi);
  const allowed=buildPitchMaterial(source.tonality,{min:36,max:59}).pitches.map(p=>p.midi);
  assert.ok(bass.every(n=>allowed.includes(n.midi)));
  assert.ok(bass.every(n=>n.midi>=36&&n.midi<=59));
  assert.ok(bass.slice(1).every((n,i)=>Math.abs(n.midi-bass[i].midi)<=(difficulty==='beginner'?7:24)));
 }
});

test('unsupported textures return control to the existing legal fallback without changing an input',()=>{
 for(const source of [{...study(),grandMode:'mono'},{...study(),lowerMeasures:undefined},{...study(),tonality:describeTonality('C','atonal')}]){
  const original=JSON.stringify(source);assert.equal(coordinateGrandCounterpoint(source,{min:36,max:84}),undefined);assert.equal(JSON.stringify(source),original);
 }
});
