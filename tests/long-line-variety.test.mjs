import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

const base={compositionStyle:'auto',instrument:'Piano',instrumentProfile:'Daruan',clef:'bass',difficulty:'intermediate',keySignature:'C',tonic:'C',scaleId:'major',timeSignature:'4/4',rhythmLevel:'medium',measures:8,tempo:100,range:{min:38,max:67},allowAccidentals:false,mixedMeters:false,meters:['4/4']};
const seeds=[92011,92029,92057,92083,92111,92143,92173,92203,92237,92269,92311,92347];
const plain=x=>JSON.parse(JSON.stringify(x));
const rhythm=ex=>JSON.stringify(ex.measures.map(b=>b.events.map(n=>[n.startUnits,n.durationUnits,n.rest,n.tuplet])));
const sounding=ex=>ex.measures.flatMap(b=>b.events.filter(n=>!n.rest));
function random(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}

test('fixed-key Daruan studies vary complete rhythms, relative melody and actual peak positions',()=>{
  const scores=seeds.map(seed=>loadModule('src/music/composeExercise.ts',seed).composeExercise(base));
  const melody=ex=>{const notes=sounding(ex);return notes.map(n=>n.midi-notes[0].midi).join(',');};
  const peakBar=ex=>{const heights=ex.measures.map(b=>Math.max(...b.events.filter(n=>!n.rest).map(n=>n.midi)));return heights.indexOf(Math.max(...heights));};
  assert.ok(new Set(scores.map(rhythm)).size>=10,'same settings must have different whole-study rhythm inventories');
  assert.ok(new Set(scores.map(melody)).size>=10,'different labels or transpositions do not count');
  assert.ok(new Set(scores.map(peakBar)).size>=4,'the high point must move in the realized melody');
  assert.ok(new Set(scores.map(ex=>JSON.stringify(ex.measures[0].events.map(n=>[n.durationUnits,n.rest])))).size>=6,'not one held-note launch with a changed tail');
  for(const ex of scores){
    let previous,run=0;
    for(const note of sounding(ex)){run=note.midi===previous?run+1:1;previous=note.midi;assert.ok(run<=4,'a broad arc must not flatten into a long same-note plateau');}
  }
});

test('all long-line plans retain complete bars, real pulse groups and separate rhythm tiers',()=>{
  const {planLongLineDevelopment}=loadModule('src/music/longLineDevelopment.ts');
  const {validMusicalIntent}=loadModule('src/music/musicalIntent.ts');
  const {assertMeasureRhythm}=loadModule('src/music/rhythmTiming.ts');
  for(const meter of ['2/4','3/4','4/4','5/4','3/8','6/8','7/8','9/8','12/8'])for(const measures of [4,8,12,16]){
    const stats=[];
    for(const rhythmLevel of ['simple','medium','complex']){
      const plan=planLongLineDevelopment({...base,timeSignature:meter,measures,rhythmLevel},random(92029));
      assert.ok(validMusicalIntent(plan,measures));
      const all=plan.rhythm.flatMap(b=>b.notes),sounds=all.filter(n=>!n.rest);
      stats.push({density:sounds.length/all.reduce((sum,n)=>sum+n.units,0),short:sounds.filter(n=>n.units<=1).length/sounds.length});
      for(const bar of plan.rhythm){const [top,bottom]=meter.split('/').map(Number);assertMeasureRhythm({totalUnits:top*16/bottom,events:bar.notes.map(n=>({...n,durationUnits:n.units}))},meter);}
      assert.equal(plan.rhythm.at(-1).notes.at(-1).rest,false);
    }
    if(['4/4','6/8'].includes(meter)){
      assert.ok(stats[1].density>stats[0].density*1.25,JSON.stringify({meter,measures,stats}));
      assert.ok(stats[2].density>stats[1].density*1.15,JSON.stringify({meter,measures,stats}));
      assert.ok(stats[2].short>=.55,JSON.stringify({meter,measures,stats}));
    }
  }
});

