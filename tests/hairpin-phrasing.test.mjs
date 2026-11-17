import test from 'node:test';import assert from 'node:assert/strict';import {loadModule} from './helpers.mjs';
const {planPhraseHairpins}=loadModule('src/music/hairpinPhrasing.ts');
const {addIntentExpression}=loadModule('src/music/intentExpression.ts');
const {validExpressionSpan,playbackExpressionPlan}=loadModule('src/music/expressionSpans.ts');
const phrase={startBar:0,endBar:7,role:'closing',cadence:'home',gesture:'present',peak:.5};
const plain=x=>JSON.parse(JSON.stringify(x));
function fixture(){
 const rows=[[79,77,76,74],[76,74,72,71],[72,71,69,67],[71,69,67,65],[69,67,65,64],[67,65,64,62],[67,65,64,64],[65,64,62,60]];
 return{instrument:'Piano',soundProfile:'Guitar',clef:'treble',difficulty:'intermediate',timeSignature:'4/4',keySignature:'C',tempo:90,
  phrasePlan:[phrase],musicalIntent:{grammar:'lyrical',phrases:[phrase]},measures:rows.map(pitches=>({timeSignature:'4/4',totalUnits:16,groups:[4,4,4,4],events:pitches.map((midi,i)=>({midi,key:['c','c#','d','d#','e','f','f#','g','g#','a','a#','b'][midi%12]+'/'+(Math.floor(midi/12)-1),octave:Math.floor(midi/12)-1,startUnits:i*4,durationUnits:4,duration:'q',dots:0,rest:false}))}))};
}
const time=(ex,a)=>ex.measures.slice(0,a.bar).reduce((s,b)=>s+b.totalUnits,0)+ex.measures[a.bar].events[a.event].startUnits;
const music=ex=>JSON.stringify(ex.measures.map(b=>b.events.map(n=>[n.midi,n.key,n.durationUnits,n.startUnits,n.rest,n.chord,n.technique])));

test('an early peak no longer generates a diminuendo through an entire eight-bar song',()=>{
 const source=fixture(),before=JSON.stringify(source),marked=addIntentExpression(source),hairpins=marked.expressionSpans.filter(s=>s.kind!=='slur');
 assert.equal(JSON.stringify(source),before);assert.equal(music(marked),music(source));
 assert.equal(hairpins.length,1);assert.equal(hairpins[0].kind,'diminuendo');
 assert.ok(hairpins[0].start.bar>=6);assert.equal(hairpins[0].end.bar,7);
 for(const span of hairpins){assert.ok(validExpressionSpan(span,marked));assert.ok(time(marked,span.end)-time(marked,span.start)<=24);assert.ok(span.end.bar-span.start.bar<=1);}
});

test('local hairpins have a real change, omit flat phrases and cannot run through silence or another dynamic',()=>{
 const flat=fixture();for(const bar of flat.measures)for(const n of bar.events)n.midi=60;
 assert.equal(planPhraseHairpins(flat,phrase).length,0);
 for(const dynamic of [false,true]){
  const ex=fixture();if(dynamic)ex.measures[7].events[0].dynamic='p';else ex.measures[7].events[0].rest=true;
  const spans=planPhraseHairpins(ex,phrase);
  for(const s of spans){
   for(let b=s.start.bar;b<=s.end.bar;b++)for(let e=0;e<ex.measures[b].events.length;e++){
    const at={bar:b,event:e},t=time(ex,at),n=ex.measures[b].events[e];
    if(t>time(ex,s.start)&&t<time(ex,s.end))assert.ok(!n.rest&&!n.dynamic);
   }
  }
 }
});

test('a bounded rise and closing release stay separate and compound meter uses actual elapsed pulses',()=>{
 const ex=fixture();ex.measures[3].events[2].midi=84;
 const spans=planPhraseHairpins(ex,phrase);assert.ok(spans.some(s=>s.kind==='crescendo'));assert.ok(spans.some(s=>s.kind==='diminuendo'));
 assert.ok(time(ex,spans[0].end)<=time(ex,spans[1].start));
 const compound=fixture();compound.timeSignature='6/8';
 for(const bar of compound.measures){bar.timeSignature='6/8';bar.totalUnits=12;bar.groups=[6,6];let start=0;bar.events.forEach((n,i)=>{const units=[4,2,2,4][i];n.startUnits=start;n.durationUnits=units;n.duration=units===4?'q':'8';start+=units;});}
 for(const s of planPhraseHairpins(compound,phrase)){assert.ok(validExpressionSpan(s,compound));assert.ok(time(compound,s.end)-time(compound,s.start)>=12);assert.ok(time(compound,s.end)-time(compound,s.start)<=24);}
});

test('legacy long hairpins remain valid musical data and expression never shifts the score clock',()=>{
 const old=fixture();old.expressionSpans=[{kind:'diminuendo',staff:0,start:{bar:0,event:0},end:{bar:7,event:3}}];
 assert.ok(validExpressionSpan(old.expressionSpans[0],old));
 const before=JSON.stringify(old),plan=playbackExpressionPlan(old);assert.equal(JSON.stringify(old),before);assert.ok(plan.size>0);
 const {createPlaybackEvents}=loadModule('src/audio/PlaybackController.ts'),current=addIntentExpression(fixture());
 const a=createPlaybackEvents({...current,expressionSpans:current.expressionSpans.filter(s=>s.kind==='slur')},90),b=createPlaybackEvents(current,90);
 assert.deepEqual(plain(a.events.map(n=>[n.note,n.time,n.duration])),plain(b.events.map(n=>[n.note,n.time,n.duration])));assert.equal(a.duration,b.duration);
});
