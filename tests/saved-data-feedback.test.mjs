import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createRequire} from 'node:module';
import {loadModule} from './helpers.mjs';

const require=createRequire(import.meta.url),plain=value=>JSON.parse(JSON.stringify(value));
const source=file=>fs.readFileSync(process.env.SAVED_DATA_BEFORE_ROOT?path.join(process.env.SAVED_DATA_BEFORE_ROOT,file):file,'utf8');
const library=loadModule('src/practice/library.ts',1,source('src/practice/library.ts'));
const resumeApi=loadModule('src/practice/resume.ts',1,source('src/practice/resume.ts'),{'./library':library});
const {translate,localeOrder}=loadModule('src/i18n/messages.ts');
const {resumeCopy}=loadModule('src/i18n/resumeCopy.ts');

function study(id='kept',midi=60){
  const staff=lower=>Array.from({length:4},()=>({timeSignature:'3/4',totalUnits:12,groups:[4,4,4],events:Array.from({length:6},(_,i)=>({key:lower?'c/3':midi===62?'d/4':'c/4',octave:lower?3:4,midi:lower?48:midi,rest:false,duration:'8',dots:0,startUnits:i*2,durationUnits:2}))}));
  return{id,created:1,bpm:80,settings:{instrument:'Piano',clef:'grand',difficulty:'Intermediate',rhythmLevel:'Moderate',keySignature:'C',tonic:'C',scaleId:'major',timeSignature:'3/4',measureCount:4,rangeMinMidi:48,rangeMaxMidi:84,allowAccidentals:false,mixedMeters:false,meters:['3/4']},exercise:{instrument:'Piano',soundProfile:'Piano',clef:'treble',grandMode:'two-hand',difficulty:'intermediate',rhythmLevel:'medium',keySignature:'C',tempo:80,timeSignature:'3/4',measures:staff(false),lowerMeasures:staff(true)}};
}
const kept=study(),next=study('next',62),bad=study('contradictory');
bad.exercise.lowerMeasures[1].timeSignature='6/8';bad.exercise.lowerMeasures[1].groups=[6,6];
const collectionRaw=(scores=[kept])=>JSON.stringify({version:1,scores,presets:[]});
function storage(raw=collectionRaw()){
  const values=new Map([[library.LIBRARY_KEY,raw]]),writes=[];
  return{values,writes,getItem:key=>values.get(key)??null,setItem(key,value){writes.push({key,value});values.set(key,String(value));}};
}
function hooks(){
  const slots=[],effects=[];let cursor=0,dirty=false;
  const equal=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
  const react={
    useState(initial){const i=cursor++;if(!(i in slots))slots[i]={value:typeof initial==='function'?initial():initial};return[slots[i].value,next=>{const value=typeof next==='function'?next(slots[i].value):next;if(!Object.is(value,slots[i].value)){slots[i].value=value;dirty=true;}}];},
    useRef(initial){const i=cursor++;if(!(i in slots))slots[i]={current:initial};return slots[i];},
    useMemo(make,deps){const i=cursor++;if(!(i in slots)||!equal(slots[i].deps,deps))slots[i]={deps,value:make()};return slots[i].value;},
    useCallback(fn,deps){return react.useMemo(()=>fn,deps);},
    useEffect(effect,deps){const i=cursor++,old=slots[i];if(old&&equal(old.deps,deps))return;slots[i]={deps,cleanup:old?.cleanup};effects.push(()=>{slots[i].cleanup?.();slots[i].cleanup=effect();});},
  };
  return{react,render(fn,...args){let value,count=0;do{assert.ok(count++<10);cursor=0;dirty=false;value=fn(...args);while(effects.length)effects.shift()();}while(dirty);return value;},unmount(){for(const slot of slots)slot?.cleanup?.();}};
}
function collection(saved){
  const h=hooks();let id=0;
  const {useLibrary}=loadModule('src/hooks/useLibrary.ts',1,source('src/hooks/useLibrary.ts'),{react:h.react,'../practice/library':library},{Error,localStorage:saved,crypto:{randomUUID:()=>`new-${++id}`}});
  function LibraryHookHarness(){return h.render(useLibrary);}
  return{render:LibraryHookHarness};
}
function libraryUI(locale='en'){
  const h=hooks(),module={exports:{}},output=ts.transpileModule(source('src/components/PracticeTools.tsx'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  vm.runInNewContext(output,{module,exports:module.exports,require(name){
    if(name.endsWith('.css'))return{};
    if(name==='react')return h.react;
    if(name==='react/jsx-runtime')return require(name);
    if(name==='../i18n/context')return{useI18n:()=>({locale,t:key=>translate(locale,key)})};
    if(name==='./StudioDialogs')return{StudioDialog:({title,children})=>React.createElement('section',{'aria-label':title},children)};
    if(name.startsWith('../'))return loadModule(`src/${name.slice(3)}.ts`);
    throw Error('Unexpected import '+name);
  }});
  return props=>renderToStaticMarkup(h.render(()=>module.exports.LibraryDialog({onOpen(){},onRemove(){},onClose(){},...props})));
}

test('library diagnostic retains the legacy reader, effective-meter validation and harmonic retirement',()=>{
  for(const metadata of ['both','upper','lower','neither']){
    const legacy=plain(kept);
    if(metadata==='lower'||metadata==='neither')legacy.exercise.measures.forEach(bar=>delete bar.timeSignature);
    if(metadata==='upper'||metadata==='neither')legacy.exercise.lowerMeasures.forEach(bar=>delete bar.timeSignature);
    legacy.exercise.measures[0].events[0].technique='pipa-harmonic';
    const raw=collectionRaw([legacy]),loaded=library.readLibraryResult(raw);
    assert.equal(loaded.unreadable,false,metadata);assert.equal(loaded.library.scores.length,1);
    assert.equal(loaded.library.scores[0].exercise.measures[0].events[0].technique,undefined);
    assert.deepEqual(plain(library.readLibrary(raw)),plain(loaded.library));assert.equal(JSON.parse(raw).scores[0].exercise.measures[0].events[0].technique,'pipa-harmonic','reader never writes the raw source');
  }
  assert.equal(library.validStudy(bad,true),false,'R29 mismatch still rejected');
  for(const raw of [collectionRaw([bad,kept]),'{',JSON.stringify({version:2,scores:[],presets:[]})])assert.equal(library.readLibraryResult(raw).unreadable,true);
  for(const raw of [null,'',collectionRaw([])])assert.equal(library.readLibraryResult(raw).unreadable,false);
});

test('filtered library refuses later save/remove without losing raw or accepted scores, and warning survives clearing',()=>{
  const raw=collectionRaw([bad,kept]),saved=storage(raw),c=collection(saved);
  assert.deepEqual(plain(c.render().library.scores.map(x=>x.id)),['kept']);assert.equal(saved.writes.length,0);
  assert.equal(c.render().message,'libraryReadProtected');c.render().clearMessage();assert.equal(c.render().message,'libraryReadProtected');
  assert.equal(c.render().save({exercise:next.exercise,settings:next.settings,bpm:80},'scores'),false);
  c.render().remove('kept','scores');
  assert.equal(saved.getItem(library.LIBRARY_KEY),raw);assert.equal(saved.writes.length,0);assert.deepEqual(plain(c.render().library.scores.map(x=>x.id)),['kept']);
});

test('write guard rereads storage when rejected data appears after a clean mount',()=>{
  for(const action of ['save','remove']){
    const saved=storage(),c=collection(saved);assert.equal(c.render().message,null);
    const raw=collectionRaw([bad,kept]);saved.values.set(library.LIBRARY_KEY,raw);
    if(action==='save')assert.equal(c.render().save({exercise:next.exercise,settings:next.settings,bpm:80},'scores'),false);
    else c.render().remove('kept','scores');
    assert.equal(c.render().message,'libraryReadProtected');c.render().clearMessage();assert.equal(c.render().message,'libraryReadProtected');
    assert.equal(saved.getItem(library.LIBRARY_KEY),raw);assert.equal(saved.writes.length,0);assert.equal(c.render().library.scores.length,1);
  }
});

test('clean collection still saves/removes while invalid score content has a distinct non-storage error',()=>{
  const saved=storage(),c=collection(saved),before=saved.getItem(library.LIBRARY_KEY);
  assert.equal(c.render().save({exercise:bad.exercise,settings:bad.settings,bpm:80},'scores'),false);
  assert.equal(c.render().message,'libraryInvalidScore');assert.equal(saved.getItem(library.LIBRARY_KEY),before);assert.equal(saved.writes.length,0);
  assert.throws(()=>library.addStudy(library.emptyLibrary(),bad,'scores'),/libraryError/,'existing low-level API remains compatible');
  c.render().clearMessage();assert.equal(c.render().message,null);
  assert.equal(c.render().save({exercise:next.exercise,settings:next.settings,bpm:80},'scores'),true);
  assert.equal(c.render().message,'savedStudy');assert.equal(JSON.parse(saved.getItem(library.LIBRARY_KEY)).scores.length,2);
  c.render().remove('kept','scores');assert.deepEqual(JSON.parse(saved.getItem(library.LIBRARY_KEY)).scores.map(x=>x.id),['new-2']);assert.equal(c.render().message,null);
});

test('actual storage failure retains the original collection and uses the existing storage error',()=>{
  const saved=storage(),c=collection(saved),before=saved.getItem(library.LIBRARY_KEY);
  saved.setItem=()=>{throw Error('isolated storage failure');};
  assert.equal(c.render().save({exercise:next.exercise,settings:next.settings,bpm:80},'scores'),false);
  assert.equal(c.render().message,'libraryError');assert.equal(saved.getItem(library.LIBRARY_KEY),before);assert.equal(c.render().library.scores.length,1);
});

test('an unavailable initial read cannot overwrite later readable data; a fresh mount and truly empty storage can save',()=>{
  const saved=storage(),read=saved.getItem,raw=saved.getItem(library.LIBRARY_KEY);let denied=true;
  saved.getItem=key=>{if(denied)throw Error('temporarily unavailable');return read(key);};
  const c=collection(saved);assert.equal(c.render().message,'libraryReadUnavailable');assert.equal(c.render().readProtected,true);
  c.render().clearMessage();assert.equal(c.render().message,'libraryReadUnavailable');
  denied=false;
  assert.equal(c.render().save({settings:kept.settings,bpm:80},'presets'),false);c.render().remove('kept','scores');
  assert.equal(saved.getItem(library.LIBRARY_KEY),raw);assert.equal(saved.writes.length,0);
  const reopened=collection(saved);assert.equal(reopened.render().message,null);assert.equal(reopened.render().library.scores.length,1);
  assert.equal(reopened.render().save({settings:kept.settings,bpm:80},'presets'),true);assert.equal(JSON.parse(saved.getItem(library.LIBRARY_KEY)).scores[0].id,'kept');
  for(const absent of [null,'']){
    const empty=storage(absent),fresh=collection(empty);assert.equal(fresh.render().readProtected,false);
    assert.equal(fresh.render().save({exercise:next.exercise,settings:next.settings,bpm:80},'scores'),true);
    assert.equal(JSON.parse(empty.getItem(library.LIBRARY_KEY)).scores.length,1);
  }
});

test('accepted score remains openable through the real App callback while collection writes are protected',()=>{
  const saved=storage(collectionRaw([bad,kept])),c=collection(saved),state=hooks(),forbidden=()=>{throw Error('Saved score cannot generate');};
  const {useExercise}=loadModule('src/hooks/useExercise.ts',1,undefined,{react:state.react,'../music/composeExercise':{composeExercise:forbidden}},{localStorage:saved,window:{matchMedia:forbidden}});
  function ExerciseHookHarness(){return state.render(useExercise);}
  const source=fs.readFileSync('src/App.tsx','utf8'),tree=ts.createSourceFile('App.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let expression;
  function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(tree)==='openStudy')expression=node.initializer.getText(tree);ts.forEachChild(node,visit);}visit(tree);assert.ok(expression);
  let page='home',bpm=0,comparison;const raw=saved.getItem(library.LIBRARY_KEY),accepted=c.render().library.scores[0];
  vm.runInNewContext(ts.transpileModule(`(${expression})`,{compilerOptions:{target:ts.ScriptTarget.ES2023}}).outputText,{collection:c.render(),practice:ExerciseHookHarness(),playback:{stop(){}},setBpm:value=>{bpm=value;},setMode(){},setPage:value=>{page=value;},setDialog(){},setComparison:value=>{comparison=value;},window:{scrollTo(){}}})(accepted);
  assert.deepEqual(plain(ExerciseHookHarness().current.exercise),kept.exercise);assert.equal(bpm,80);assert.equal(page,'practice');assert.equal(c.render().message,'libraryReadProtected');assert.equal(saved.getItem(library.LIBRARY_KEY),raw);
  assert.deepEqual(plain(comparison),{previous:null,showingPrevious:false},'opening a saved study clears only the temporary comparison');
});

test('invalid resume read is distinguishable from absence while old APIs preserve null and original raw',()=>{
  const raw=JSON.stringify({version:1,study:bad,position:2.75}),saved=storage();saved.values.set(resumeApi.LAST_PRACTICE_KEY,raw);
  const loaded=resumeApi.readLastPracticeResult(raw);assert.equal(loaded.last,null);assert.equal(loaded.unreadable,true);
  assert.equal(resumeApi.readLastPractice(raw),null);assert.equal(resumeApi.createResumeStore(()=>saved).read(),null);
  const state=hooks(),forbidden=()=>{throw Error('Inactive resume must not mount timers/listeners');};
  const {usePracticeResume}=loadModule('src/hooks/usePracticeResume.ts',1,source('src/hooks/usePracticeResume.ts'),{react:state.react,'../practice/resume':resumeApi},{window:{localStorage:saved,setInterval:forbidden,addEventListener:forbidden},document:{addEventListener:forbidden}});
  const value=state.render(usePracticeResume,null,false,()=>2.75);
  assert.equal(value.last,null);assert.equal(value.readWarning,true);assert.equal(value.storageWarning,false);assert.equal(saved.getItem(resumeApi.LAST_PRACTICE_KEY),raw);assert.equal(saved.writes.length,0);state.unmount();
  assert.equal(resumeApi.readLastPracticeResult(null).unreadable,false);
  const valid=JSON.stringify({version:1,study:kept,position:2.75});assert.equal(resumeApi.readLastPracticeResult(valid).unreadable,false);assert.equal(resumeApi.readLastPractice(valid).position,2.75);
});

test('resume capture preserves rejected raw while keeping the new session resumable in memory',()=>{
  for(const late of [false,true]){
    const raw=JSON.stringify({version:1,study:bad,position:2.75}),saved=storage(),state=hooks();
    if(!late)saved.values.set(resumeApi.LAST_PRACTICE_KEY,raw);
    const {usePracticeResume}=loadModule('src/hooks/usePracticeResume.ts',1,source('src/hooks/usePracticeResume.ts'),{react:state.react,'../practice/resume':resumeApi},{window:{localStorage:saved,setInterval:()=>1,clearInterval(){},addEventListener(){},removeEventListener(){}},document:{addEventListener(){},removeEventListener(){}}});
    const position=()=>1.5;
    state.render(usePracticeResume,null,false,position);
    if(late)saved.values.set(resumeApi.LAST_PRACTICE_KEY,raw);
    const value=state.render(usePracticeResume,{id:'new-session',bpm:80,settings:next.settings,exercise:next.exercise},true,position);
    assert.equal(value.last.study.id,'new-session');assert.equal(value.last.position,1.5);
    assert.equal(value.readWarning,true);assert.equal(value.storageWarning,false,'unreadable saved content is not a quota error');
    assert.equal(saved.getItem(resumeApi.LAST_PRACTICE_KEY),raw);assert.equal(saved.writes.length,0);state.unmount();
    assert.equal(resumeApi.createResumeStore(()=>saved).write({version:1,study:next,position:2}),false,'store-level guard also protects callers outside the hook');
  }
  const saved=storage(),store=resumeApi.createResumeStore(()=>saved);
  assert.equal(store.write({version:1,study:kept,position:1}),true);
  assert.equal(store.write({version:1,study:next,position:2}),true);
  assert.equal(store.read().study.id,'next');assert.equal(store.read().position,2);
});

test('rejected-data warnings are explicit in all twelve languages and replace misleading ordinary empty copy',()=>{
  for(const locale of localeOrder){
    for(const key of ['libraryReadProtected','libraryReadUnavailable','libraryInvalidScore','libraryUnavailableEmpty']){
      const copy=translate(locale,key);assert.ok(copy&&copy!==key,`${locale}: ${key}`);if(locale!=='en')assert.notEqual(copy,translate('en',key));
    }
    const html=libraryUI(locale)({library:library.emptyLibrary(),message:'libraryReadProtected'});
    assert.match(html,/role="alert"/);assert.ok(html.includes(translate(locale,'libraryReadProtected')));assert.ok(html.includes(translate(locale,'libraryUnavailableEmpty')));assert.ok(!html.includes(translate(locale,'libraryEmpty')));
    const copy=resumeCopy(locale);assert.ok(copy.unreadable);assert.notEqual(copy.unreadable,copy.error);
  }
});
