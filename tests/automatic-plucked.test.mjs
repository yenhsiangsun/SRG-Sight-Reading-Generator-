import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';import {loadModule} from './helpers.mjs';
const base={compositionStyle:'auto',instrument:'Piano',instrumentProfile:'Daruan',clef:'bass',difficulty:'intermediate',keySignature:'C',tonic:'C',scaleId:'major',timeSignature:'4/4',rhythmLevel:'complex',measures:8,tempo:90,range:{min:38,max:67},allowAccidentals:false,mixedMeters:false,meters:['4/4']};
const plain=x=>JSON.parse(JSON.stringify(x));const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');

test('a shuffled four-study cycle retains A, all three B priorities and no adjacent repeat across cycle boundaries',()=>{
 const api=loadModule('src/music/automaticPlucked.ts',97007);let bag;const chosen=[];
 for(let i=0;i<80;i++){const choice=api.choosePluckedRecipe(base,undefined,bag);assert.ok(choice);if(i)assert.notEqual(choice,chosen.at(-1));chosen.push(choice);bag=api.rememberPluckedRecipe(base,undefined,choice,bag);}
 assert.notEqual(chosen[0],'A');for(let i=0;i<80;i+=4)assert.deepEqual(chosen.slice(i,i+4).sort(),['A','B-combined','B-melody','B-rhythm']);
});
test('unsupported settings keep the original path and consume no new selection randomness',()=>{
 const api=loadModule('src/music/automaticPlucked.ts');
 for(const patch of [{instrumentProfile:'Piano'},{instrumentProfile:'Sheng'},{mixedMeters:true},{allowAccidentals:true},{pitchFocus:'scales'},{rhythmFocus:'triplets'}])assert.equal(api.choosePluckedRecipe({...base,...patch},undefined,undefined,()=>{throw Error('unexpected RNG');}),undefined);
 const fixtures=JSON.parse(fs.readFileSync(new URL('./fixtures/plucked-bypass.json',import.meta.url)));
 for(const c of fixtures){const ex=loadModule('src/music/automaticPlucked.ts',c.seed).composeAutomaticStudy(c.options,c.grand);assert.equal(hash(ex),c.hash,c.id);}
});
test('retained A and the three human-heard B samples reproduce exactly through the adopted entry',()=>{
 const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/plucked-repertoire-adoption.json',import.meta.url)));
 for(const c of fixture.A){const ex=loadModule('src/music/automaticPlucked.ts',c.seed).composeAutomaticStudy(c.options,c.grand,'A');assert.equal(hash(ex),c.hash,c.id);}
 const bridge=`export {composeAutomaticStudy} from './automaticPlucked';export {coordinateGrandStaff} from './grandAccompaniment';export {addInstrumentHarmony} from './instrumentHarmony';export {addPerformanceMarks} from './performanceMarks';export {addPipaTechniques} from './pipaTechniques';`;
 for(const c of fixture.B){const api=loadModule('src/music/__b97Accepted.ts',c.seed,bridge),o=c.options;let ex=api.composeAutomaticStudy(o,undefined,c.recipe);ex={...ex,soundProfile:'Daruan',tempo:90,staffMode:'fixed',transposition:0};ex=api.coordinateGrandStaff(ex,o.range,false,false);ex=api.addInstrumentHarmony(ex,o.range);ex=api.addPerformanceMarks(ex);ex=api.addPipaTechniques(ex,o.range);assert.equal(hash(canonical(ex)),c.finalHash,c.recipe);}
});
function session(seed=97033,overrides={}){
 const values=[],memory=new Map();let cursor=0;const react={useState(initial){const i=cursor++;if(!(i in values))values[i]=typeof initial==='function'?initial():initial;return[values[i],next=>{values[i]=typeof next==='function'?next(values[i]):next;}];}};
 const api=loadModule('src/hooks/useExercise.ts',seed,undefined,{react,'../music/randomTonality':{selectRandomTonality:()=>({tonic:'C',scaleId:'major'})},...overrides},{window:{matchMedia:()=>({matches:false})},localStorage:{getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,String(v))}});
 return{render(preview){cursor=0;return api.useExercise(preview);},memory};
}
const settings=h=>({...h.render().settings,instrument:'Daruan',clef:'bass',difficulty:'Intermediate',rhythmLevel:'Complex',rangeMinMidi:38,rangeMaxMidi:67,measureCount:8,timeSignature:'4/4',performanceMarks:true});
test('the actual normal-generation hook accepts three B studies and one A each cycle while complex rhythm stays difficult',()=>{
 const h=session(),s=settings(h),recipes=[],rhythms=[];
 for(let i=0;i<12;i++){
  assert.equal(h.render().generateFrom(s,90,90),90);const c=h.render().current;recipes.push(c.recipe);
  const notes=c.exercise.measures.flatMap(b=>b.events.filter(n=>!n.rest));assert.ok(notes.length>=100);assert.ok(notes.filter(n=>n.durationUnits<=1).length/notes.length>=.8);
  assert.equal(c.settings.rhythmLevel,'Complex');assert.equal(c.settings.difficulty,'Intermediate');
  loadModule('src/music/exerciseQuality.ts').validateGeneratedExercise(c.exercise,base.range,false);
  rhythms.push(JSON.stringify(c.exercise.measures.map(b=>b.events.map(n=>[n.startUnits,n.durationUnits,n.rest,n.tuplet]))));
 }
 assert.notEqual(recipes[0],'A');for(let i=0;i<12;i+=4)assert.deepEqual(recipes.slice(i,i+4).sort(),['A','B-combined','B-melody','B-rhythm']);
 for(let i=1;i<12;i++){assert.notEqual(recipes[i],recipes[i-1]);assert.notEqual(rhythms[i],rhythms[i-1]);}
 assert.ok(new Set(rhythms).size>=10);assert.ok([...h.memory.keys()].every(k=>!k.includes('recipe')),'rotation must not add a new browser storage key');
});
test('preview and score restore preserve saved notes and do not consume an accepted-study slot',()=>{
 const h=session(97637),s=settings(h),preview={tonic:'C',scaleId:'major'};
 assert.equal(h.render(preview).generateFrom(s,90,90),90);assert.equal(h.render().current.isPreview,true);const saved=plain(h.render().current.exercise);
 const notes=ex=>JSON.stringify([ex.measures,ex.lowerMeasures??[]].map(v=>v.map(b=>b.events.map(n=>[n.midi,n.startUnits,n.durationUnits,n.rest]))));
 h.render().restore(saved,s);assert.equal(notes(h.render().current.exercise),notes(saved));
 const choices=[];for(let i=0;i<4;i++){assert.equal(h.render().generateFrom(s,90,90),90);choices.push(h.render().current.recipe);}
 assert.notEqual(choices[0],'A');assert.deepEqual(choices.sort(),['A','B-combined','B-melody','B-rhythm']);
});