test('pitch grade cannot change the selected entrance, rhythm, long-line design or timing',()=>{
  const {validateGeneratedExercise}=loadModule('src/music/exerciseQuality.ts');
  for(const instrumentProfile of ['Daruan','Pipa','Piano']){
    let reference;
    for(const difficulty of ['beginner','intermediate','advanced']){
      const o={...base,instrumentProfile,difficulty,rhythmLevel:'complex',range:instrumentProfile==='Daruan'?base.range:{min:45,max:88}};
      const ex=loadModule('src/music/composeExercise.ts',92083).composeExercise(o,instrumentProfile==='Piano'?'two-hand':undefined);
      validateGeneratedExercise(ex,o.range,false);
      const actual={rhythm:rhythm(ex),design:plain(ex.musicalIntent.longLine)};
      reference??=actual;assert.deepEqual(actual,reference);
    }
  }
});

test('additive 7/8 retains ordinary subdivisions and cannot acquire a quarter-pulse triplet',()=>{
  const {planLongLineDevelopment}=loadModule('src/music/longLineDevelopment.ts');
  for(const seed of [...seeds,92939])for(const rhythmLevel of ['simple','medium','complex']){
    const plan=planLongLineDevelopment({...base,timeSignature:'7/8',rhythmLevel},random(seed));
    assert.ok(plan.rhythm.every(bar=>bar.notes.every(note=>note.tuplet===undefined)));
  }
  const options={...base,timeSignature:'7/8',rhythmLevel:'complex',difficulty:'beginner',range:{min:36,max:84},instrumentProfile:'Piano'};
  const exercise=loadModule('src/music/composeExercise.ts',92939).composeExercise(options,'two-hand');
  loadModule('src/music/exerciseQuality.ts').validateGeneratedExercise(exercise,options.range,false);
});

test('new varied designs keep modal material, readable narrow ranges and approached final tonics',()=>{
  const {validateGeneratedExercise}=loadModule('src/music/exerciseQuality.ts');
  for(const scaleId of ['major','harmonic-minor','dorian','major-pentatonic','minor-pentatonic','jue'])for(const range of [{min:48,max:60},base.range]){
    const o={...base,scaleId,range,difficulty:'beginner',rhythmLevel:'complex'};
    const ex=loadModule('src/music/composeExercise.ts',92653).composeExercise(o);
    validateGeneratedExercise(ex,range,false);
    const notes=sounding(ex),last=notes.at(-1),previous=notes.at(-2);
    assert.equal(last.midi%12,0);assert.ok(Math.abs(last.midi-previous.midi)<=3);
    const corrupt=plain(ex.musicalIntent);corrupt.longLine.shape='unknown';
    assert.equal(loadModule('src/music/musicalIntent.ts').validMusicalIntent(corrupt,8),false);
  }
});

test('complex variety retains dense subdivision work rather than paying for contrast with an easier study',()=>{
  const counts=[];
  for(const seed of seeds){
    const ex=loadModule('src/music/composeExercise.ts',seed).composeExercise({...base,rhythmLevel:'complex'});
    const notes=sounding(ex);counts.push(notes.length);
    assert.ok(notes.length>=100,'eight-bar complex Daruan still has sustained subdivision work');
    assert.ok(notes.filter(n=>n.durationUnits<=1).length/notes.length>=.8);
  }
  assert.ok(counts.reduce((s,n)=>s+n,0)/counts.length>=103);
});

test('consecutive normal generations use the existing recent-tune guard with no real browser storage',()=>{
  const states=[],memory=new Map();let cursor=0;
  const react={useState(initial){const i=cursor++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return[states[i],next=>{states[i]=typeof next==='function'?next(states[i]):next;}];}};
  const storage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,String(v))};
  const api=loadModule('src/hooks/useExercise.ts',92821,undefined,{react,'../music/randomTonality':{selectRandomTonality:()=>({tonic:'C',scaleId:'major'})}},{localStorage:storage,window:{matchMedia:()=>({matches:false})}});
  const render=()=>{cursor=0;return api.useExercise();};
  const settings={...render().settings,instrument:'Daruan',clef:'bass',difficulty:'Intermediate',rhythmLevel:'Moderate',rangeMinMidi:38,rangeMaxMidi:67};
  const scores=[];
  for(let i=0;i<6;i++){assert.notEqual(render().generateFrom(settings,100,100),false);scores.push(plain(render().current.exercise));}
  for(let i=1;i<scores.length;i++)assert.notEqual(rhythm(scores[i]),rhythm(scores[i-1]),'next study must not repeat the previous whole rhythm');
  assert.ok(new Set(scores.map(ex=>ex.measures.map(b=>sounding({measures:[b]}).map(n=>n.midi).join(',')).join('|'))).size>=5);
});
