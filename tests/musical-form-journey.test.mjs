import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

const plain=x=>JSON.parse(JSON.stringify(x));
const base={compositionStyle:'classical',instrument:'Sheng',instrumentProfile:'Sheng',clef:'treble',difficulty:'intermediate',keySignature:'C',tonic:'C',scaleId:'major',timeSignature:'4/4',rhythmLevel:'medium',measures:8,tempo:80,range:{min:60,max:84},allowAccidentals:false,mixedMeters:false,meters:['4/4']};
const bridge=`export {composeExercise} from './composeExercise';export {addInstrumentHarmony} from './instrumentHarmony';export {addPerformanceMarks} from './performanceMarks';export {validateGeneratedExercise} from './exerciseQuality';export {validMusicalIntent} from './musicalIntent';`;
const timing=bar=>plain(bar.notes.map(n=>[n.startUnits,n.units,n.rest]));

test('one grammar can present distinct complete journeys while retaining a home ending and exact meter',()=>{
  const api=loadModule('src/music/musicalIntent.ts');
  for(const grammar of ['classical','lyrical','pentatonic']){
    const forms=[];
    for(const value of [.1,.35,.6,.85]){
      const o={...base,compositionStyle:grammar,scaleId:grammar==='pentatonic'?'major-pentatonic':'major'};
      const plan=api.planMusicalIntent(o,()=>value);
      assert.ok(api.validMusicalIntent(plan,8));assert.equal(plan.phrases[0].startBar,0);
      assert.equal(plan.phrases.at(-1).endBar,7);assert.equal(plan.phrases.at(-1).cadence,'home');
      for(const bar of plan.rhythm)assert.equal(bar.notes.reduce((s,n)=>s+n.units,0),16);
      forms.push(plan.phrases.map(p=>p.endBar-p.startBar+1).join('+'));
    }
    assert.equal(new Set(forms).size,3,grammar+' should offer more than one predetermined form');
  }
});

test('a continuous sentence remembers its opening, develops density, and delays its actual release',()=>{
  const {planMusicalIntent}=loadModule('src/music/musicalIntent.ts');
  const plan=planMusicalIntent({...base,rhythmLevel:'complex'},()=>.6);
  assert.equal(plan.phrases.length,1,'no automatic halfway cadence in a single sentence');
  assert.ok(plan.phrases[0].peak>.5,'the longer sentence gathers toward a later high point');
  assert.deepEqual(timing(plan.rhythm[0]),timing(plan.rhythm[2]),'the two-bar theme returns before fragmentation');
  assert.deepEqual(timing(plan.rhythm[0]),timing(plan.rhythm[6]),'the opening returns before closure');
  assert.ok(plan.rhythm[4].notes.length>plan.rhythm[0].notes.length,'continuation gathers motion rather than uniform density');
  assert.ok(plan.rhythm[7].notes.length<plan.rhythm[4].notes.length,'the close broadens after the continuation');
  assert.ok(plan.rhythm.slice(0,7).every(b=>b.notes.every(n=>!n.rest)),'no artificial interior phrase-end rest');
});

test('new longer arcs remain legal and approach the cadence by step for bowed, sheng and two-staff instruments',()=>{
  for(const c of [
    {seed:89003,instrument:'Sheng',instrumentProfile:'Sheng',range:{min:60,max:84}},
    {seed:91009,instrument:'Erhu',instrumentProfile:'Erhu',range:{min:62,max:86}},
    {seed:89003,instrument:'Piano',instrumentProfile:'Piano',range:{min:48,max:84},grand:'two-hand'},
    {seed:91009,instrument:'Piano',instrumentProfile:'Yangqin',range:{min:48,max:84},grand:'two-hand'},
  ]){
    let rhythmicIdentity;
    for(const difficulty of ['beginner','intermediate','advanced']){
      const api=loadModule('src/music/__formJourney.ts',c.seed,bridge),o={...base,...c,difficulty};
      let exercise=api.composeExercise(o,c.grand);const core=plain(exercise.measures.map(b=>b.events.map(n=>[n.midi,n.startUnits,n.durationUnits,n.rest])));
      exercise=api.addInstrumentHarmony({...exercise,soundProfile:c.instrumentProfile},c.range);exercise=api.addPerformanceMarks(exercise);
      api.validateGeneratedExercise(exercise,c.range,false);assert.ok(api.validMusicalIntent(exercise.musicalIntent,8));
      assert.deepEqual(plain(exercise.measures.map(b=>b.events.map(n=>[n.midi,n.startUnits,n.durationUnits,n.rest]))),core);
      const timing=JSON.stringify(exercise.measures.map(b=>b.events.map(n=>[n.startUnits,n.durationUnits,n.rest])));
      rhythmicIdentity??=timing;assert.equal(timing,rhythmicIdentity,'pitch difficulty must not alter the planned timing');
      const notes=exercise.measures.flatMap(b=>b.events.filter(n=>!n.rest));
      assert.equal(notes.at(-1).midi%12,0);assert.ok(Math.abs(notes.at(-1).midi-notes.at(-2).midi)<=3);
      if(c.grand){assert.equal(exercise.lowerMeasures.length,8);assert.deepEqual(plain(exercise.harmonyPlan),plain(exercise.musicalIntent.harmony));}
    }
  }
});
