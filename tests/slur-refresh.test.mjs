import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

const {refreshSlurPhrasing}=loadModule('src/music/refreshSlurPhrasing.ts');
const {planMusicalSlurs}=loadModule('src/music/slurPhrasing.ts');
const {validExpressionSpans}=loadModule('src/music/expressionSpans.ts');
const {createPlaybackEvents}=loadModule('src/audio/PlaybackController.ts');
const plain=value=>JSON.parse(JSON.stringify(value));
const source=()=>({instrument:'Flute',soundProfile:'Flute',clef:'treble',timeSignature:'4/4',tempo:90,difficulty:'intermediate',
  rhythmLevel:'medium',keySignature:'C',phrasePlan:[{startBar:0,endBar:1,role:'opening'},{startBar:2,endBar:3,role:'closing'}],
  measures:Array.from({length:4},()=>({timeSignature:'4/4',totalUnits:16,groups:[4,4,4,4],beamGroups:[4,4,4,4],
    events:[60,62,64,65,67,65,62,60].map((midi,index)=>({midi,key:({60:'c/4',62:'d/4',64:'e/4',65:'f/4',67:'g/4'})[midi],octave:4,
      startUnits:index*2,durationUnits:2,duration:'8',dots:0,rest:false,...(index===0?{dynamic:'mp'}:{}),...(index===7?{articulation:'tenuto'}:{})}))})),
  expressionSpans:[{kind:'crescendo',staff:0,start:{bar:0,event:0},end:{bar:0,event:4}},
    {kind:'slur',staff:0,start:{bar:0,event:1},end:{bar:0,event:3}}]});

test('reopened phrasing changes only slur anchors and keeps the exact music, tempo, dynamics, hairpins and source',()=>{
  const exercise=source(),before=plain(exercise),refreshed=refreshSlurPhrasing(exercise);
  assert.equal(refreshed.measures,exercise.measures);
  assert.deepEqual(plain(exercise),before);
  assert.deepEqual(plain(refreshed.expressionSpans.filter(span=>span.kind!=='slur')),before.expressionSpans.filter(span=>span.kind!=='slur'));
  assert.ok(refreshed.expressionSpans.some(span=>span.kind==='slur'));
  assert.equal(validExpressionSpans(refreshed.expressionSpans,refreshed),true);
  const previous=createPlaybackEvents(exercise,90),next=createPlaybackEvents(refreshed,90);
  assert.equal(next.duration,previous.duration);
  assert.deepEqual(next.events.map(event=>[event.note,event.time]),previous.events.map(event=>[event.note,event.time]));
  assert.equal(refreshed.tempo,exercise.tempo);
  assert.deepEqual(plain(refreshSlurPhrasing(refreshed)),plain(refreshed),'reopening twice is stable');
});

test('legacy, unmarked and explicitly disabled exercises keep their saved expression exactly',()=>{
  const exercise=source();
  assert.equal(refreshSlurPhrasing(exercise,false),exercise);
  const legacy={...exercise,phrasePlan:undefined};assert.equal(refreshSlurPhrasing(legacy),legacy);
  const withoutSlurs={...exercise,expressionSpans:exercise.expressionSpans.filter(span=>span.kind!=='slur')};
  assert.equal(refreshSlurPhrasing(withoutSlurs),withoutSlurs);
});

test('correct slurs interleaved with a hairpin preserve the saved object, span order and source',()=>{
  const exercise=source();
  exercise.measures=[...exercise.measures,...source().measures];
  exercise.phrasePlan=[...exercise.phrasePlan,...exercise.phrasePlan.map(phrase=>({...phrase,
    startBar:phrase.startBar+4,endBar:phrase.endBar+4}))];
  const slurs=planMusicalSlurs(exercise,0),hairpin=exercise.expressionSpans[0];
  assert.ok(slurs.length>=2,'the regression includes a hairpin between two correct slurs');
  exercise.expressionSpans=[slurs[0],hairpin,...slurs.slice(1)];
  const spans=exercise.expressionSpans,before=JSON.stringify(exercise);
  const freeze=value=>{
    if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}
  };
  freeze(exercise);
  assert.equal(refreshSlurPhrasing(exercise),exercise);
  assert.equal(exercise.expressionSpans,spans);
  assert.equal(exercise.expressionSpans[1],hairpin);
  assert.equal(JSON.stringify(exercise),before);
  assert.equal(refreshSlurPhrasing(exercise),exercise,'repeated restore keeps the same saved reference');
});

test('a saved lower-staff slur stays on the lower staff when its phrasing is refreshed',()=>{
  const exercise=source();
  exercise.lowerMeasures=exercise.measures;
  exercise.expressionSpans=exercise.expressionSpans.map(span=>({...span,staff:1}));
  const refreshed=refreshSlurPhrasing(exercise);
  const slurs=refreshed.expressionSpans.filter(span=>span.kind==='slur');
  assert.ok(slurs.length);
  assert.ok(slurs.every(span=>span.staff===1));
  assert.equal(refreshed.lowerMeasures,exercise.lowerMeasures);
  assert.equal(refreshed.measures,exercise.measures);
});
