import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

const {createPlaybackEvents,createMetronomeEvents,PlaybackController}=loadModule('src/audio/PlaybackController.ts');
const {forMonophonicAssessment,midiFromKey}=loadModule('src/music/notePitches.ts');
const {validStudy,readLibrary}=loadModule('src/practice/library.ts');
const plain=value=>JSON.parse(JSON.stringify(value));
const bar=(keys)=>({totalUnits:16,timeSignature:'4/4',groups:[4,4,4,4],beamGroups:[4,4,4,4],events:keys.map((key,event)=>({
  key,octave:Number(key.split('/')[1]),midi:midiFromKey(key),rest:false,duration:'q',dots:0,startUnits:event*4,durationUnits:4,
}))});
const spans=[{kind:'slur',staff:0,start:{bar:0,event:1},end:{bar:1,event:1}},
  {kind:'crescendo',staff:0,start:{bar:0,event:0},end:{bar:1,event:2}}];
const exercise={soundProfile:'Violin',timeSignature:'4/4',clef:'treble',keySignature:'C',difficulty:'intermediate',rhythmLevel:'medium',tempo:60,
  measures:[bar(['c/4','d/4','e/4','f/4']),bar(['g/4','a/4','g/4','c/4'])],expressionSpans:spans};

test('slurs and hairpins preserve pitches, score times, rests, total length and click alignment',()=>{
  const base={...exercise,expressionSpans:undefined};
  const before=createPlaybackEvents(base,60),after=createPlaybackEvents(exercise,60);
  assert.equal(after.duration,before.duration);
  assert.deepEqual(plain(after.events.map(({note,time})=>({note,time}))),plain(before.events.map(({note,time})=>({note,time}))));
  assert.deepEqual(plain(createMetronomeEvents(exercise,60)),plain(createMetronomeEvents(base,60)));
  assert.ok(after.events[6].velocity/before.events[6].velocity>1.17);
  assert.ok(Math.abs(after.events[7].velocity/before.events[7].velocity-1.18)<1e-8,'arrival strength remains after the hairpin');
  assert.ok(Math.abs(after.events[0].velocity/before.events[0].velocity-1)<1e-8);
  assert.equal(after.events[1].duration,1);assert.equal(after.events[4].duration,1);
  assert.equal(after.events[5].duration,.95,'final slurred note keeps its release');
  assert.ok(after.events.every(note=>note.velocity>0&&note.velocity<=1));
});

test('an explicit dynamic replaces held hairpin strength without shifting the next attack',()=>{
  const ex=plain(exercise);ex.measures[1].events[3].dynamic='p';
  const base={...ex,expressionSpans:undefined},actual=createPlaybackEvents(ex,60).events,before=createPlaybackEvents(base,60).events;
  assert.equal(actual[7].velocity,before[7].velocity);assert.equal(actual[7].time,7);
});

test('staccato wins over legato, diminuendo affects only its staff, and assessment keeps event addresses',()=>{
  const ex=plain(exercise);ex.lowerMeasures=[bar(['c/3','g/3','c/3','g/3']),bar(['c/3','g/3','c/3','g/3'])];ex.grandMode='mono';
  ex.expressionSpans=[{kind:'slur',staff:0,start:{bar:0,event:0},end:{bar:0,event:3}},
    {kind:'diminuendo',staff:1,start:{bar:0,event:0},end:{bar:1,event:2}}];
  ex.measures[0].events[1].articulation='staccato';
  ex.measures[0].events[0].chord=['c/4','e/4'].map(key=>({key,octave:Number(key.split('/')[1]),midi:midiFromKey(key)}));
  const mono=forMonophonicAssessment(ex),base={...mono,expressionSpans:undefined};
  assert.deepEqual(plain(mono.expressionSpans),ex.expressionSpans);
  assert.equal(mono.measures[0].events.length,ex.measures[0].events.length);assert.equal(mono.measures[0].events[0].chord,undefined);
  const events=createPlaybackEvents(mono,60).events,before=createPlaybackEvents(base,60).events;
  assert.equal(events.find(note=>note.note==='d4').duration,.5);
  const last=events.find(note=>note.note==='c3'&&note.time===6),old=before.find(note=>note.note==='c3'&&note.time===6);
  assert.ok(Math.abs(last.velocity/old.velocity-.82)<1e-8);
  assert.deepEqual(plain(events.filter(note=>note.note.endsWith('4')).map(note=>note.velocity)),plain(before.filter(note=>note.note.endsWith('4')).map(note=>note.velocity)));
});

test('saved expression metadata round-trips, old scores remain valid, and broken anchors or crossing-rest slurs are rejected',()=>{
  const settings={instrument:'Violin',clef:'treble',difficulty:'Intermediate',rhythmLevel:'Moderate',keySignature:'C',tonic:'C',scaleId:'major',
    timeSignature:'4/4',measureCount:2,rangeMinMidi:60,rangeMaxMidi:84,allowAccidentals:false,mixedMeters:false,meters:['4/4','6/8']};
  const study={id:'expression',created:1,bpm:60,settings,exercise:plain(exercise)};
  study.exercise.phrasePlan=[{startBar:0,endBar:1,role:'closing'}];
  assert.ok(validStudy(study,true));
  assert.deepEqual(plain(readLibrary(JSON.stringify({version:1,scores:[study],presets:[]})).scores[0]),study);
  const legacy=plain(study);delete legacy.exercise.expressionSpans;delete legacy.exercise.phrasePlan;assert.ok(validStudy(legacy,true));
  const invalid=[[{...spans[0],staff:1}],[{...spans[0],end:{bar:9,event:0}}],[{...spans[0],end:{bar:0,event:0}}],
    [{...spans[0],kind:'tie'}],[{...spans[0],start:{bar:0,event:.5}}]];
  for (const expressionSpans of invalid) assert.equal(validStudy({...study,exercise:{...study.exercise,expressionSpans}},true),false);
  const rested=plain(study);rested.exercise.measures[0].events[2].rest=true;assert.equal(validStudy(rested,true),false);
  const badPhrase=plain(study);badPhrase.exercise.phrasePlan[0].startBar=1;assert.equal(validStudy(badPhrase,true),false);
});

test('seeking and looping inside hairpins use the same expression strength and trim only sounding tails',async()=>{
  const played=[],scheduled=[];
  const synth={triggerAttackRelease:(...event)=>played.push(event),releaseAll(){},dispose(){}};
  const audio={unlock:async()=>{},createSynth:()=>synth,setTempo(){},setLoop(){},stop(){scheduled.length=0;},start(){},pause(){},clear(){},
    schedule:(callback,time)=>{scheduled.push({callback,time});return scheduled.length;},scheduleEnd:()=>0};
  const controller=new PlaybackController(audio,()=>{}),events=createPlaybackEvents(exercise,60).events;
  await controller.seek(exercise,60,4.5);await controller.play(exercise,60);
  scheduled.find(event=>event.time===0).callback(0);
  assert.deepEqual(played[0],['g4',.5,0,events[4].velocity]);
  played.length=0;await controller.playLoop(exercise,60,2,2);
  scheduled.find(event=>event.time===4).callback(4);
  assert.deepEqual(played[0],['g4',1,4,events[4].velocity]);
  controller.stop();
});
