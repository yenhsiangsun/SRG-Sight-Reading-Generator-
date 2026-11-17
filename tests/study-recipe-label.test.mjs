import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';import {loadModule} from './helpers.mjs';
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/study-recipe-label.json',import.meta.url))),plain=x=>JSON.parse(JSON.stringify(x));
function session(){const values=[],memory=new Map();let cursor=0;const react={useState(initial){const i=cursor++;if(!(i in values))values[i]=typeof initial==='function'?initial():initial;return[values[i],next=>{values[i]=typeof next==='function'?next(values[i]):next;}];}};
 const api=loadModule('src/hooks/useExercise.ts',fixture.seed,undefined,{react,'../music/randomTonality':{selectRandomTonality:()=>({tonic:'C',scaleId:'major'})}},{window:{matchMedia:()=>({matches:false})},localStorage:{getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,String(v))}});return()=>{cursor=0;return api.useExercise();};}

test('display labels retain the actual selected recipe without changing any generated music or rotation',()=>{
 const render=session();for(const previous of fixture.records){assert.equal(render().generateFrom(fixture.settings,90,90),90);const current=render().current;assert.equal(current.recipe,previous.recipe);assert.equal(current.exercise.studyRecipe,current.recipe);
 const {studyRecipe,...music}=current.exercise;assert.equal(createHash('sha256').update(JSON.stringify(music)).digest('hex'),previous.hash,'notes, rhythm, expression, tempo and random choices stay exact');assert.ok(studyRecipe);}
});
test('the same label survives previous-score snapshots, favorite JSON and resume, then restores with its own score',()=>{
 const render=session();render().generateFrom(fixture.settings,90,90);const current=plain(render().current),{makeStudySnapshot}=loadModule('src/practice/studyComparison.ts');
 const snapshot=makeStudySnapshot({exercise:current.exercise,settings:current.settings,bpm:90,id:'label-score',position:0,number:1});
 const study={id:'label-score',created:0,bpm:90,settings:snapshot.settings,exercise:snapshot.exercise};
 const library=loadModule('src/practice/library.ts').readLibrary(JSON.stringify({version:1,scores:[study],presets:[]}));assert.equal(library.scores.length,1);assert.equal(library.scores[0].exercise.studyRecipe,current.recipe);
 const resumed=loadModule('src/practice/resume.ts').readLastPractice(JSON.stringify({version:1,study,position:0}));assert.ok(resumed);assert.equal(resumed.study.exercise.studyRecipe,current.recipe);
 render().generateFrom(fixture.settings,90,90);render().restore(resumed.study.exercise,resumed.study.settings);assert.equal(render().current.recipe,current.recipe);
 assert.deepEqual(plain(render().current.exercise.measures),current.exercise.measures);
});
test('older or invalid tags cannot inherit the label of the previously viewed score',()=>{
 const render=session();render().generateFrom(fixture.settings,90,90);const original=plain(render().current.exercise),{readStudyRecipe,studyRecipeLabel}=loadModule('src/practice/studyRecipe.ts');
 for(const value of [undefined,'B-unknown','constructor',{},null]){const old={...original};if(value===undefined)delete old.studyRecipe;else old.studyRecipe=value;render().restore(old,fixture.settings);assert.equal(render().current.recipe,undefined);assert.equal(readStudyRecipe(value),undefined);assert.equal(studyRecipeLabel(value,'zh-TW'),undefined);assert.deepEqual(plain(render().current.exercise.measures),original.measures);}
});
