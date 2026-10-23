import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

const plain=value=>JSON.parse(JSON.stringify(value));
const base={compositionStyle:'auto',instrument:'Piano',instrumentProfile:'Piano',clef:'treble',difficulty:'intermediate',keySignature:'C',tonic:'C',scaleId:'major',timeSignature:'4/4',rhythmLevel:'complex',measures:8,tempo:80,range:{min:36,max:84},allowAccidentals:false,mixedMeters:false,meters:['4/4']};
const bridge=`export {composeExercise} from './composeExercise';export {composeIntentExercise} from './intentComposition';export {validateGeneratedExercise} from './exerciseQuality';export {coordinateGrandStaff} from './grandAccompaniment';export {addInstrumentHarmony} from './instrumentHarmony';export {refineFastPassages} from './tempoFlow';export {validMusicalIntent} from './musicalIntent';`;
const {planMusicalIntent,validMusicalIntent}=loadModule('src/music/musicalIntent.ts');
const {describeTonality,buildPitchMaterial}=loadModule('src/music/scales.ts');

test('the retained B87 composer varies same-key openings for the frozen comparison baseline',()=>{
  const starts=new Set(),directions=new Set(),contours=new Map(),rhythms=new Set();
  for(let i=0;i<24;i++){
    const api=loadModule('src/music/__openingTest.ts',87201+i,bridge);
    let exercise=api.composeIntentExercise(base,'two-hand');
    exercise=api.refineFastPassages(exercise,base.range,'Piano',false);
    exercise=api.coordinateGrandStaff(exercise,base.range,false,false);
    const lead=JSON.stringify(exercise.measures);
    exercise=api.addInstrumentHarmony({...exercise,soundProfile:'Piano'},base.range);
    assert.equal(JSON.stringify(exercise.measures),lead,'the corrected bass/chords preserve the new entrance');
    api.validateGeneratedExercise(exercise,base.range,false);
    const notes=exercise.measures.slice(0,2).flatMap(b=>b.events.filter(n=>!n.rest)),first=notes[0].midi;
    starts.add(first%12);directions.add(Math.sign((notes.find(n=>n.midi!==first)?.midi??first)-first));
    const contour=notes.slice(0,8).map(n=>n.midi-first).join(',');contours.set(contour,(contours.get(contour)??0)+1);
    rhythms.add(JSON.stringify(exercise.measures.slice(0,2).map(b=>b.events.map(n=>[n.durationUnits,n.rest,n.tuplet]))));
    assert.equal(exercise.measures.at(-1).events.filter(n=>!n.rest).at(-1).midi%12,0);
  }
  assert.equal(starts.size,3,'root, third and fifth can all lead a tonic-supported entrance');
  assert.ok(directions.has(-1)&&directions.has(1));
  assert.ok(contours.size>=16,'variety must survive the actual pitch solver, not only a label');
  assert.ok(Math.max(...contours.values())<=3);
  assert.ok(rhythms.size>=8,'same-tier opening pulse figures should also vary');
});

test('opening identity consumes no extra global draw and is independent of pitch grade',()=>{
  for(const compositionStyle of ['classical','lyrical','auto']){
    const plans=[];
    for(const difficulty of ['beginner','intermediate','advanced']){
      let draws=0;
      const values=[.24,.62,.16,.83];
      const random=()=>values[draws++%values.length];
      const plan=planMusicalIntent({...base,compositionStyle,difficulty},random);
      assert.equal(draws,compositionStyle==='auto'?4:3);
      assert.ok(validMusicalIntent(plan,8));plans.push(plain(plan));
    }
    assert.deepEqual(plans[0],plans[1]);assert.deepEqual(plans[1],plans[2]);
  }
});

test('a delayed entry retains the exact written bar and a bounded, immediately answered gap',()=>{
  let delayed=0;
  for(let seed=0;seed<32;seed++){
    let state=87301+seed;
    const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
    const plan=planMusicalIntent(base,random),first=plan.rhythm[0];
    assert.ok(Math.abs(first.notes.reduce((sum,n)=>sum+n.units,0)-16)<1e-6);
    if(first.notes[0].rest){delayed++;assert.equal(plan.opening.weak,true);assert.ok(first.notes[0].units<=2);assert.equal(first.notes[1].rest,false);}
  }
  assert.ok(delayed>0&&delayed<16,'a brief delayed entrance is an occasional choice');
});

test('narrow modes retain legal notes, grade limits and an attainable home ending',()=>{
  for(const [scaleId,range]of [['major',{min:60,max:64}],['major-pentatonic',{min:60,max:69}],['dorian',{min:62,max:74}]])for(const difficulty of ['beginner','advanced']){
    const options={...base,instrument:'Sheng',instrumentProfile:'Sheng',scaleId,range,difficulty,tonic:scaleId==='dorian'?'D':'C',keySignature:'C',rhythmLevel:'medium'};
    const api=loadModule('src/music/__openingTest.ts',87409,bridge),exercise=api.composeExercise(options);
    api.validateGeneratedExercise(exercise,range,false);
    const pitches=buildPitchMaterial(describeTonality(options.tonic,scaleId),range).pitches.map(p=>p.midi);
    const notes=exercise.measures.flatMap(b=>b.events.filter(n=>!n.rest));
    assert.ok(notes.every(n=>pitches.includes(n.midi)));
    assert.ok(notes.slice(1).every((n,i)=>Math.abs(n.midi-notes[i].midi)<=(difficulty==='beginner'?7:24)));
    assert.equal(notes.at(-1).midi%12,options.tonic==='D'?2:0);
  }
});

test('old intention metadata remains readable and corrupt new opening fields are rejected',()=>{
  const plan=plain(planMusicalIntent(base,()=>.31));assert.ok(validMusicalIntent(plan,8));
  const legacy=plain(plan);delete legacy.opening;assert.ok(validMusicalIntent(legacy,8));
  for(const patch of [{version:2},{shape:-1},{shape:8},{anchor:2},{anchor:'4'},{register:2},{rhythm:9},{weak:'true'}]){
    const corrupt=plain(plan);Object.assign(corrupt.opening,patch);assert.equal(validMusicalIntent(corrupt,8),false);
  }
});
