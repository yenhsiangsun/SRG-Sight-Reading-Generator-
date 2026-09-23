import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

const {composeExercise}=loadModule('src/music/composeExercise.ts',92361);
const {reviewExercise,validateGeneratedExercise,melodicVoice}=loadModule('src/music/exerciseQuality.ts');
const {TIME_SIGNATURES,generatePracticeExercise}=loadModule('src/music.ts',92361);
const {buildPitchMaterial,SCALES,pitchClass}=loadModule('src/music/scales.ts');
const {createPlaybackEvents}=loadModule('src/audio/PlaybackController.ts');
const {addInstrumentHarmony}=loadModule('src/music/instrumentHarmony.ts',3181);
const {canPlayShengChord}=loadModule('src/music/shengFingering.ts');
const {pipaDoubleStopFingering}=loadModule('src/music/pipaFingering.ts');
const {pulseGroups}=loadModule('src/music/meterFeel.ts');
const base={instrument:'Sheng',clef:'treble',difficulty:'intermediate',keySignature:'C',timeSignature:'4/4',rhythmLevel:'medium',
  measures:8,tempo:90,range:{min:55,max:88},allowAccidentals:false,mixedMeters:true,meters:['4/4','6/8'],tonic:'C',scaleId:'major'};
const plain=x=>JSON.parse(JSON.stringify(x));
const sounded=ex=>melodicVoice(ex).flatMap(m=>m.events).filter(n=>!n.rest);
const rhythm=ex=>JSON.stringify([ex.measures,ex.lowerMeasures??[]].map(staff=>staff.map(m=>({meter:m.timeSignature,
  events:m.events.map(n=>[n.startUnits,n.durationUnits,n.duration,n.dots,n.rest,n.tuplet])}))));

test('phrase endings sustain to the barline in every meter, grade and rhythm level, including short studies',()=>{
  for(const timeSignature of Object.keys(TIME_SIGNATURES))for(const difficulty of ['beginner','intermediate','advanced'])
    for(const rhythmLevel of ['simple','medium','complex'])for(const measures of [1,2,8]) {
      const ex=composeExercise({...base,timeSignature,difficulty,rhythmLevel,measures,mixedMeters:false});
      validateGeneratedExercise(ex,base.range,false);
      const bar=ex.measures.at(-1),last=bar.events.at(-1),notes=sounded(ex);
      assert.equal(last.rest,false);
      assert.ok(last.durationUnits>=4);
      assert.equal(last.startUnits+last.durationUnits,bar.totalUnits);
      assert.equal(notes.at(-1).midi%12,0,'a reachable modal tonic has time to settle');
      const starts=[0];for(const units of pulseGroups(bar))starts.push(starts.at(-1)+units);
      assert.ok(timeSignature==='3/8'?last.startUnits===2:starts.includes(last.startUnits),'landing follows this meter');
    }
});

test('candidate selection keeps rhythm difficulty independent from pitch grade and chromatic switches',()=>{
  for(const grandMode of [undefined,'two-hand'])for(const seed of [729,1821,6119]) {
    const options={...base,range:{min:48,max:84},rhythmLevel:'complex'};
    const expected=loadModule('src/music/composeExercise.ts',seed).composeExercise(options,grandMode);
    for(const difficulty of ['beginner','intermediate','advanced'])for(const allowAccidentals of [false,true]) {
      const actual=loadModule('src/music/composeExercise.ts',seed).composeExercise({...options,difficulty,allowAccidentals},grandMode);
      assert.equal(rhythm(actual),rhythm(expected));
    }
  }
});

test('all scale families and custom ranges remain legal through the actual composition pipeline',()=>{
  for(const {id:scaleId} of SCALES)for(const range of [{min:55,max:88},{min:62,max:65}]) {
    const ex=composeExercise({...base,scaleId,range,measures:4});
    validateGeneratedExercise(ex,range,false);
    const pitches=buildPitchMaterial(ex.tonality,range).pitches;
    const root=ex.tonality.tonic===null?null:pitchClass(ex.tonality.tonic);
    if(root!==null&&pitches.some(p=>p.midi%12===root))assert.equal(sounded(ex).at(-1).midi%12,root);
  }
  for(const allowAccidentals of [false,true]) {
    const ex=composeExercise({...base,scaleId:'atonal',difficulty:'advanced',allowAccidentals});
    assert.equal(ex.tonality.signature,null);
    assert.ok(new Set(sounded(ex).map(n=>n.midi%12)).size>=8,'atonal material is not forced into a tonal cadence');
  }
});

