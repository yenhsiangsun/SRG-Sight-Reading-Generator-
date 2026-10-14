import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

const {planPhraseHarmony}=loadModule('src/music/phraseHarmony.ts');
const {SCALES,TONICS,describeTonality,pitchClass}=loadModule('src/music/scales.ts');
const plain=value=>JSON.parse(JSON.stringify(value));
const plan=(id,seed=0,count=8)=>planPhraseHarmony(describeTonality('C',id),Array(count).fill('4/4'),seed);

test('major and minor studies visit mediants and supertonics with both dominant and plagal endings',()=>{
  for(const id of ['major','natural-minor','harmonic-minor','melodic-minor']) {
    const roots=new Set(),cadences=new Set(),paths=new Set();
    for(let seed=0;seed<32;seed++) {
      const bars=plan(id,seed);
      bars.forEach(bar=>roots.add(bar.root));
      cadences.add(bars.at(-2).root);paths.add(bars.map(bar=>bar.root).join(','));
    }
    assert.ok(paths.size>=8,`${id}: distinct whole-piece harmonic paths`);
    assert.ok(roots.has(2)&&roots.has(id==='major'?4:3),`${id}: ii and III/iii are available`);
    assert.ok(roots.has(['major','melodic-minor'].includes(id)?9:8),`${id}: VI/vi is available`);
    assert.ok(cadences.has(7)&&cadences.has(5),`${id}: both V/v and IV/iv can prepare the tonic`);
  }
  const majorBars=plan('major');
  assert.deepEqual(plain(majorBars.find(bar=>bar.root===2).pitches),[2,5,9],'ii contains D–F–A');
  assert.deepEqual(plain(majorBars.find(bar=>bar.root===9).pitches),[9,0,4],'vi contains A–C–E');
  assert.deepEqual(plain(plan('natural-minor').find(bar=>bar.root===7).pitches),[7,10,2],'natural minor keeps its minor dominant');
  assert.deepEqual(plain(plan('harmonic-minor').find(bar=>bar.root===7).pitches),[7,11,2],'harmonic minor uses its own raised seventh');
});

test('modal cadences retain their characteristic degrees and tonic chord quality',()=>{
  for(const [id,characteristic] of [['dorian',9],['phrygian',1],['lydian',6],['mixolydian',10],['locrian',6]]) {
    const plans=Array.from({length:8},(_,seed)=>plan(id,seed));
    assert.ok(plans.flat().some(bar=>bar.pitches.includes(characteristic)),`${id}: modal color remains audible`);
    assert.ok(new Set(plans.map(bars=>bars.map(bar=>bar.root).join(','))).size>=4);
  }
  assert.deepEqual(plain(plan('locrian')[0].pitches),[0,3,6],'Locrian tonic retains its diminished fifth');
  assert.deepEqual(plain(plan('whole-tone')[0].pitches),[0,4,8],'whole-tone tonic uses the augmented fifth');
  assert.deepEqual(plain(plan('major-blues')[0].pitches),[0,4,7],'major blues lands on a major tonic');
  for(let seed=0;seed<8;seed++)assert.ok([1,5].includes(plan('phrygian',seed).at(-2).root),'Phrygian approaches through bII or iv');
});

test('longer studies contrast harmonic paths instead of repeating an eight-bar loop',()=>{
  for(const id of ['major','natural-minor','dorian','major-pentatonic'])for(let seed=0;seed<20;seed++) {
    const roots=plan(id,seed,16).map(bar=>bar.root);
    assert.notDeepEqual(roots.slice(0,8),roots.slice(8),`${id}/${seed}`);
  }
});

test('all mode and tonic combinations keep legal centers, chords and cadences across lengths and meters',()=>{
  for(const {id} of SCALES)for(const tonic of TONICS)for(const count of [0,1,2,4,8,12,16])for(const seed of [0,5,19,4294967295]) {
    const tonality=describeTonality(tonic,id),before=JSON.stringify(tonality);
    const meters=Array.from({length:count},(_,index)=>['4/4','6/8','3/4','7/8'][index%4]);
    const bars=planPhraseHarmony(tonality,meters,seed),allowed=tonality.notes.map(pitchClass);
    assert.equal(JSON.stringify(tonality),before);
    assert.deepEqual(plain(bars),plain(planPhraseHarmony(tonality,meters,seed)),'local selection is reproducible');
    if(id==='atonal'){assert.equal(bars.length,0);continue;}
    assert.equal(bars.length,count);
    if(!count)continue;
    assert.equal(bars[0].root,pitchClass(tonic));assert.equal(bars.at(-1).root,pitchClass(tonic));
    for(const bar of bars) {
      assert.ok(allowed.includes(bar.root));
      assert.ok(bar.pitches.includes(bar.root)&&bar.pitches.every(pc=>allowed.includes(pc)));
      assert.ok(bar.pitches.length>=2&&bar.pitches.length<=3);
    }
    if(count>2)assert.equal(bars.at(-2).role,'prepare');
    assert.equal(bars.at(-1).role,'arrive');
    const tonicChord=bars.at(-1).pitches.map(pc=>(pc-pitchClass(tonic)+12)%12);
    assert.ok(!(tonicChord.includes(3)&&tonicChord.includes(4)),'no conflicting tonic thirds');
  }
});