test('a failed first score and optional diversity retries cannot spend extra recipe slots',()=>{
 const automatic=loadModule('src/music/automaticPlucked.ts',97703),bags=[];let fail=true;
 const h=session(97729,{'../music/automaticPlucked':{...automatic,
  choosePluckedRecipe(o,g,bag){bags.push(bag===undefined?undefined:plain(bag));return automatic.choosePluckedRecipe(o,g,bag);},
  composeAutomaticStudy(...args){if(fail){fail=false;throw Error('test generation failure');}return automatic.composeAutomaticStudy(...args);},
 },'../practice/recentVariety':{readRecentExercises:()=>[],scoreRecentSimilarity:()=>1,rememberRecentExercise:()=>[]}}),s=settings(h);
 assert.equal(h.render().generateFrom(s,90,90),false);assert.equal(h.render().current,null);
 const choices=[];for(let i=0;i<4;i++){assert.equal(h.render().generateFrom(s,90,90),90);choices.push(h.render().current.recipe);}
 assert.equal(bags[0],undefined);assert.equal(bags[1],undefined,'failed generation must leave the first-study bag untouched');
 assert.deepEqual(choices.sort(),['A','B-combined','B-melody','B-rhythm']);
});

test('melody ranking distinguishes a pitch plateau from normal motifs, sustained tones and rhythm-led repetition',()=>{
 const {scorePluckedStagnation}=loadModule('src/music/automaticPlucked.ts');
 const exercise=pitches=>({measures:[{events:pitches.map(midi=>({midi,rest:false,durationUnits:1}))}]});
 assert.ok(scorePluckedStagnation(exercise(Array(8).fill(60)),'B-melody')>.68);
 assert.ok(scorePluckedStagnation(exercise(Array(8).fill(72)),'B-combined')>.68);
 assert.equal(scorePluckedStagnation(exercise([60,62,64,60,62,64,60,62]),'B-melody'),0);
 assert.equal(scorePluckedStagnation(exercise([60]),'B-melody'),0);
 assert.equal(scorePluckedStagnation(exercise(Array(8).fill(60)),'B-rhythm'),0);
 assert.equal(scorePluckedStagnation(exercise(Array(8).fill(60)),'A'),0);
});