test('grand voices, physical harmony and playback share the complete planned ending',()=>{
  for(const [instrument,grandMode,range] of [['Piano','two-hand',{min:36,max:84}],['Sheng','mono',base.range],['Pipa',undefined,{min:45,max:88}]]) {
    const ex=composeExercise({...base,instrument:instrument==='Pipa'?'Sheng':instrument,range,difficulty:'advanced',rhythmLevel:'complex'},grandMode);
    ex.soundProfile=instrument;
    const harmony=addInstrumentHarmony(ex,range);
    for(const bar of [...harmony.measures,...harmony.lowerMeasures??[]])for(const n of bar.events)if(n.chord) {
      if(instrument==='Sheng')assert.equal(canPlayShengChord(n.chord.map(p=>p.midi)),true);
      if(instrument==='Pipa')assert.ok(pipaDoubleStopFingering(n.chord));
    }
    const voice=melodicVoice(harmony),last=voice.at(-1).events.at(-1);
    assert.ok(!last.rest&&last.durationUnits>=4);
    const playback=createPlaybackEvents(harmony,90);
    const expected=ex.measures.reduce((s,m)=>s+m.totalUnits,0)*60/90/4;
    const actual=Math.max(...playback.events.map(n=>n.time+n.duration));
    assert.ok(Math.abs(playback.duration-expected)<1e-8);
    assert.ok(Math.abs(actual-expected)<1e-8);
    if(grandMode==='two-hand') {
      assert.ok(!harmony.lowerMeasures.at(-1).events.at(-1).rest);
      assert.notEqual(rhythm({...ex,lowerMeasures:undefined}),rhythm({...ex,measures:ex.lowerMeasures,lowerMeasures:undefined}),'hands retain independent rhythms');
    }
  }
});

function fixture(patterns) {
  return {...generatePracticeExercise({...base,measures:patterns.length,mixedMeters:false,range:{min:48,max:84}}),
    measures:patterns.map(pitches=>({timeSignature:'4/4',totalUnits:16,groups:[4,4,4,4],beamGroups:[4,4,4,4],
      events:pitches.map((midi,i)=>({midi,key:['c','c#','d','d#','e','f','f#','g','g#','a','a#','b'][midi%12]+'/'+(Math.floor(midi/12)-1),
        octave:Math.floor(midi/12)-1,rest:false,duration:'q',dots:0,startUnits:i*4,durationUnits:4}))}))};
}

test('quality review identifies local excess without penalizing ordinary pulses or all advanced leaps',()=>{
  const repeated=fixture([[60,60,60,60],[60,60,60,60]]),before=JSON.stringify(repeated);
  const varied=fixture([[60,64,67,65],[64,62,59,60]]);
  assert.ok(reviewExercise(repeated,base.range,false).penalty>reviewExercise(varied,base.range,false).penalty);
  assert.equal(JSON.stringify(repeated),before);
  const advanced={...fixture([[48,72,74,50],[52,76,74,60]]),difficulty:'advanced'};
  assert.equal(reviewExercise(advanced,{min:48,max:84},false).penalty,0,'isolated wide leaps are valid challenges');
  assert.throws(()=>validateGeneratedExercise({...varied,measures:[{...varied.measures[0],totalUnits:15}]},base.range,false));
});

test('bounded candidate review selects a better legal score, keeps its rhythm, and rejects malformed candidates',()=>{
  const repeated=fixture([[60,60,60,60],[60,60,60,60]]),good=fixture([[60,64,67,65],[64,62,59,60]]);
  const malformed=plain(good);malformed.measures[0].events[0].durationUnits=3;
  const candidates=[malformed,repeated,good];let calls=0;
  const plan={shared:'plan'};
  const api=loadModule('src/music/composeExercise.ts',1,undefined,{
    '../music':{createPracticeRhythmPlan:()=>plan,generatePracticeExercise:(_options,received)=>{
      assert.equal(received,plan);return candidates[calls++];
    }},
    './modalPhrasing':{addModalPhrasing:x=>x},
  });
  const result=api.composeExercise({...base,measures:2});
  assert.equal(result,good);assert.equal(calls,3);
  assert.equal(rhythm(result),rhythm(repeated));
});
