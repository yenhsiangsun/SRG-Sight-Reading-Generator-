import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

const {assess}=loadModule('src/assessment/scoring.ts');
const {translate,locales}=loadModule('src/i18n/messages.ts');
const exercise={instrument:'Sheng',soundProfile:'Sheng',timeSignature:'4/4',measures:[{totalUnits:16,events:Array.from({length:4},(_,i)=>({key:'c/4',midi:60,rest:false,durationUnits:4,startUnits:i*4}))}]};
const tone=(at,length,midi=60,envelope=()=>.2)=>Array.from({length:Math.round(length/.01)},(_,i)=>({time:at+i*.01,midi,confidence:.99,rms:envelope(i)}));
const performance=(length,decorate=frames=>frames)=>Array.from({length:4},(_,i)=>decorate(tone(i+.01,length),i)).flat();
const articulated=articulation=>({...exercise,measures:exercise.measures.map(bar=>({...bar,events:bar.events.map(note=>({...note,articulation}))}))});

test('50 ms blips do not earn full rhythm or duration for quarter notes',()=>{
  const result=assess(exercise,60,performance(.06));
  assert.equal(result.reliable,true);
  assert.equal(result.pitch,100);assert.equal(result.completion,100);
  assert.equal(result.duration,0);assert.equal(result.rhythm,0);
  assert.equal(result.extraNotes,0);
  assert.ok(result.notes.every(note=>!note.duration));
});

test('a normal sustained performance retains full marks and tolerates calibration',()=>{
  const observations=performance(.88);
  for(const result of [assess(exercise,60,observations),assess(exercise,60,observations.map(frame=>({...frame,time:frame.time+.13})),130)]){
    assert.equal(result.pitch,100);assert.equal(result.rhythm,100);
    assert.equal(result.duration,100);assert.equal(result.extraNotes,0);
  }
});

test('staccato has a shorter target while tenuto still requires sustained sound',()=>{
  const short=performance(.38);
  assert.equal(assess(articulated('staccato'),60,short).duration,100);
  assert.equal(assess(articulated('staccato'),60,short).rhythm,100);
  assert.equal(assess(articulated('tenuto'),60,short).duration,0);
  assert.equal(assess(articulated('tenuto'),60,performance(.9)).duration,100);
});

test('plucked and struck instruments allow natural decay without accepting blips',()=>{
  const decay=Array.from({length:4},(_,i)=>tone(i+.01,.22,60,index=>.2*Math.exp(-index/7))).flat();
  for(const soundProfile of ['Pipa','Guitar','Liuqin','Guzheng','Piano','Yangqin']){
    const selected={...exercise,soundProfile};
    const result=assess(selected,60,decay);
    assert.equal(result.decayAllowance,true,soundProfile);
    assert.equal(result.duration,100,soundProfile);assert.equal(result.rhythm,100,soundProfile);
    assert.equal(assess(selected,60,performance(.06)).duration,0,soundProfile);
  }
  assert.equal(assess(exercise,60,decay).duration,0);
});

test('wrong notes inserted between written attacks are counted and reduce rhythm',()=>{
  const result=assess(exercise,60,performance(.06,(frames,i)=>[...frames,...tone(i+.5,.06,62)]));
  assert.equal(result.pitch,100);
  assert.equal(result.extraNotes,4);
  assert.ok(result.rhythm<100);assert.ok(result.duration<100);
});

test('an extra attack in a written rest lowers rhythm even when every written note is correct',()=>{
  const withRests={...exercise,measures:[{totalUnits:16,events:exercise.measures[0].events.map((note,i)=>({...note,rest:i%2===1}))}]};
  const correct=[...tone(.01,.9),...tone(2.01,.9)];
  const clean=assess(withRests,60,correct);
  const extra=assess(withRests,60,[...correct,...tone(1.4,.15,62)]);
  assert.equal(clean.rhythm,100);assert.equal(clean.duration,100);
  assert.equal(extra.duration,100);assert.equal(extra.extraNotes,1);
  assert.equal(extra.rhythm,67);
});

test('gentle vibrato is not scored as extra attacks',()=>{
  const observations=performance(.9,frames=>frames.map(frame=>({...frame,midi:60+Math.sin(frame.time*2*Math.PI*5.5)*.2,rms:.2+Math.sin(frame.time*2*Math.PI*4)*.015})));
  const result=assess(exercise,60,observations);
  assert.equal(result.extraNotes,0);assert.equal(result.rhythm,100);
});

test('isolated frame clusters do not count the intervening silence as sustain',()=>{
  const observations=Array.from({length:4},(_,i)=>[...tone(i+.01,.04),...tone(i+.91,.04)]).flat();
  assert.equal(assess(exercise,60,observations).duration,0);
});

test('pre-roll and post-score sounds are excluded from extra attack counts',()=>{
  const observations=[...tone(-.15,.05,84),...performance(.88),...tone(4.15,.1,62)];
  const result=assess(exercise,60,observations);
  assert.equal(result.extraNotes,0);assert.equal(result.rhythm,100);
});

test('duration and extra-attack feedback is localized in every supported language',()=>{
  for(const locale of locales)for(const key of ['durationScore','extraNotes','assessmentTimingHelp','assessmentDecayHelp']){
    assert.ok(translate(locale,key)?.length,`${locale}/${key}`);
  }
});
