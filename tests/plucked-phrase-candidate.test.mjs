import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';import {loadModule} from './helpers.mjs';
const base={compositionStyle:'auto',instrument:'Piano',instrumentProfile:'Daruan',clef:'bass',difficulty:'intermediate',keySignature:'C',tonic:'C',scaleId:'major',timeSignature:'4/4',rhythmLevel:'medium',measures:8,tempo:90,range:{min:38,max:67},allowAccidentals:false,mixedMeters:false,meters:['4/4']};
const plain=x=>JSON.parse(JSON.stringify(x));const random=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};

test('phrase candidate remains separate and ordinary generation retains its exact pre-candidate output',()=>{
 const fixtures=JSON.parse(fs.readFileSync(new URL('./fixtures/phrase-candidate-defaults.json',import.meta.url)));
 for(const c of fixtures){const ex=loadModule('src/music/composeExercise.ts',c.seed).composeExercise(c.options,c.grand);assert.equal(createHash('sha256').update(JSON.stringify(ex)).digest('hex'),c.hash);}
});
test('complete basic ideas and independently composed replies support several real phrase boundaries and rhythm identities',()=>{
 const {planPluckedPhraseStudy}=loadModule('src/music/pluckedPhraseCandidate.ts');
 // Spread the test streams across the32-bit domain; adjacent LCG seeds have
 // correlated first draws and do not model independent Math.random streams.
 const plans=Array.from({length:20},(_,i)=>planPluckedPhraseStudy(base,random((Math.imul(i+1,2654435761)^96017)>>>0)));
 assert.ok(new Set(plans.map(p=>p.intent.phrases.map(f=>f.endBar-f.startBar+1).join(','))).size>=4);
 assert.ok(new Set(plans.map(p=>JSON.stringify(p.design.primary))).size>=18);
 assert.ok(plans.filter(p=>p.design.primary.length>8).length>=10,'the melody idea is longer than one tiny looping cell');
 assert.ok(plans.every(p=>JSON.stringify(p.design.primary)!==JSON.stringify(p.design.reply)));
 assert.ok(plans.every(p=>p.intent.phrases.length>=2&&p.intent.phrases.at(-1).cadence==='home'));
});
test('phrase candidate preserves exact meter length and valid saved musical intent in every supported tier and length',()=>{
 const {planPluckedPhraseStudy}=loadModule('src/music/pluckedPhraseCandidate.ts'),{validMusicalIntent}=loadModule('src/music/musicalIntent.ts'),{assertMeasureRhythm}=loadModule('src/music/rhythmTiming.ts');
 for(const timeSignature of ['2/4','3/4','4/4','5/4','3/8','6/8','7/8','9/8','12/8'])for(const measures of [4,8,12,16])for(const rhythmLevel of ['simple','medium','complex']){
  const p=planPluckedPhraseStudy({...base,timeSignature,measures,rhythmLevel},random(96619));assert.ok(validMusicalIntent(p.intent,measures));
  const [top,bottom]=timeSignature.split('/').map(Number);
  for(const b of p.intent.rhythm)assertMeasureRhythm({totalUnits:top*16/bottom,events:b.notes.map(n=>({...n,durationUnits:n.units}))},timeSignature);
 }
});
test('pitch grades preserve the planned phrase/rhythm identity while the final notes retain their legal path',()=>{
 for(const instrumentProfile of ['Daruan','Pipa','Yangqin']){
  let planned,actual;
  for(const difficulty of ['beginner','intermediate','advanced']){
   const options={...base,instrumentProfile,difficulty,rhythmLevel:'complex',range:instrumentProfile==='Daruan'?base.range:{min:45,max:88}},api=loadModule('src/music/pluckedPhraseCandidate.ts',96643);
   const plan=api.planPluckedPhraseStudy(options,random(96643));planned??=plain(plan);assert.deepEqual(plain(plan),planned);
   const ex=api.composePluckedPhraseStudy(options,instrumentProfile==='Yangqin'?'two-hand':undefined);loadModule('src/music/exerciseQuality.ts').validateGeneratedExercise(ex,options.range,false);
   const timing=ex.measures.map(b=>b.events.map(n=>[n.startUnits,n.durationUnits,n.rest,n.tuplet]));actual??=plain(timing);assert.deepEqual(plain(timing),actual);
   const notes=ex.measures.flatMap(b=>b.events.filter(n=>!n.rest));assert.ok(notes.filter(n=>n.durationUnits<=1).length/notes.length>=.8);
   if(instrumentProfile==='Daruan')assert.ok(notes.length>=100);
  }
 }
});
test('unsupported specialist settings cannot accidentally select this listening candidate',()=>{
 const {planPluckedPhraseStudy}=loadModule('src/music/pluckedPhraseCandidate.ts');
 for(const patch of [{instrumentProfile:'Piano'},{mixedMeters:true},{allowAccidentals:true},{pitchFocus:'scales'},{rhythmFocus:'triplets'}])assert.throws(()=>planPluckedPhraseStudy({...base,...patch}));
});

test('rhythm, melody and combined questions couple durations and pitches without changing the selected tier',()=>{
 const {planPluckedPhraseStudy}=loadModule('src/music/pluckedPhraseCandidate.ts');
 const plans=['melody','rhythm','combined'].map(focus=>planPluckedPhraseStudy({...base,rhythmLevel:'complex'},random(96731),focus));
 assert.deepEqual(plans.map(p=>p.design.focus),['melody','rhythm','combined']);
 for(const p of plans){const n=p.intent.rhythm.flatMap(b=>b.notes.filter(n=>!n.rest));assert.ok(n.length>=100&&n.filter(n=>n.units<=1).length/n.length>=.8);}
 assert.ok(plans[0].design.character.hold>plans[2].design.character.hold&&plans[2].design.character.hold>plans[1].design.character.hold);
 assert.ok(new Set(plans.map(p=>JSON.stringify([p.design.primary,p.intent.rhythm,p.intent.harmony]))).size>=2,'priorities must affect the music, not only the focus label');
});
