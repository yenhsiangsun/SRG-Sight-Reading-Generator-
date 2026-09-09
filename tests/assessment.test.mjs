import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';
const {detectPitch}=loadModule('src/assessment/pitch.ts');
const {assess}=loadModule('src/assessment/scoring.ts');
const {translate,locales,messages}=loadModule('src/i18n/messages.ts');
const {INSTRUMENTS}=loadModule('src/music/instruments.ts');
const {getTimbreId,TIMBRES,createTimbrePreview}=loadModule('src/audio/timbres.ts');
const {createPlaybackEvents,PlaybackController}=loadModule('src/audio/PlaybackController.ts');
const exercise={timeSignature:'4/4',measures:[{totalUnits:16,events:[60,62,64,65].map((midi,i)=>({key:['c/4','d/4','e/4','f/4'][i],midi,rest:false,durationUnits:4}))}]};
const frames=(shift=0,pitchShift=0)=>Array.from({length:4},(_,i)=>Array.from({length:22},(_,j)=>({time:i+.03+j*.04+shift,midi:[60,62,64,65][i]+pitchShift,confidence:.99,rms:.2}))).flat();
test('pitch detection estimates fundamentals across the supported range and rejects silence/noise',()=>{
  for(const rate of [44100,48000])for(const midi of [36,43,48,60,69,81,90]){
    const frequency=440*2**((midi-69)/12);
    const samples=Float32Array.from({length:2048},(_,i)=>.3*Math.sin(2*Math.PI*frequency*i/rate)+.12*Math.sin(4*Math.PI*frequency*i/rate));
    const pitch=detectPitch(samples,rate);
    assert.ok(pitch&&Math.abs(pitch.midi-midi)<.15,`${rate} Hz, MIDI ${midi}: ${JSON.stringify(pitch)}`);
  }
  assert.equal(detectPitch(new Float32Array(2048),48000),null);
  let seed=9;const noise=Float32Array.from({length:2048},()=>{seed=(seed*1664525+1013904223)>>>0;return seed/2**32-.5;});
  assert.equal(detectPitch(noise,48000),null);
});
test('assessment distinguishes pitch mistakes, timing mistakes, missing notes and insufficient signal',()=>{
  const perfect=assess(exercise,60,frames());assert.equal(perfect.pitch,100);assert.equal(perfect.rhythm,100);assert.equal(perfect.completion,100);
  const wrongPitch=assess(exercise,60,frames(0,1));assert.equal(wrongPitch.pitch,0);assert.equal(wrongPitch.rhythm,100);
  const late=assess(exercise,60,frames(.22));assert.equal(late.pitch,100);assert.equal(late.rhythm,0);
  const compensated=assess(exercise,60,frames(.22),220);assert.equal(compensated.rhythm,100);
  const missing=assess(exercise,60,frames().filter(f=>f.time<2||f.time>3));assert.equal(missing.completion,75);
  assert.equal(assess(exercise,60,[]).reliable,false);
  assert.equal(assess(exercise,60,frames().map(f=>({...f,confidence:.2}))).reliable,false);
  assert.throws(()=>assess({...exercise,lowerMeasures:exercise.measures},60,frames()));
});
test('all instruments have a mapped timbre and previews stay in the selected written range',()=>{
  for(const [id,p] of Object.entries(INSTRUMENTS)){
    const timbre=getTimbreId(id);assert.ok(TIMBRES[timbre]);if(id!=='Piano')assert.notEqual(timbre,'piano',id);
    const preview=createTimbrePreview(id);assert.equal(preview.soundProfile,id);assert.equal(preview.transposition,p.transpose);
    for(const n of preview.measures[0].events)assert.ok(n.midi>=p.min&&n.midi<=p.max,id);
  }
  assert.equal(new Set(Object.values(TIMBRES).map(p=>JSON.stringify({...p,label:''}))).size,Object.keys(TIMBRES).length);
});
test('all interface messages have three nonempty translations',()=>{
  for(const key of Object.keys(messages))for(const locale of locales)assert.ok(translate(locale,key).length>0,locale+':'+key);
});
test('playback passes the saved instrument to the audio factory and disposes it on switching',async()=>{
  const created=[],disposed=[];let id=0;
  const player=new PlaybackController({unlock:async()=>{},createSynth:e=>{created.push(e.soundProfile);return {triggerAttackRelease(){},releaseAll(){},dispose(){disposed.push(e.soundProfile);}};},schedule:()=>id++,scheduleEnd:()=>id++,clear(){},start(){},pause(){},stop(){},setTempo(){}},()=>{});
  await player.play({...exercise,soundProfile:'Erhu'},60);
  await player.replay({...exercise,soundProfile:'Piano'},60);
  assert.deepEqual(created,['Erhu','Piano']);assert.deepEqual(disposed,['Erhu']);player.dispose();assert.deepEqual(disposed,['Erhu','Piano']);
});
test('six eighth notes at BPM 60 last six seconds and mixed-meter boundaries agree across hands',()=>{
  const six={timeSignature:'6/8',measures:[{timeSignature:'6/8',totalUnits:12,events:Array.from({length:6},()=>({key:'c/4',rest:false,durationUnits:2}))}]};
  assert.equal(createPlaybackEvents(six,60).duration,6);
  assert.deepEqual(Array.from(createPlaybackEvents(six,60).events,n=>n.time),[0,1,2,3,4,5]);
  const mixed={...six,measures:[...exercise.measures,...six.measures]};mixed.measures[0]={...mixed.measures[0],timeSignature:'4/4'};
  assert.equal(createPlaybackEvents(mixed,60).duration,10);
});
