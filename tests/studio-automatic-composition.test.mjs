import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

function session(seed=75001){
  const values=[],memory=new Map();let cursor=0;
  const react={useState(initial){const i=cursor++;if(!(i in values))values[i]=typeof initial==='function'?initial():initial;
    return [values[i],next=>{values[i]=typeof next==='function'?next(values[i]):next;}];}};
  const api=loadModule('src/hooks/useExercise.ts',seed,undefined,{react},{window:{matchMedia:()=>({matches:false})},localStorage:{getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,String(v))}});
  return {render(){cursor=0;return api.useExercise();},memory};
}

test('six successive studies keep the same user challenge while varying complete form and rhythm',()=>{
  const s=session(),first=s.render();
  const settings={...first.settings,instrument:'Piano',clef:'grand',difficulty:'Intermediate',rhythmLevel:'Moderate',rangeMinMidi:48,rangeMaxMidi:84,allowedKeySignatures:['C'],compositionStyle:'legacy'};
  const studies=[];
  for(let i=0;i<6;i++){
    assert.equal(s.render().generateFrom(settings,80,80),80);
    const current=s.render().current;assert.equal(current.settings.compositionStyle,'auto');
    assert.equal(current.settings.difficulty,'Intermediate');assert.equal(current.settings.rhythmLevel,'Moderate');
    assert.ok(current.exercise.musicalIntent);assert.equal(current.exercise.lowerMeasures.length,8);
    assert.equal(current.exercise.phrasePlan[0].startBar,0);assert.equal(current.exercise.phrasePlan.at(-1).endBar,7);
    studies.push(current.exercise);
  }
  const rhythms=studies.map(ex=>JSON.stringify(ex.measures.map(b=>b.events.map(n=>[n.startUnits,n.durationUnits,n.rest]))));
  assert.ok(new Set(rhythms).size>=4,'the output must vary across the whole study');
  for(let i=1;i<rhythms.length;i++)assert.notEqual(rhythms[i],rhythms[i-1],'no identical adjacent whole-study rhythm in this representative session');
  assert.ok(new Set(studies.map(ex=>ex.musicalIntent.grammar)).size>=2,'the main pipeline must actually reach automatic grammar selection');
});

test('opening an existing score preserves its notes; only future new generation changes to automatic composition',()=>{
  const s=session(75003);const before=s.render();
  const settings={...before.settings,compositionStyle:'classical'};
  assert.notEqual(before.generateFrom(settings,80,80),false);
  const current=s.render().current,original=JSON.stringify(current.exercise.measures);
  const restored=s.render().restore(current.exercise,{...current.settings,compositionStyle:'legacy'});
  assert.equal(JSON.stringify(restored.measures),original);
  assert.notEqual(s.render().generateNew(80),false);
  assert.equal(s.render().current.settings.compositionStyle,'auto');
});
