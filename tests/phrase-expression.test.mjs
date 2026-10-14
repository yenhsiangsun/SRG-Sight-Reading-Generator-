import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

const {planExercisePhrases}=loadModule('src/music/phrasePlan.ts');
const {planBreathing}=loadModule('src/music/instrumentPlayability.ts');
const {addPerformanceMarks}=loadModule('src/music/performanceMarks.ts');
const {planStudyMelody}=loadModule('src/music/studyMelody.ts');
const {buildPitchMaterial,describeTonality}=loadModule('src/music/scales.ts');
const {TIME_SIGNATURES}=loadModule('src/music.ts');
const plain=value=>JSON.parse(JSON.stringify(value));
const rhythmBar=(meter='4/4')=>({meter,notes:Array.from({length:TIME_SIGNATURES[meter].units/4},(_,index)=>
  ({duration:'q',dots:0,units:4,startUnits:index*4,rest:false}))});
const bar=(pitches=[60,62,65,67,69,67,65,62])=>({timeSignature:'4/4',totalUnits:16,groups:[4,4,4,4],beamGroups:[4,4,4,4],
  events:pitches.map((midi,index)=>({key:'c/4',midi,octave:4,rest:false,startUnits:index*2,durationUnits:2,duration:'8',dots:0}))});
const phrasePlan=[{startBar:0,endBar:2,role:'opening'},{startBar:3,endBar:5,role:'answer'},{startBar:6,endBar:7,role:'closing'}];

test('shared phrasing is stable before graded pitches and opens every changed meter section',()=>{
  const rhythm=['4/4','4/4','4/4','6/8','6/8','6/8','9/8','9/8','9/8','9/8','9/8'].map(rhythmBar);
  const before=JSON.stringify(rhythm),phrases=planExercisePhrases(rhythm);
  assert.equal(JSON.stringify(rhythm),before);
  assert.deepEqual(plain(planExercisePhrases(plain(rhythm))),plain(phrases));
  assert.equal(phrases[0].startBar,0);assert.equal(phrases.at(-1).endBar,rhythm.length-1);
  assert.ok(phrases.every(phrase=>phrase.endBar-phrase.startBar+1>=2&&phrase.endBar-phrase.startBar+1<=4));
  assert.ok(phrases.every(phrase=>rhythm.slice(phrase.startBar,phrase.endBar+1).every(bar=>bar.meter===rhythm[phrase.startBar].meter)));
  assert.ok(phrases.some(phrase=>phrase.startBar===3));assert.ok(phrases.some(phrase=>phrase.startBar===6));
  for(let index=1;index<phrases.length;index++)assert.equal(phrases[index].startBar,phrases[index-1].endBar+1);
});

test('breathing follows actual phrase endings without altering tuplets or the final cadence',()=>{
  const rhythm=Array.from({length:8},()=>rhythmBar()),before=JSON.stringify(rhythm);
  const breathed=planBreathing(rhythm,'Flute',phrasePlan);
  assert.equal(JSON.stringify(rhythm),before);
  assert.deepEqual(breathed.flatMap((bar,index)=>bar.notes.at(-1).rest?[index]:[]),[2,5]);
  assert.ok(breathed.every(bar=>bar.notes.reduce((sum,note)=>sum+note.units,0)===16));
  assert.equal(breathed[7].notes.at(-1).rest,false);
  const triplets=plain(rhythm);triplets[2].notes.at(-1).tuplet=3;
  assert.equal(planBreathing(triplets,'Flute',phrasePlan)[2],triplets[2]);
  assert.equal(planBreathing(rhythm,'Piano',phrasePlan),rhythm);
});

test('melodic figures consume the common boundaries across all pitch grades',()=>{
  const measures=Array.from({length:8},()=>bar()),tonality=describeTonality('C','major');
  const pitches=buildPitchMaterial(tonality,{min:60,max:84}).pitches;
  for(const grade of ['beginner','intermediate','advanced']) {
    const plan=planStudyMelody(measures,pitches,0,grade,'Flute',phrasePlan);
    assert.deepEqual(plain(plan.phrases.map(({startBar,endBar,role})=>({startBar,endBar,role}))),phrasePlan);
    assert.equal(plan.targets.length,64);
  }
});

test('phrase expression preserves the score while locating sparse safe gestures at actual note anchors',()=>{
  const source={instrument:'Piano',soundProfile:'Piano',difficulty:'intermediate',timeSignature:'4/4',tempo:90,
    measures:Array.from({length:8},()=>bar()),lowerMeasures:Array.from({length:8},()=>bar([48,50,53,55,57,55,53,50])),phrasePlan};
  source.measures[0].events[1].rest=true;
  const before=JSON.stringify(source),marked=addPerformanceMarks(source,()=>0);
  assert.equal(JSON.stringify(source),before);
  const clean=plain(marked);delete clean.expressionSpans;
  for(const staff of [clean.measures,clean.lowerMeasures])for(const bar of staff)for(const note of bar.events){delete note.articulation;delete note.dynamic;}
  assert.equal(JSON.stringify(clean),before);
  assert.deepEqual(marked.measures.flatMap((bar,index)=>bar.events.some(note=>note.dynamic)?[index]:[]),[0,3,6]);
  assert.deepEqual(plain(marked.measures.map(bar=>bar.events.map(note=>note.dynamic))),plain(marked.lowerMeasures.map(bar=>bar.events.map(note=>note.dynamic))));
  assert.ok(marked.expressionSpans.some(span=>span.kind==='slur'));
  assert.ok(marked.expressionSpans.some(span=>span.kind==='crescendo'));
  assert.ok(marked.expressionSpans.filter(span=>span.kind==='slur').length<=2);
  assert.ok(marked.expressionSpans.filter(span=>span.kind!=='slur').length<=1);
  for(const span of marked.expressionSpans) {
    const staff=span.staff===1?marked.lowerMeasures:marked.measures;
    const notes=staff.flatMap((bar,b)=>bar.events.flatMap((note,n)=>(b>span.start.bar||b===span.start.bar&&n>=span.start.event)&&
      (b<span.end.bar||b===span.end.bar&&n<=span.end.event)?[note]:[]));
    assert.equal(notes[0].rest,false);assert.equal(notes.at(-1).rest,false);
    if(span.kind==='slur'){assert.ok(notes.length>=2&&span.end.bar-span.start.bar<=1);assert.ok(notes.every(note=>!note.rest&&note.articulation!=='staccato'&&!note.technique));}
    if(span.kind==='crescendo')assert.ok(notes.at(-1).midi-notes[0].midi>=3);
    if(span.kind==='diminuendo')assert.ok(notes[0].midi-notes.at(-1).midi>=3);
  }
  assert.equal(addPerformanceMarks(source,()=>0,false),source);
});
