import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

const {getTonalityChoices,selectRandomTonality,requiredAccidentalCount,signatureGroup,QUIET_SIGNATURE_WEIGHTS}=loadModule('src/music/randomTonality.ts');
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

test('normal unchecked practice reduces open signatures to 5 percent while keeping sharp and flat keys',()=>{
  for(const allowAccidentals of [false,true]) {
    const counts={sharp:0,flat:0,natural:0,open:0};
    for(let n=0;n<100;n++) {
      let draw=0;
      const selected=selectRandomTonality([range],()=>draw++===0?(n+.5)/100:.47,{...quiet,allowAccidentals});
      counts[signatureGroup(describeTonality(selected.tonic,selected.scaleId).signature)]++;
    }
    assert.deepEqual(counts,allowAccidentals?{sharp:35,flat:35,natural:10,open:20}:{sharp:35,flat:35,natural:25,open:5});
  }
});

test('all special modes remain reachable with the readability policy and narrow ranges remain valid',()=>{
  for(const ranges of [[range],[{min:60,max:61}],[{min:58,max:59},{min:60,max:61}]]) {
    const choices=getTonalityChoices(ranges,quiet);
    const groups=Object.entries(QUIET_SIGNATURE_WEIGHTS).map(([group,weight])=>({group,weight,
      scales:choices.flatMap(s=>{
        const candidates=s.candidates.filter(c=>c.group===group);
        return candidates.length?[{id:s.scaleId,candidates,weight:1/(1+Math.min(...candidates.map(c=>c.alterations))**2)}]:[];
      })})).filter(g=>g.scales.length);
    for(const scale of choices) {
      const group=groups.find(g=>g.scales.some(s=>s.id===scale.scaleId));
      const item=group.scales.find(s=>s.id===scale.scaleId);
      const gTotal=groups.reduce((sum,g)=>sum+g.weight,0),sTotal=group.scales.reduce((sum,s)=>sum+s.weight,0);
      const gBefore=groups.slice(0,groups.indexOf(group)).reduce((sum,g)=>sum+g.weight,0);
      const sBefore=group.scales.slice(0,group.scales.indexOf(item)).reduce((sum,s)=>sum+s.weight,0);
      const draws=[(gBefore+group.weight/2)/gTotal,(sBefore+item.weight/2)/sTotal,.5];let n=0;
      const selected=selectRandomTonality(ranges,()=>draws[n++],quiet);
      assert.equal(selected.scaleId,scale.scaleId);
      assert.ok(ranges.every(r=>buildPitchMaterial(describeTonality(selected.tonic,selected.scaleId),r).pitches.length));
    }
  }
});
