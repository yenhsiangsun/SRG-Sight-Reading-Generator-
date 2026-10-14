import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

const {getTonalityChoices,getTonalityDistribution,selectRandomTonality,requiredAccidentalCount}=loadModule('src/music/randomTonality.ts');
const {SCALES,TONICS,describeTonality,buildPitchMaterial}=loadModule('src/music/scales.ts');
const range={min:55,max:90};
const quiet={allowAccidentals:false,difficulty:'beginner'};

test('unchecked extra notes favor fewer written accidentals without removing any scale',()=>{
  const choices=getTonalityChoices([range],quiet);
  assert.equal(choices.length,SCALES.length);
  for(const scale of choices) for(const candidate of scale.candidates) {
    const tonality=describeTonality(candidate.tonic,scale.scaleId);
    assert.ok(buildPitchMaterial(tonality,range).pitches.length>0);
    assert.ok(tonality.notes.every(n=>n.length<=2));
    if(!tonality.signature&&scale.scaleId!=='atonal') {
      const theoretical=TONICS.map(tonic=>describeTonality(tonic,scale.scaleId)).filter(t=>t.notes.every(n=>n.length<=2));
      assert.equal(requiredAccidentalCount(tonality),Math.min(...theoretical.map(requiredAccidentalCount)),scale.scaleId);
    }
  }
  for(const id of ['hirajoshi','in','insen','iwato','yo','kumoi','ryukyu','pelog-pentatonic','slendro-pentatonic']) {
    assert.ok(choices.find(s=>s.scaleId===id).candidates.every(c=>c.alterations===0),id);
  }
});

test('unchecked extra notes reduce required alterations while retaining all musical families',()=>{
  const clutter=allowAccidentals=>getTonalityDistribution([range],{...quiet,allowAccidentals})
    .reduce((sum,choice)=>sum+choice.weight*requiredAccidentalCount(describeTonality(choice.tonic,choice.scaleId)),0);
  assert.ok(clutter(false)<clutter(true)*.5,'unchecked practice favors substantially cleaner notation');
});

test('all special modes remain reachable with the readability policy and narrow ranges remain valid',()=>{
  for(const ranges of [[range],[{min:60,max:61}],[{min:58,max:59},{min:60,max:61}]]) {
    const choices=getTonalityDistribution(ranges,quiet);
    let position=0;
    assert.equal(new Set(choices.map(choice=>choice.scaleId)).size,SCALES.length);
    for(const choice of choices) {
      const selected=selectRandomTonality(ranges,()=>position+choice.weight/2,quiet);
      assert.equal(selected.scaleId,choice.scaleId);
      assert.equal(selected.tonic,choice.tonic);
      assert.ok(ranges.every(r=>buildPitchMaterial(describeTonality(selected.tonic,selected.scaleId),r).pitches.length));
      position+=choice.weight;
    }
    assert.ok(Math.abs(position-1)<1e-12);
  }
});
