import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {loadModule} from './helpers.mjs';

const fixtures=JSON.parse(fs.readFileSync(new URL('./fixtures/long-line-adoption.json',import.meta.url)));
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const plain=x=>JSON.parse(JSON.stringify(x));
const finish=`export {refineFastPassages} from './tempoFlow';export {coordinateGrandStaff} from './grandAccompaniment';export {addInstrumentHarmony} from './instrumentHarmony';export {addPerformanceMarks} from './performanceMarks';export {validateGeneratedExercise} from './exerciseQuality';`;

test('ordinary generation reproduces all four human-selected C core and completed audition samples exactly',()=>{
  for(const sample of fixtures.adopted){
    let exercise=loadModule('src/music/composeExercise.ts',sample.seed).composeExercise(sample.options,'two-hand');
    assert.equal(hash(exercise),sample.coreHash,sample.id+' selected C core');
    const api=loadModule('src/music/__longLineFinish.ts',sample.seed+50000,finish);
    exercise={...exercise,tempo:80,soundProfile:sample.instrument,staffMode:'fixed'};
    exercise=api.refineFastPassages(exercise,sample.options.range,sample.instrument,false);
    exercise=api.coordinateGrandStaff(exercise,sample.options.range,false,false);
    exercise=api.addInstrumentHarmony(exercise,sample.options.range);
    exercise=api.addPerformanceMarks(exercise);
    api.validateGeneratedExercise(exercise,sample.options.range,false);
    assert.equal(hash(exercise),sample.finalHash,sample.id+' same complete C score as audition');
  }
});

test('specialist, legacy, short and explicit strategy routes retain their complete pre-adoption output',()=>{
  for(const sample of fixtures.bypass){
    const exercise=loadModule('src/music/composeExercise.ts',sample.seed).composeExercise(sample.options,'two-hand');
    assert.equal(hash(exercise),sample.hash,JSON.stringify(sample.options));
  }
  const sample=fixtures.strategy;
  assert.equal(hash(loadModule('src/music/composeExercise.ts',sample.seed).composeExercise(sample.options,'two-hand',sample.strategy)),sample.hash);
});

test('the normal settings hook selects C without a new selector and preserves older saved exercises',()=>{
  const values=[],memory=new Map();let cursor=0;
  const react={useState(initial){const i=cursor++;if(!(i in values))values[i]=typeof initial==='function'?initial():initial;return[values[i],next=>{values[i]=typeof next==='function'?next(values[i]):next;}];}};
  const localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,String(v))};
  const api=loadModule('src/hooks/useExercise.ts',89519,undefined,{react},{localStorage,window:{matchMedia:()=>({matches:false})}});
  const render=()=>{cursor=0;return api.useExercise({tonic:'C',scaleId:'major'});};
  const state=render(),settings={...state.settings,instrument:'Piano',clef:'grand',difficulty:'Intermediate',rhythmLevel:'Moderate',rangeMinMidi:36,rangeMaxMidi:84};
  assert.equal(state.generateFrom(settings,80,80),80);
  const current=render().current;assert.ok(current);
  assert.equal(current.settings.compositionStyle,'auto');
  assert.deepEqual(plain(current.exercise.musicalIntent.motif),[0,1,3,5,3,1,0]);
  assert.deepEqual(plain(current.exercise.phrasePlan.map(p=>p.endBar-p.startBar+1)),[8]);
  assert.equal(current.exercise.measures[0].events[0].durationUnits,8);
  assert.equal(current.exercise.measures[0].events[0].rest,false);
  assert.ok(current.exercise.lowerMeasures.length===8);
  const saved=plain(current.exercise),before=JSON.stringify(saved);
  render().restore(saved,{...settings,compositionStyle:'classical'});
  // Restoring can refresh slurs, but it must never recompute pitch or rhythm.
  const notes=ex=>JSON.stringify([ex.measures,ex.lowerMeasures].map(s=>s.map(b=>b.events.map(n=>[n.midi,n.durationUnits,n.rest]))));
  assert.equal(notes(render().current.exercise),notes(JSON.parse(before)));
});
