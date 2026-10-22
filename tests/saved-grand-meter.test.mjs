import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {loadModule} from './helpers.mjs';

const plain=value=>JSON.parse(JSON.stringify(value));
const library=loadModule('src/practice/library.ts',1,
  process.env.SAVED_GRAND_LIBRARY_SOURCE?fs.readFileSync(process.env.SAVED_GRAND_LIBRARY_SOURCE,'utf8'):undefined);
const {readLastPractice}=loadModule('src/practice/resume.ts',1,undefined,{'./library':library});
const {assertMeasureRhythm}=loadModule('src/music/rhythmTiming.ts');

function study(mode,meter,metadata='both',mixed=false){
  const meters=mixed?['3/4','6/8','3/4','6/8']:Array(4).fill(meter);
  const staff=lower=>meters.map(timeSignature=>({
    ...((metadata==='both'||metadata===(lower?'lower':'upper')||timeSignature!==meter)?{timeSignature}:{}),
    totalUnits:12,groups:timeSignature==='6/8'?[6,6]:[4,4,4],
    events:Array.from({length:6},(_,event)=>({
      key:lower?'c/3':'c/4',octave:lower?3:4,...(lower&&mode==='mono'?{}:{midi:lower?48:60}),
      rest:lower&&mode==='mono',duration:'8',dots:0,startUnits:event*2,durationUnits:2,
    })),
  }));
  return {id:[mode,meter,metadata,mixed?'mixed':'uniform'].join('-'),created:1,bpm:80,
    settings:{instrument:'Piano',clef:'grand',difficulty:'Intermediate',rhythmLevel:'Moderate',
      keySignature:'C',tonic:'C',scaleId:'major',timeSignature:meter,measureCount:4,
      rangeMinMidi:48,rangeMaxMidi:84,allowAccidentals:false,mixedMeters:mixed,meters:mixed?['3/4','6/8']:[meter]},
    exercise:{instrument:'Piano',soundProfile:'Piano',clef:'treble',grandMode:mode,
      difficulty:'intermediate',rhythmLevel:'medium',keySignature:'C',tempo:80,timeSignature:meter,
      measures:staff(false),lowerMeasures:staff(true)},
  };
}

const legal=[];
for(const mode of ['mono','two-hand'])for(const meter of ['3/4','6/8'])for(const metadata of ['both','upper','lower','neither'])
  legal.push(study(mode,meter,metadata));
for(const mode of ['mono','two-hand'])for(const metadata of ['upper','lower'])legal.push(study(mode,'3/4',metadata,true));
const contradictory=[];
for(const mode of ['mono','two-hand'])for(const meter of ['3/4','6/8']){
  const bad=study(mode,meter,meter==='6/8'?'upper':'lower');bad.id+='-contradictory';
  // Both meters last twelve units. Each staff is individually valid, while
  // their pulse grouping differs; bar length alone cannot detect this fault.
  const changed=meter==='6/8'?bad.exercise.lowerMeasures[1]:bad.exercise.measures[1];
  changed.timeSignature=meter==='6/8'?'3/4':'6/8';
  contradictory.push(bad);
}
const mixedBad=study('two-hand','3/4','both',true);mixedBad.id+='-contradictory';
delete mixedBad.exercise.lowerMeasures[1].timeSignature;
contradictory.push(mixedBad);

test('saved grand staves accept matching effective meters with either or both legacy fields omitted',()=>{
  for(const entry of legal){
    const before=JSON.stringify(entry);
    assert.equal(library.validStudy(entry,true),true,entry.id);
    assert.equal(JSON.stringify(entry),before,'validation must not fill in legacy meter metadata');
  }
});

test('equal-length but differently grouped grand-staff meters are rejected before saving or restoring',()=>{
  for(const entry of contradictory){
    const before=JSON.stringify(entry),ex=entry.exercise;
    for(const staff of [ex.measures,ex.lowerMeasures])for(const bar of staff)
      assert.doesNotThrow(()=>assertMeasureRhythm(bar,bar.timeSignature??ex.timeSignature));
    assert.equal(ex.measures[1].totalUnits,ex.lowerMeasures[1].totalUnits);
    assert.equal(library.validStudy(entry,true),false,entry.id);
    assert.throws(()=>library.addStudy(library.emptyLibrary(),entry,'scores'),/libraryError/);
    assert.equal(JSON.stringify(entry),before,'rejection must not rewrite the original score');
  }
});

