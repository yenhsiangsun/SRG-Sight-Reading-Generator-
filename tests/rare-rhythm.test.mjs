import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';
const {addRareThirtySeconds}=loadModule('src/music/rareRhythm.ts');
const {composeExercise}=loadModule('src/music/composeExercise.ts',792);
const {validateGeneratedExercise,melodicVoice}=loadModule('src/music/exerciseQuality.ts');
const {createPlaybackEvents}=loadModule('src/audio/PlaybackController.ts');
const {validStudy}=loadModule('src/practice/library.ts');
const options={instrument:'Sheng',clef:'treble',difficulty:'intermediate',keySignature:'C',tonic:'C',scaleId:'major',
  timeSignature:'4/4',rhythmLevel:'medium',measures:8,tempo:80,range:{min:48,max:84},allowAccidentals:false,
  mixedMeters:false,meters:['4/4','6/8']};

test('rare subdivision is one aligned sounded group, preserves time and never alters dedicated drills',()=>{
  const plan=Array.from({length:4},()=>({meter:'4/4',notes:Array.from({length:8},(_,i)=>({duration:'8',dots:0,units:2,startUnits:i*2,rest:false}))}));
  const before=JSON.stringify(plan);
  for(const level of ['medium','complex']) {
    const result=addRareThirtySeconds(plan,level,'balanced',()=>0);
    const notes=result.flatMap(b=>b.notes),pair=notes.filter(n=>n.duration==='32');
    assert.equal(pair.length,4);assert.equal(pair[1].startUnits-pair[0].startUnits,.5);
    assert.ok(pair.every((n,i)=>!n.rest&&n.units===.5&&n.startUnits===pair[0].startUnits+i*.5));
    assert.equal(pair[0].startUnits%2,0);
    for(const bar of result)assert.equal(bar.notes.reduce((sum,n)=>sum+n.units,0),16);
    assert.equal(addRareThirtySeconds(plan,level,'balanced',()=>.99),plan);
    assert.equal(addRareThirtySeconds(plan,level,['sixteenths','dotted'],()=>0),plan);
  }
  assert.equal(addRareThirtySeconds(plan,'simple','balanced',()=>0),plan);
  assert.equal(JSON.stringify(plan),before);
  const sixteenths=[{meter:'6/8',notes:Array.from({length:12},(_,i)=>({duration:'16',dots:0,units:1,startUnits:i,rest:false}))}];
  const converted=addRareThirtySeconds(sixteenths,'complex','balanced',()=>0)[0].notes;
  assert.equal(converted.length,14);
  assert.equal(converted.filter(n=>n.duration==='32').length,4);
  assert.equal(converted[4].startUnits,2,'the following onset does not move');
  assert.equal(converted.reduce((sum,n)=>sum+n.units,0),12);
  assert.notEqual(addRareThirtySeconds(plan,'complex','balanced',()=>.25),plan,'complex now accepts a 25 percent draw');
  assert.equal(addRareThirtySeconds(plan,'medium','balanced',()=>.25),plan,'medium probability stays low');
});

test('actual medium and complex studies only occasionally contain one four-note group across both hands and save correctly',()=>{
  for(const rhythmLevel of ['simple','medium','complex']) {
    let count=0;
    for(let sample=0;sample<100;sample++) {
      const mode=sample%3===0?'two-hand':sample%3===1?'mono':undefined;
      const exercise=composeExercise({...options,rhythmLevel,mixedMeters:sample%2===0},mode);
      validateGeneratedExercise(exercise,options.range,false);
      const notes=melodicVoice(exercise).flatMap(b=>b.events).filter(n=>!n.rest);
      const pair=notes.filter(n=>n.duration==='32');
      assert.ok(pair.length===0||pair.length===4);
      if(mode==='two-hand')assert.ok(exercise.lowerMeasures.every(b=>b.events.every(n=>n.duration!=='32')));
      if(pair.length) {
        count++;
        const playback=createPlaybackEvents(exercise,80);
        assert.ok(playback.duration>0);
        const settings={instrument:'Sheng',clef:mode?'grand':'treble',difficulty:'Intermediate',keySignature:'C',tonic:'C',scaleId:'major',
          timeSignature:'4/4',rhythmLevel:rhythmLevel==='medium'?'Moderate':'Complex',measureCount:8,rangeMinMidi:48,rangeMaxMidi:84,allowAccidentals:false,mixedMeters:sample%2===0,meters:['4/4','6/8']};
        exercise.soundProfile='Sheng';
        assert.ok(validStudy({id:'test',created:1,bpm:80,settings,exercise},true),'saved scores accept the written 32nd value');
      }
    }
    if(rhythmLevel==='simple')assert.equal(count,0);
    else assert.ok(count>=4&&count<=(rhythmLevel==='medium'?30:45),`${rhythmLevel}: ${count}/100`);
  }
});
