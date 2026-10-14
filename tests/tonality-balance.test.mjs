import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

const {getTonalityDistribution,tonalityFamily}=loadModule('src/music/randomTonality.ts');
const {getScale,describeTonality,buildPitchMaterial}=loadModule('src/music/scales.ts');
const range={min:48,max:84};

test('every difficulty gets 65/25/10 families rather than a catalog-size or instrument bias',()=>{
  for(const difficulty of ['beginner','intermediate','advanced'])for(const allowAccidentals of [false,true]) {
    const choices=getTonalityDistribution([range],{difficulty,allowAccidentals});
    for(const [family,expected] of [['major-minor-modes',.65],['pentatonic',.25],['colour',.1]]) {
      const share=choices.filter(choice=>tonalityFamily(choice.scaleId)===family).reduce((sum,choice)=>sum+choice.weight,0);
      assert.ok(Math.abs(share-expected)<1e-12,`${difficulty}: ${family} = ${share}`);
    }
    const share=id=>choices.filter(choice=>choice.scaleId===id).reduce((sum,choice)=>sum+choice.weight,0);
    assert.ok(share('major')+share('natural-minor')>.25,'recognizable major/minor tonality has a substantial presence');
    assert.ok(share('dorian')>0&&share('lydian')>0&&share('mixolydian')>0);
  }
});

test('multiple names for one interval pattern do not multiply its probability',()=>{
  const choices=getTonalityDistribution([range],{allowAccidentals:false});
  const patterns=new Map();
  for(const choice of choices.filter(choice=>tonalityFamily(choice.scaleId)==='pentatonic')) {
    const shape=getScale(choice.scaleId).intervals.join(',');
    patterns.set(shape,(patterns.get(shape)??0)+choice.weight);
  }
  const expected=.25/patterns.size;
  for(const [shape,weight] of patterns)assert.ok(Math.abs(weight-expected)<1e-12,`${shape}: ${weight}`);
  for(const alias of ['shang','egyptian-pentatonic','slendro-pentatonic','zhi','yo']) {
    assert.ok(choices.some(choice=>choice.scaleId===alias&&choice.weight>0),alias);
  }
});

test('explicit keys keep equal shares and renormalize only over compatible families',()=>{
  for(const keys of [['C'],['C','G','Bb'],['C#','Cb','open']]) {
    const choices=getTonalityDistribution([range],{allowedKeySignatures:keys,allowAccidentals:false});
    for(const key of keys) {
      const selected=choices.filter(choice=>(describeTonality(choice.tonic,choice.scaleId).signature??'open')===key);
      assert.ok(Math.abs(selected.reduce((sum,choice)=>sum+choice.weight,0)-1/keys.length)<1e-12,key);
    }
    assert.ok(choices.every(choice=>keys.includes(describeTonality(choice.tonic,choice.scaleId).signature??'open')));
  }
  const open=getTonalityDistribution([range],{allowedKeySignatures:['open']});
  assert.ok(open.every(choice=>tonalityFamily(choice.scaleId)!=='major-minor-modes'));
  assert.ok(Math.abs(open.filter(choice=>tonalityFamily(choice.scaleId)==='pentatonic')
    .reduce((sum,choice)=>sum+choice.weight,0)-25/35)<1e-12);
});

test('all weighted candidates stay playable in each requested narrow staff range',()=>{
  for(const ranges of [[{min:61,max:61}],[{min:58,max:59},{min:60,max:61}],[{min:22,max:23}]]) {
    for(const allowedKeySignatures of [undefined,['G','Gb','F']]) {
      const choices=getTonalityDistribution(ranges,{allowedKeySignatures,allowAccidentals:false});
      assert.ok(Math.abs(choices.reduce((sum,choice)=>sum+choice.weight,0)-1)<1e-12);
      assert.ok(choices.every(choice=>choice.weight>0&&ranges.every(staff=>
        buildPitchMaterial(describeTonality(choice.tonic,choice.scaleId),staff).pitches.length>0)));
    }
  }
});