test('reading a mixed saved library filters only contradictory scores and preserves valid legacy JSON',()=>{
  const raw=JSON.stringify({version:1,scores:[...contradictory,...legal],presets:[]});
  const read=library.readLibrary(raw);
  assert.deepEqual(plain(read.scores.map(entry=>entry.id)),legal.map(entry=>entry.id));
  assert.deepEqual(plain(read.scores),legal);
  assert.equal(raw,JSON.stringify({version:1,scores:[...contradictory,...legal],presets:[]}));
  for(const entry of legal)assert.deepEqual(plain(read.scores.find(item=>item.id===entry.id)),entry);
});

function state(){
  const slots=[];let cursor=0;
  return {reset(){cursor=0;},react:{useState(initial){
    const index=cursor++;if(!(index in slots))slots[index]=typeof initial==='function'?initial():initial;
    return [slots[index],next=>{slots[index]=typeof next==='function'?next(slots[index]):next;}];
  }}};
}

function openCallback(context){
  const source=fs.readFileSync('src/App.tsx','utf8');
  const tree=ts.createSourceFile('App.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let expression;
  function visit(node){
    if(ts.isVariableDeclaration(node)&&node.name.getText(tree)==='openStudy')expression=node.initializer?.getText(tree);
    ts.forEachChild(node,visit);
  }
  visit(tree);assert.ok(expression,'exercise the real App library-open callback');
  return vm.runInNewContext(ts.transpileModule(`(${expression})`,{compilerOptions:{target:ts.ScriptTarget.ES2023}}).outputText,context);
}

test('the public library hook and App open callback restore only accepted scores without regenerating or rewriting saves',()=>{
  const raw=JSON.stringify({version:1,scores:[...contradictory,...legal],presets:[]});
  const values=new Map([[library.LIBRARY_KEY,raw]]),saved={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value))};
  const collectionState=state(),exerciseState=state();
  let generationCalls=0;
  const forbidden=()=>{generationCalls++;throw Error('Opening a saved score must not generate');};
  const {useLibrary}=loadModule('src/hooks/useLibrary.ts',1,undefined,{react:collectionState.react,'../practice/library':library},{localStorage:saved});
  const {useExercise}=loadModule('src/hooks/useExercise.ts',1,undefined,{
    react:exerciseState.react,'../music/composeExercise':{composeExercise:forbidden},
  },{localStorage:saved,window:{matchMedia:forbidden}});
  function LibraryHookHarness(){collectionState.reset();return useLibrary();}
  function ExerciseHookHarness(){exerciseState.reset();return useExercise();}
  let page='home',dialog='library',bpm=0,mode='',stops=0,scrolls=0;
  const comparisons=[];
  const restored=[],open=openCallback({collection:LibraryHookHarness(),setComparison:value=>comparisons.push(plain(value)),
    practice:{restore(exercise,settings){restored.push(exercise);return ExerciseHookHarness().restore(exercise,settings);},generateFrom:forbidden},
    playback:{stop(){stops++;}},setPage:value=>{page=value;},setDialog:value=>{dialog=value;},
    setBpm:value=>{bpm=value;},setMode:value=>{mode=value;},window:{scrollTo(){scrolls++;}},
  });
  const accepted=LibraryHookHarness().library.scores;
  assert.deepEqual(plain(accepted.map(entry=>entry.id)),legal.map(entry=>entry.id),'corrupt entries never reach the public open action');
  for(const entry of accepted){
    open(entry);
    const current=ExerciseHookHarness().current;
    assert.deepEqual(plain(current.exercise),plain(entry.exercise));
    assert.deepEqual(plain(current.settings),plain(entry.settings));
    assert.equal(current.exercise,entry.exercise,'legacy score without slurs is restored as saved');
    assert.deepEqual({page,dialog,bpm,mode},{page:'practice',dialog:null,bpm:80,mode:'practice'});
  }
  assert.equal(restored.length,legal.length);assert.equal(stops,legal.length);assert.equal(scrolls,legal.length);
  assert.deepEqual(comparisons,legal.map(()=>({previous:null,showingPrevious:false})),'opening a saved score clears the temporary comparison');
  assert.equal(generationCalls,0);assert.equal(saved.getItem(library.LIBRARY_KEY),raw);
});

test('last-practice loading shares the same legacy-compatible meter guard',()=>{
  for(const entry of legal){
    const last=readLastPractice(JSON.stringify({version:1,study:entry,position:1.25}));
    assert.ok(last,entry.id);assert.deepEqual(plain(last.study),entry);assert.equal(last.position,1.25);
  }
  for(const entry of contradictory)assert.ok(readLastPractice(JSON.stringify({version:1,study:entry,position:1.25}))===null,entry.id);
});

test('the existing total-unit guard still rejects a lower staff with a different bar length',()=>{
  const bad=study('two-hand','3/4');bad.exercise.lowerMeasures[1].totalUnits=16;
  assert.equal(library.validStudy(bad,true),false);
});
