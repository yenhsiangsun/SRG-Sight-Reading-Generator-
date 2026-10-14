import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

const {planMusicalSlurs}=loadModule('src/music/slurPhrasing.ts');
const {addPerformanceMarks}=loadModule('src/music/performanceMarks.ts');
const {describeTonality}=loadModule('src/music/scales.ts');
const plain=value=>JSON.parse(JSON.stringify(value));
const cell=(durationUnits,midi,extra={})=>({durationUnits,midi,key:'c/4',octave:4,rest:false,dots:0,
  duration:durationUnits===.5?'32':durationUnits===1?'16':durationUnits===4/3?'8':durationUnits===2?'8':durationUnits===8?'h':'q',...extra});
function bar(cells,meter='4/4') {
  let startUnits=0;
  const events=cells.map(note=>{const result={...note,startUnits};startUnits+=note.durationUnits;return result;});
  return {timeSignature:meter,totalUnits:meter==='6/8'?12:16,groups:meter==='6/8'?[6,6]:[4,4,4,4],beamGroups:meter==='6/8'?[6,6]:[4,4,4,4],events};
}
const exercise=(measures,phrasePlan=[{startBar:0,endBar:measures.length-1,role:'closing'}])=>
  ({instrument:'Piano',difficulty:'intermediate',timeSignature:'4/4',tonality:describeTonality('C','major'),measures,phrasePlan});
function spanNotes(ex,span) {
  return ex.measures.flatMap((bar,b)=>bar.events.flatMap((note,n)=>(b>span.start.bar||b===span.start.bar&&n>=span.start.event)&&
    (b<span.end.bar||b===span.end.bar&&n<=span.end.event)?[note]:[]));
}

test('a complete quarter-note arch reaches its tonal release instead of cutting at the unresolved second note',()=>{
  const ex=exercise([bar([cell(4,60),cell(4,62),cell(4,64),cell(4,60)])]);
  assert.deepEqual(plain(planMusicalSlurs(ex)),[{kind:'slur',staff:0,start:{bar:0,event:0},end:{bar:0,event:3}}]);
});

test('a pickup after silence connects through the actual longer arrival',()=>{
  const ex=exercise([bar([cell(2,60,{rest:true}),cell(2,62),cell(2,64),cell(2,65),cell(4,67,{articulation:'tenuto'}),cell(4,60,{rest:true})])]);
  assert.deepEqual(plain(planMusicalSlurs(ex)),[{kind:'slur',staff:0,start:{bar:0,event:1},end:{bar:0,event:4}}]);
});

test('triplets and complete thirty-second pickups resolve onto their arrival without partial group endpoints',()=>{
  const triplets=exercise([bar([cell(4/3,60,{tuplet:3}),cell(4/3,62,{tuplet:3}),cell(4/3,64,{tuplet:3}),
    cell(4,65,{articulation:'tenuto'}),cell(8,60,{rest:true})])]);
  const tripletSpan=planMusicalSlurs(triplets)[0];
  assert.equal(tripletSpan.start.event,0);assert.equal(tripletSpan.end.event,3);
  assert.equal(spanNotes(triplets,tripletSpan).filter(note=>note.tuplet).length,3);
  const rapid=exercise([bar([cell(2,60,{rest:true}),cell(.5,60),cell(.5,62),cell(.5,64),cell(.5,65),
    cell(4,67,{articulation:'tenuto'}),cell(8,60,{rest:true})])]);
  const rapidSpan=planMusicalSlurs(rapid)[0];
  assert.equal(rapidSpan.start.event,1);assert.equal(rapidSpan.end.event,5);
  assert.equal(spanNotes(rapid,rapidSpan).filter(note=>note.duration==='32').length,4);
  assert.equal(spanNotes(rapid,rapidSpan).at(-1).articulation,'tenuto');
});

test('a complete two-bar gesture can exceed six notes and remains inside its shared phrase',()=>{
  const ex=exercise([bar([cell(4,60),cell(4,62),cell(4,64),cell(4,65)]),
    bar([cell(2,67),cell(2,65),cell(2,64),cell(2,62),cell(4,60,{articulation:'tenuto'}),cell(4,60,{rest:true})])]);
  const spans=planMusicalSlurs(ex),span=spans[0];
  assert.equal(span.start.bar,0);assert.equal(span.start.event,0);assert.equal(span.end.bar,1);assert.equal(span.end.event,4);
  assert.equal(spanNotes(ex,span).length,9);
});

test('new dynamics, detached articulation and meter changes divide gestures without changing the written score',()=>{
  const ex=exercise([bar([cell(2,60),cell(2,62),cell(2,64),cell(2,65),cell(4,67,{dynamic:'f'}),cell(4,69,{articulation:'accent'})]),
    bar([cell(2,60),cell(2,62),cell(2,64),cell(2,65),cell(4,67,{articulation:'tenuto'})],'6/8')]);
  const before=JSON.stringify(ex),spans=planMusicalSlurs(ex);
  assert.equal(JSON.stringify(ex),before);assert.deepEqual(plain(planMusicalSlurs(ex)),plain(spans));
  assert.ok(spans.length>0);
  for(const span of spans) {
    assert.equal(ex.measures[span.start.bar].timeSignature,ex.measures[span.end.bar].timeSignature);
    assert.ok(spanNotes(ex,span).slice(1).every(note=>!note.dynamic&&note.articulation!=='accent'&&note.articulation!=='staccato'&&!note.technique&&!note.rest));
  }
});

test('ambiguous repeated-note pairs and broken fast groups are omitted rather than forced',()=>{
  const repeated=exercise([bar([cell(4,60),cell(4,60),cell(8,60,{rest:true})])]);
  assert.deepEqual(plain(planMusicalSlurs(repeated)),[]);
  const broken=exercise([bar([cell(4/3,60,{tuplet:3,rest:true}),cell(4/3,62,{tuplet:3}),cell(4/3,64,{tuplet:3}),
    cell(4,65,{articulation:'staccato'}),cell(8,60,{rest:true})])]);
  assert.deepEqual(plain(planMusicalSlurs(broken)),[]);
});

test('eight-bar studies keep sparse phrase-contained slurs and preserve unrelated hairpin decisions and random draws',()=>{
  const phrasePlan=[{startBar:0,endBar:1,role:'opening'},{startBar:2,endBar:3,role:'development'},
    {startBar:4,endBar:5,role:'answer'},{startBar:6,endBar:7,role:'closing'}];
  const ex=exercise(Array.from({length:8},(_,i)=>bar([0,1,3,5,7,5,3,1].map(p=>cell(2,60+i%3+p)))),phrasePlan);
  for(const [initial,expectedDraws] of [[13,15],[800,16],[177,17]]) {
    let seed=initial,draws=0;
    const random=()=>{draws++;seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    const marked=addPerformanceMarks(ex,random),slurs=marked.expressionSpans.filter(span=>span.kind==='slur');
    assert.ok(slurs.length<=2);
    for(const span of slurs)assert.ok(phrasePlan.some(phrase=>span.start.bar>=phrase.startBar&&span.end.bar<=phrase.endBar));
    assert.equal(draws,expectedDraws);
    assert.deepEqual(plain(marked.expressionSpans.filter(span=>span.kind!=='slur')),
      [{kind:'crescendo',staff:0,start:{bar:0,event:0},end:{bar:1,event:4}}]);
    const clean=plain(marked);delete clean.expressionSpans;
    for(const measure of clean.measures)for(const note of measure.events){delete note.articulation;delete note.dynamic;}
    assert.equal(JSON.stringify(clean),JSON.stringify(ex));
  }
});
