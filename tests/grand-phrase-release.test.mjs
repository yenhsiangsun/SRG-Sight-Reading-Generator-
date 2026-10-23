import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';
const plain=x=>JSON.parse(JSON.stringify(x));
const {settleGrandPhraseRhythm}=loadModule('src/music/grandPhraseRelease.ts');
const note=(startUnits,durationUnits,rest=false)=>({startUnits,durationUnits,rest,midi:rest?undefined:48,key:'c/3',octave:3,duration:durationUnits===8?'h':durationUnits===4?'q':'8',dots:0});
const bar=events=>({timeSignature:'4/4',totalUnits:16,groups:[4,4,4,4],beamGroups:[4,4,4,4],events});
function fixture(){return {grandMode:'two-hand',timeSignature:'4/4',musicalIntent:{phrases:[{startBar:0,endBar:1}]},
  measures:[bar([note(0,8),note(8,8)]),bar([note(0,8),note(8,4),note(12,4,true)])],
  lowerMeasures:[bar(Array.from({length:8},(_,i)=>note(i*2,2))),bar(Array.from({length:8},(_,i)=>note(i*2,2)))]};}

test('the bass shares an existing phrase-end arrival and breath without changing the lead or earlier figures',()=>{
  const source=fixture(),before=JSON.stringify(source),result=settleGrandPhraseRhythm(source);
  assert.equal(JSON.stringify(source),before);assert.equal(result.measures,source.measures);
  assert.equal(result.lowerMeasures[0],source.lowerMeasures[0],'a sustained note outside a phrase end does not freeze the accompaniment');
  assert.deepEqual(plain(result.lowerMeasures[1].events.filter(n=>n.startUnits>=8).map(n=>[n.startUnits,n.durationUnits,n.rest])),[[8,4,false],[12,2,true],[14,2,true]]);
  assert.ok(result.lowerMeasures[1].events.filter(n=>n.rest).every(n=>n.midi===undefined));
  assert.equal(result.musicalIntent,source.musicalIntent,'no new harmonic cadence is substituted');
});

test('an already spacious closing, legacy score and monophonic transfer retain their exact objects',()=>{
  const source=fixture();source.lowerMeasures[1]=bar([note(0,8),note(8,4),note(12,4,true)]);
  for(const input of [source,{...source,grandMode:'mono'},{...source,musicalIntent:undefined},{...source,lowerMeasures:undefined}])
    assert.equal(settleGrandPhraseRhythm(input),input);
});

test('a held note starting off the main pulse keeps the independent bass figure',()=>{
  const source=fixture();source.timeSignature='3/4';source.musicalIntent.phrases=[{startBar:0,endBar:0}];
  const triple=events=>({...bar(events),timeSignature:'3/4',totalUnits:12,groups:[4,4,4],beamGroups:[4,4,4]});
  source.measures=[triple([note(0,2),note(2,4),{...note(6,6),duration:'q',dots:1}])];
  source.lowerMeasures=[triple([note(0,4),note(4,4),note(8,4)])];
  assert.equal(settleGrandPhraseRhythm(source),source);
});

test('the retained B87 pipeline preserves its original half-cadence breath and melody',()=>{
  const base={compositionStyle:'classical',instrument:'Piano',instrumentProfile:'Piano',clef:'treble',keySignature:'C',tonic:'C',scaleId:'major',timeSignature:'4/4',rhythmLevel:'medium',measures:8,tempo:80,range:{min:48,max:84},allowAccidentals:false,mixedMeters:false,meters:['4/4']};
  const bridge=`export {composeIntentExercise as composeExercise} from './intentComposition';export {validateGeneratedExercise} from './exerciseQuality';export {coordinateGrandStaff} from './grandAccompaniment';`;
  for(const instrumentProfile of ['Piano','Yangqin'])for(const difficulty of ['beginner','intermediate','advanced']){
    const o={...base,instrumentProfile,difficulty};
    const reference=loadModule('src/music/__releaseReference.ts',95003,bridge,{'./grandPhraseRelease':{settleGrandPhraseRhythm:ex=>ex}}).composeExercise(o,'two-hand');
    const api=loadModule('src/music/__releaseNew.ts',95003,bridge),result=api.composeExercise(o,'two-hand');
    api.validateGeneratedExercise(result,o.range,false);
    assert.deepEqual(plain(result.measures),plain(reference.measures),'candidate selection and every melody note remain exact');
    assert.deepEqual(plain(result.harmonyPlan),plain(reference.harmonyPlan),'open answers and final tonic are retained');
    assert.deepEqual(plain(result.musicalIntent),plain(reference.musicalIntent));
    const endings=new Set(result.phrasePlan.map(p=>p.endBar));
    for(let b=0;b<8;b++)if(!endings.has(b))assert.deepEqual(plain(result.lowerMeasures[b].events.map(n=>[n.startUnits,n.durationUnits,n.rest])),plain(reference.lowerMeasures[b].events.map(n=>[n.startUnits,n.durationUnits,n.rest])));
    assert.ok(result.lowerMeasures[3].events.filter(n=>n.startUnits>=12).every(n=>n.rest),'both voices release at the half-cadence breath');
    assert.equal(result.lowerMeasures[7].events.at(-1).durationUnits,8,'the final bass supports the melody’s existing half-note landing');
    assert.deepEqual(plain(api.coordinateGrandStaff(result,o.range)),plain(result),'the later final-coordination pass does not undo the release');
  }
});

test('the adopted long line preserves its melody and supports the actual ending without a forced halfway breath',()=>{
  const base={compositionStyle:'auto',instrument:'Piano',clef:'treble',keySignature:'C',tonic:'C',scaleId:'major',timeSignature:'4/4',rhythmLevel:'medium',measures:8,tempo:80,range:{min:48,max:84},allowAccidentals:false,mixedMeters:false,meters:['4/4']};
  const bridge=`export {composeExercise} from './composeExercise';export {coordinateGrandStaff} from './grandAccompaniment';export {validateGeneratedExercise} from './exerciseQuality';`;
  for(const instrumentProfile of ['Piano','Yangqin']){
    const o={...base,instrumentProfile,difficulty:'intermediate'};
    const reference=loadModule('src/music/__longReleaseReference.ts',95003,bridge,{'./grandPhraseRelease':{settleGrandPhraseRhythm:ex=>ex}}).composeExercise(o,'two-hand');
    const api=loadModule('src/music/__longRelease.ts',95003,bridge),result=api.composeExercise(o,'two-hand');
    api.validateGeneratedExercise(result,o.range,false);
    assert.deepEqual(plain(result.measures),plain(reference.measures));
    assert.deepEqual(plain(result.harmonyPlan),plain(reference.harmonyPlan));
    assert.deepEqual(plain(result.lowerMeasures.slice(0,-1)),plain(reference.lowerMeasures.slice(0,-1)));
    assert.deepEqual(plain(result.phrasePlan.map(p=>[p.startBar,p.endBar])),[[0,7]]);
    const landing=result.measures.at(-1).events.filter(n=>!n.rest).at(-1),bass=result.lowerMeasures.at(-1).events.at(-1);
    assert.equal(bass.startUnits,landing.startUnits);assert.equal(bass.durationUnits,landing.durationUnits);
    assert.deepEqual(plain(api.coordinateGrandStaff(result,o.range)),plain(result));
  }
});
