import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';
const {scoreTonalityLabel}=loadModule('src/i18n/scoreTonality.ts');
const {describeTonality}=loadModule('src/music/scales.ts');
test('modal heading reports the actual tonic rather than the major key sharing its signature',()=>{
 const tone=describeTonality('C#','locrian');assert.equal(tone.signature,'D');
 assert.equal(scoreTonalityLabel(tone,'zh-TW'),'C# · 洛克里安 Locrian');
 assert.equal(scoreTonalityLabel(tone,'en'),'C# · Locrian');
 assert.ok(scoreTonalityLabel(describeTonality('Db','major'),'en').startsWith('Db · '),'preserve selected enharmonic spelling');
});
test('atonal and legacy or unrecognised scores do not acquire an invented tonic or major label',()=>{
 assert.equal(scoreTonalityLabel(describeTonality('C','atonal'),'zh-TW'),'非調性（自由半音）');
 assert.equal(scoreTonalityLabel(undefined,'en'),null);
 assert.equal(scoreTonalityLabel({scaleId:'future-mode',tonic:'C'},'en'),null);
});
test('the shared screen and export label has an explicit mode name for every supported locale',()=>{
 const tone=describeTonality('C#','locrian');
 for(const locale of ['zh-TW','en','ja','es','de','fr','ko','pt-BR','ru','it','zh-CN','th']){
  const label=scoreTonalityLabel(tone,locale);assert.ok(label.startsWith('C# · ')&&label.length>6,locale);
 }
});
