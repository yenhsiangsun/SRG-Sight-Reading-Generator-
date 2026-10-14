import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

const settings={instrument:'Flute',clef:'treble',difficulty:'Intermediate',keySignature:'C',tonic:'C',scaleId:'major',
  timeSignature:'4/4',rhythmLevel:'Moderate',measureCount:4,rangeMinMidi:60,rangeMaxMidi:84,
  allowAccidentals:false,mixedMeters:false,meters:['4/4','6/8']};
const study=tag=>({tag,instrument:'Flute',clef:'treble',difficulty:'intermediate',keySignature:'C',timeSignature:'4/4',
  rhythmLevel:'medium',tempo:80,tonality:{tonic:'C',scaleId:'major',signature:'C',notes:['C','D','E','F','G','A','B']},
  measures:Array.from({length:4},()=>({timeSignature:'4/4',totalUnits:16,groups:[4,4,4,4],beamGroups:[4,4,4,4],
    events:[60,62,64,60].map((midi,i)=>({midi,key:({60:'c/4',62:'d/4',64:'e/4'})[midi],octave:4,rest:false,
      duration:'q',dots:0,startUnits:i*4,durationUnits:4}))}))});

function harness(queue) {
  let states=[],cursor=0,generated=0;const remembered=[];
  const react={useState(initial){const index=cursor++;if(!(index in states))states[index]=typeof initial==='function'?initial():initial;
    return [states[index],next=>{states[index]=typeof next==='function'?next(states[index]):next;}];}};
  const api=loadModule('src/hooks/useExercise.ts',331,undefined,{react,
    '../music/composeExercise':{composeExercise(){const tag=queue[generated++]??'A';if(tag==='error')throw Error('retry unavailable');return study(tag);}},
    '../music/instrumentHarmony':{addInstrumentHarmony:ex=>ex},
    '../music/performanceMarks':{addPerformanceMarks:ex=>ex},
    '../music/pipaTechniques':{addPipaTechniques:ex=>ex},
    '../music/randomTonality':{selectRandomTonality:()=>({tonic:'C',scaleId:'major'})},
    '../practice/tempo':{selectPracticeTempo:()=>80},
    '../practice/recentVariety':{
      readRecentExercises:()=>[],
      scoreRecentSimilarity:(ex,history)=>history.some(previous=>previous.tag===ex.tag)?1:0,
      rememberRecentExercise(ex,_settings,history){remembered.push(ex.tag);return [{tag:ex.tag},...history].slice(0,5);},
    },
  },{window:{matchMedia:()=>({matches:false})}});
  return {render(preview){cursor=0;return api.useExercise(preview);},remembered,get generated(){return generated;}};
}

test('the generation hook auditions only close repeats, remembers only the accepted score and keeps resume neutral',()=>{
  const h=harness(['A','A','B','A','A','A']);
  assert.equal(h.render().generateFrom(settings,80),80);
  assert.equal(h.generated,1);
  const original=h.render().current.exercise;
  h.render().generateFrom(settings,80);
  assert.equal(h.generated,3);
  assert.equal(h.render().current.exercise.tag,'B');
  assert.deepEqual(h.remembered,['A','B']);
  h.render().restore(original,settings);
  assert.deepEqual(h.remembered,['A','B']);
  h.render().generateFrom(settings,80);
  assert.equal(h.generated,6,'never more than three complete candidates');
  assert.deepEqual(h.remembered,['A','B','A']);
});

test('a failed optional diversity candidate preserves the valid first score and normal generation can continue',()=>{
  const h=harness(['A','A','error','error']);
  h.render().generateFrom(settings,80);
  assert.equal(h.render().generateFrom(settings,80),80);
  assert.equal(h.generated,4);
  assert.equal(h.render().error,'');
  assert.equal(h.render().current.exercise.tag,'A');
  assert.deepEqual(h.remembered,['A','A']);
});

test('tonality previews do not enter recent history and explicit preset tempos remain exact',()=>{
  const h=harness(['A','B']),preview={tonic:'C',scaleId:'major'};
  assert.equal(h.render(preview).generateFrom(settings,80,160),160);
  assert.equal(h.generated,1);
  assert.deepEqual(h.remembered,[]);
  assert.equal(h.render(preview).current.isPreview,true);
  assert.equal(h.render(preview).generateFrom(settings,80,320),320);
  assert.deepEqual(h.remembered,['B']);
  assert.equal(h.render(preview).current.isPreview,false);
});
