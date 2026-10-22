import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadModule} from './helpers.mjs';

const plain=value=>JSON.parse(JSON.stringify(value));
const {MIXED_STAFF_CLEFS,DEFAULT_MIXED_CLEFS,normalizeMixedClefs,validMixedClefs}=loadModule('src/notation/mixedClefs.ts');
const {planMixedStaff,planSingleStaff}=loadModule('src/notation/mixedStaff.ts');
const {mixedRangeClef}=loadModule('src/notation/rangeSelection.ts');
const {ledgerCount}=loadModule('src/notation/octaveLines.ts');
const {midiFromKey}=loadModule('src/music/notePitches.ts');
const {createPlaybackEvents}=loadModule('src/audio/PlaybackController.ts');
const {validSettings,validStudy,emptyLibrary,addStudy,readLibraryResult}=loadModule('src/practice/library.ts');
const {readLastPractice,readLastPracticeResult,createResumeStore}=loadModule('src/practice/resume.ts');
const combinations=Array.from({length:16},(_,mask)=>Array.from(MIXED_STAFF_CLEFS).filter((_,index)=>mask&(1<<index))).filter(value=>value.length>=2);
const invalidChoices=[null,'treble',[],['alto'],['bass','bass'],['treble','alto','alto'],['treble','grand'],['treble','alto','tenor','bass','bass'],[0,'bass']];

function bar(keys,duration='q'){
  const units={q:4,'8':2,'16':1}[duration];
  return {timeSignature:'4/4',totalUnits:keys.length*units,groups:[4,4,4,4],beamGroups:[4,4,4,4],
    events:keys.map((key,index)=>({key,midi:midiFromKey(key),octave:Number(key.split('/')[1]),rest:false,
      duration,dots:0,startUnits:index*units,durationUnits:units}))};
}
function hookState(){
  const values=[];let cursor=0;
  return {reset(){cursor=0;},react:{useState(initial){
    const index=cursor++;if(!(index in values))values[index]=typeof initial==='function'?initial():initial;
    return [values[index],next=>{values[index]=typeof next==='function'?next(values[index]):next;}];
  }}};
}
function exerciseHook(seed=642){
  const state=hookState(),storage=new Map(),writes=[];
  const module=loadModule('src/hooks/useExercise.ts',seed,undefined,{react:state.react},{
    window:{matchMedia:()=>({matches:false})},localStorage:{getItem:key=>storage.get(key)??null,setItem(key,value){writes.push([key,value]);storage.set(key,value);}},
  });
  return {module,writes,render(){state.reset();return module.useExercise({tonic:'C',scaleId:'major'});}};
}
function generate(choices,clef='mixedStaff'){
  const hook=exerciseHook();
  const settings={...hook.module.DEFAULT_SETTINGS,instrument:'Piano',clef,difficulty:'Intermediate',rhythmLevel:'Moderate',
    rangeMinMidi:45,rangeMaxMidi:88,measureCount:8,...(choices===undefined?{}:{mixedClefs:choices})};
  assert.equal(typeof hook.render().generateFrom(settings,80),'number',hook.render().error);
  return {hook,...hook.render().current};
}
let generated;
const selectedStudy=()=>{
  generated??=generate(['tenor','alto']);
  return {id:'selected-clefs',created:1,bpm:generated.exercise.tempo,settings:plain(generated.settings),exercise:plain(generated.exercise)};
};

test('mixed-clef choices accept exactly the eleven distinct two-to-four clef sets and normalize without mutation',()=>{
  assert.deepEqual(Array.from(MIXED_STAFF_CLEFS),['treble','alto','tenor','bass']);
  assert.deepEqual(Array.from(DEFAULT_MIXED_CLEFS),['treble','bass']);
  assert.equal(combinations.length,11);
  assert.equal(validMixedClefs(undefined),true);
  for(const choices of combinations){
    const reversed=Object.freeze([...choices].reverse());
    assert.equal(validMixedClefs(reversed),true);
    assert.deepEqual(Array.from(normalizeMixedClefs(reversed)),choices);
    assert.deepEqual(Array.from(reversed),[...choices].reverse());
  }
  for(const value of invalidChoices){
    assert.equal(validMixedClefs(value),false,JSON.stringify(value));
    assert.deepEqual(Array.from(normalizeMixedClefs(value)),['treble','bass']);
  }
  const first=normalizeMixedClefs();first.push('alto');
  assert.deepEqual(Array.from(normalizeMixedClefs()),['treble','bass'],'callers cannot mutate the default');
});

test('all custom pairs, triples and four-clef plans constrain every note and rest without rewriting music',()=>{
  const measures=[bar(['c/1','e/2','a/2','c/3']),bar(['c/4','d/4','g/4','a/4']),bar(['c/5','e/5','g/6','c/7'])];
  measures[0].events[0].rest=true;measures[2].events[3].rest=true;
  const pitches=['c/3','g/3','e/4'].map(key=>({key,midi:midiFromKey(key),octave:Number(key.split('/')[1])}));
  Object.assign(measures[1].events[0],pitches[0],{chord:pitches});
  const before=plain(measures);
  for(const choices of combinations){
    const plan=planMixedStaff(measures,'treble','4/4',choices);
    assert.equal(plan.clefs.length,measures.length);
    measures.forEach((measure,barIndex)=>measure.events.forEach((_note,eventIndex)=>{
      assert.ok(choices.includes(plan.clefs[barIndex][eventIndex]),JSON.stringify(choices));
      assert.ok([-1,0,1].includes(plan.shifts[barIndex][eventIndex]));
    }));
    assert.deepEqual(plain(planSingleStaff({staffMode:'mixed',clef:'treble',timeSignature:'4/4',mixedClefs:choices},measures)),plain(plan));
    assert.equal(plan.shifts[0][0],0,'leading rest has no octave instruction');
    assert.equal(plan.shifts[2][3],0,'trailing rest has no octave instruction');
  }
  assert.deepEqual(plain(measures),before,'clef planning cannot edit pitches, chords, rests or timing');
});

test('alto and tenor are chosen for their natural registers instead of merely being allowed',()=>{
  for(const [clef,keys,choices] of [
    ['alto',['c/4','d/4','e/4','c/4'],['treble','alto']],
    ['tenor',['a/3','b/3','c/4','a/3'],['treble','tenor']],
  ]){
    const measure=bar(keys),plan=planMixedStaff([measure],'treble','4/4',choices);
    assert.deepEqual(Array.from(plan.clefs[0]),Array(4).fill(clef));
    assert.deepEqual(Array.from(plan.shifts[0]),[0,0,0,0]);
    const selectedCost=keys.reduce((sum,key)=>sum+ledgerCount(key,clef),0);
    assert.ok(selectedCost<keys.reduce((sum,key)=>sum+ledgerCount(key,'treble'),0));
  }
  // Sustained registers justify a change; one-bar alternation may correctly
  // keep one C clef to avoid forcing a disruptive change at every barline.
  const passage=[...Array.from({length:2},()=>bar(['c/3','d/3','e/3','c/3'])),
    ...Array.from({length:2},()=>bar(['c/5','d/5','e/5','c/5']))];
  const plan=planMixedStaff(passage,'treble','4/4',['alto','tenor']);
  assert.deepEqual([...new Set(plan.clefs.flat())].sort(),['alto','tenor'],'a two-C-clef study can actually change between both selected clefs');
  const short=Array.from({length:4},()=>[bar(['c/3','e/3','g/3','c/3']),bar(['c/5','e/5','g/5','c/5'])]).flat(),before=plain(short);
  const shortPlan=planMixedStaff(short,'treble','4/4',['alto','tenor']);
  assert.ok(shortPlan.clefs.flat().every(clef=>['alto','tenor'].includes(clef)),'overlapping short passages need not force both clefs');
  assert.deepEqual(plain(short),before,'keeping one selected clef must not rewrite the short passage');
});

test('range endpoints use only the chosen clefs, including meaningful alto and tenor registers',()=>{
  for(const choices of combinations)for(let midi=21;midi<=108;midi++)assert.ok(choices.includes(mixedRangeClef(midi,choices)));
  assert.equal(mixedRangeClef(60,['treble','alto']),'alto','middle C has fewer ledger lines in alto');
  assert.equal(mixedRangeClef(57,['treble','tenor']),'tenor','A3 sits inside tenor staff');
  assert.equal(mixedRangeClef(76,['alto','tenor']),'alto','upper endpoint favors the higher C clef');
  assert.equal(mixedRangeClef(48,['alto','tenor']),'tenor','lower endpoint favors the lower C clef');
  for(let midi=0;midi<=127;midi++){
    const expected=midi<60?'bass':'treble';
    assert.equal(mixedRangeClef(midi),expected);
    assert.equal(mixedRangeClef(midi,['bass','treble']),expected);
  }
});

test('missing choices and explicit treble/bass retain exact legacy layout decisions',()=>{
  const measures=[bar(['a/2','c/3','e/5','g/5']),bar(['c/1','d/1','e/1','d/1']),bar(['e/6','g/6','a/6','g/6'])];
  const legacy=planMixedStaff(measures);
  assert.deepEqual(plain(planMixedStaff(measures,'treble','4/4',['treble','bass'])),plain(legacy));
  assert.deepEqual(plain(planMixedStaff(measures,'treble','4/4',['bass','treble'])),plain(legacy));
  assert.deepEqual(plain(legacy.clefs),[['bass','bass','treble','treble'],['bass','bass','bass','bass'],['treble','treble','treble','treble']]);
  assert.deepEqual(plain(legacy.shifts),[[0,0,0,0],[-1,-1,-1,-1],[1,1,1,1]]);
  const fixed={staffMode:'fixed',clef:'bass',mixedClefs:['alto','tenor'],timeSignature:'4/4'};
  assert.ok(planSingleStaff(fixed,measures).clefs.flat().every(clef=>clef==='bass'),'stored preferences cannot change a fixed-staff score');
});

test('actual generation adds selected-clef metadata while preserving every musical and playback event',()=>{
  const legacy=generate(undefined);
  assert.equal(Object.hasOwn(legacy.exercise,'mixedClefs'),false,'legacy default omits the new metadata');
  for(const choices of [['treble','bass'],['alto','tenor'],['bass','treble','tenor'],['bass','tenor','alto','treble']]){
    const current=generate(choices),before=plain(current.exercise);
    assert.equal(current.exercise.clef,'treble','composer still receives the legacy mixed-staff engine clef');
    assert.equal(current.exercise.staffMode,'mixed');
    assert.deepEqual(Array.from(current.exercise.mixedClefs),Array.from(normalizeMixedClefs(choices)));
    const {mixedClefs:_choices,...music}=plain(current.exercise);
    assert.deepEqual(music,plain(legacy.exercise),'same-seed accepted music is independent of clef choices');
    assert.deepEqual(plain(createPlaybackEvents(current.exercise,current.exercise.tempo,true)),plain(createPlaybackEvents(legacy.exercise,legacy.exercise.tempo,true)));
    planSingleStaff(current.exercise,current.exercise.measures);
    assert.deepEqual(plain(current.exercise),before);
    assert.ok(validStudy({id:'generated',created:1,bpm:current.exercise.tempo,settings:current.settings,exercise:current.exercise},true));
  }
  for(const clef of ['bass','grand']){
    const current=generate(['alto','tenor'],clef);
    assert.equal(Object.hasOwn(current.exercise,'mixedClefs'),false,'fixed/grand scores do not acquire mixed-staff metadata');
    assert.ok(validStudy({id:clef,created:1,bpm:current.exercise.tempo,settings:current.settings,exercise:current.exercise},true));
  }
});

test('quick overrides and restored settings keep the selected clefs through actual generation',()=>{
  const {hook,exercise,settings}=generate(['alto','tenor']);
  hook.render().restore(plain(exercise),plain(settings));
  assert.deepEqual(Array.from(hook.render().settings.mixedClefs),['alto','tenor']);
  assert.equal(typeof hook.render().generateNew(80,{mixedClefs:['bass','tenor']}),'number');
  const current=hook.render().current;
  assert.deepEqual(Array.from(current.settings.mixedClefs),['tenor','bass']);
  assert.deepEqual(Array.from(current.exercise.mixedClefs),['tenor','bass']);
  assert.ok(planSingleStaff(current.exercise,current.exercise.measures).clefs.flat().every(clef=>['tenor','bass'].includes(clef)));
  hook.render().change('clef','treble');
  assert.equal(typeof hook.render().generateNew(80),'number');
  assert.equal(Object.hasOwn(hook.render().current.exercise,'mixedClefs'),false);
  assert.deepEqual(Array.from(hook.render().current.settings.mixedClefs),['tenor','bass'],'fixed mode retains the preference for later');
});

test('invalid live choices fail generation without replacing the accepted exercise or writing preferences',()=>{
  const {hook,exercise,settings}=generate(['alto','tenor']),writes=hook.writes.length;
  for(const mixedClefs of invalidChoices){
    assert.equal(hook.render().generateNew(80,{mixedClefs}),false,JSON.stringify(mixedClefs));
    assert.equal(hook.render().current.exercise,exercise);
    assert.deepEqual(plain(hook.render().current.settings),plain(settings));
    assert.ok(hook.render().error.length>0);
  }
  assert.equal(hook.writes.length,writes);
});

test('selected-clef studies and presets survive validated library, resume and hook restore round trips',()=>{
  const study=selectedStudy(),library=addStudy(emptyLibrary(),study,'scores');
  const preset={id:'selected-preset',created:2,bpm:study.bpm,settings:study.settings};
  const stored=readLibraryResult(JSON.stringify(addStudy(library,preset,'presets')));
  assert.equal(stored.unreadable,false);assert.deepEqual(plain(stored.library.scores[0]),study);
  assert.deepEqual(plain(stored.library.presets[0].settings.mixedClefs),['alto','tenor']);
  const data=new Map(),store=createResumeStore(()=>({getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)}));
  const snapshot={version:1,study,position:1.5};
  assert.equal(store.write(snapshot),true);
  const resumed=plain(store.read());assert.deepEqual(resumed,snapshot);
  const hook=exerciseHook(981),restored=hook.render().restore(resumed.study.exercise,resumed.study.settings);
  assert.deepEqual(Array.from(restored.mixedClefs),['alto','tenor']);
  assert.deepEqual(plain(planSingleStaff(restored,restored.measures)),plain(planSingleStaff(study.exercise,study.exercise.measures)));
  assert.deepEqual(plain(createPlaybackEvents(restored,study.bpm)),plain(createPlaybackEvents(study.exercise,study.bpm)));
  assert.deepEqual(Array.from(hook.render().current.settings.mixedClefs),['alto','tenor']);
  const legacy=generate(undefined),old={id:'old',created:1,bpm:legacy.exercise.tempo,settings:legacy.settings,exercise:legacy.exercise};
  assert.equal(validStudy(old,true),true);
  assert.equal(readLastPractice(JSON.stringify({version:1,study:old,position:0})).study.exercise.mixedClefs,undefined);
});

test('invalid or inconsistent saved metadata is rejected without silently repairing or persisting it',()=>{
  const study=selectedStudy();
  for(const mixedClefs of invalidChoices)for(const field of ['settings','exercise']){
    const bad=plain(study);bad[field].mixedClefs=mixedClefs;
    assert.equal(validStudy(bad,true),false,field+': '+JSON.stringify(mixedClefs));
    assert.throws(()=>addStudy(emptyLibrary(),bad,'scores'));
    const before=plain(bad),raw=JSON.stringify({version:1,scores:[study,bad],presets:[]}),read=readLibraryResult(raw);
    assert.equal(read.unreadable,true);assert.deepEqual(plain(read.library.scores),[study]);
    assert.deepEqual(bad,before,'rejection cannot silently normalize the supplied study');
    assert.equal(readLastPracticeResult(JSON.stringify({version:1,study:bad,position:0})).unreadable,true);
  }
  const mismatched=plain(study);mismatched.exercise.mixedClefs=['treble','bass'];
  assert.equal(validStudy(mismatched,true),false,'score and settings cannot silently disagree');
  const fixed=plain(study);fixed.exercise.staffMode='fixed';
  assert.equal(validStudy(fixed,true),false,'fixed score cannot carry mixed-layout metadata');
  assert.equal(validSettings({...study.settings,mixedClefs:['alto']}),false);
  const state=hookState(),writes=[];
  const {useLibrary:invokeLibraryHook}=loadModule('src/hooks/useLibrary.ts',1,undefined,{react:state.react},{localStorage:{getItem:()=>null,setItem:(...args)=>writes.push(args)},crypto:{randomUUID:()=> 'new-id'}});
  const render=()=>{state.reset();return invokeLibraryHook();};
  assert.equal(render().save({bpm:study.bpm,settings:study.settings,exercise:mismatched.exercise},'scores'),false);
  assert.equal(render().message,'libraryInvalidScore');assert.equal(writes.length,0);
});

// Actual React SSR runs the real picker (including useId/useContext). Observing
// JSX props lets these Node tests invoke its real callbacks without a DOM, fake
// hooks, browser input, Storage, renderer effects or any audio/device APIs.
function presentation(capture=[]){
  const cache=new Map();
  const runtime={...jsxRuntime};
  for(const key of ['jsx','jsxs'])runtime[key]=(...args)=>{const element=jsxRuntime[key](...args);capture.push(element);return element;};
  function load(relative){
    const file=path.resolve(relative);if(cache.has(file))return cache.get(file).exports;
    const module={exports:{}};cache.set(file,module);
    const output=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023,jsx:ts.JsxEmit.ReactJSX}}).outputText;
    vm.runInNewContext(output,{module,exports:module.exports,require(spec){
      if(spec==='react')return React;if(spec==='react/jsx-runtime')return runtime;if(spec.endsWith('.css'))return {};
      assert.ok(spec.startsWith('.'),'unexpected presentation dependency: '+spec);
      const target=path.resolve(path.dirname(file),spec),resolved=['.ts','.tsx'].map(ext=>target+ext).find(candidate=>fs.existsSync(candidate));
      assert.ok(resolved,'missing presentation module: '+spec);return load(resolved);
    }},{filename:file});return module.exports;
  }
  const {MixedClefPicker}=load('src/components/MixedClefPicker.tsx');
  const {LocalizationContext}=load('src/i18n/context.ts');
  const {translate,localeOrder}=load('src/i18n/messages.ts');
  return {MixedClefPicker,translate,localeOrder,render(props={},locale='en'){
    capture.length=0;
    const html=renderToStaticMarkup(React.createElement(LocalizationContext.Provider,{value:{locale,setLocale(){},t:key=>translate(locale,key)}},React.createElement(MixedClefPicker,props)));
    return {html,buttons:capture.filter(element=>element.type==='button')};
  }};
}

test('real picker SSR renders four localized choices and defaults to treble/bass in all twelve locales',()=>{
  const ui=presentation(),changes=[];
  assert.equal(ui.localeOrder.length,12);
  for(const locale of ui.localeOrder){
    const view=ui.render({onChange:value=>changes.push(value)},locale);
    assert.equal(view.buttons.length,4);
    assert.deepEqual(view.buttons.map(button=>button.props['aria-pressed']),[true,false,false,true]);
    assert.ok(view.html.includes(ui.translate(locale,'mixedClefsTitle')));
    assert.ok(view.html.includes(ui.translate(locale,'mixedClefsHelp')));
    for(const clef of MIXED_STAFF_CLEFS)assert.ok(view.html.includes(ui.translate(locale,clef)),locale+': '+clef);
    assert.match(view.html,/aria-describedby="[^"]+-help"/);
  }
  assert.equal(changes.length,0,'rendering defaults does not write settings');
});

test('real picker callbacks enforce at least two, allow all four and refuse changes while busy',()=>{
  const ui=presentation(),emitted=[];let value=['treble','bass'];
  const props=()=>({value,onChange:next=>{value=Array.from(next);emitted.push(value);}});
  let view=ui.render(props());
  for(const index of [0,3]){assert.equal(view.buttons[index].props['aria-disabled'],true);view.buttons[index].props.onClick();}
  assert.equal(emitted.length,0);assert.deepEqual(value,['treble','bass']);
  view.buttons[1].props.onClick();assert.deepEqual(value,['treble','alto','bass']);
  view=ui.render(props());view.buttons[2].props.onClick();assert.deepEqual(value,['treble','alto','tenor','bass']);
  view=ui.render(props());view.buttons[0].props.onClick();assert.deepEqual(value,['alto','tenor','bass']);
  view=ui.render(props());view.buttons[3].props.onClick();assert.deepEqual(value,['alto','tenor']);
  const count=emitted.length;view=ui.render({...props(),disabled:true});
  assert.match(view.html,/<fieldset[^>]*disabled=""/);
  view.buttons.forEach(button=>button.props.onClick());assert.equal(emitted.length,count);
  assert.ok(emitted.every(choices=>validMixedClefs(choices)));
});

test('a real picker callback reaches the exercise hook and the next accepted study',()=>{
  const ui=presentation(),hook=exerciseHook(817);
  hook.render().change('clef','mixedStaff');
  const view=ui.render({value:hook.render().settings.mixedClefs,onChange:value=>hook.render().change('mixedClefs',value)});
  view.buttons[1].props.onClick();
  assert.deepEqual(Array.from(hook.render().settings.mixedClefs),['treble','alto','bass']);
  assert.equal(typeof hook.render().generateNew(80),'number',hook.render().error);
  const current=hook.render().current;
  assert.deepEqual(Array.from(current.exercise.mixedClefs),['treble','alto','bass']);
  assert.deepEqual(Array.from(current.settings.mixedClefs),['treble','alto','bass']);
  assert.ok(validStudy({id:'picker-study',created:1,bpm:current.exercise.tempo,settings:current.settings,exercise:current.exercise},true));
});

test('actual setup and quick-settings JSX connect the picker to the mixedClefs setting and busy guard',()=>{
  const ui=presentation();
  for(const file of ['src/components/SetupPage.tsx','src/components/PracticeSettings.tsx']){
    const source=fs.readFileSync(file,'utf8'),tree=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
    let picker,condition;
    function visit(node){
      if(ts.isJsxSelfClosingElement(node)&&node.tagName.getText(tree)==='MixedClefPicker'){
        assert.equal(picker,undefined,'one picker in '+file);picker=node;
        for(let parent=node.parent;parent;parent=parent.parent)if(ts.isBinaryExpression(parent)&&parent.operatorToken.kind===ts.SyntaxKind.AmpersandAmpersandToken){condition=parent.left.getText(tree);break;}
      }
      ts.forEachChild(node,visit);
    }
    visit(tree);assert.ok(picker,file+' includes the real picker');assert.match(condition,/\.clef\s*===\s*['"]mixedStaff['"]/);
    const changed=[],bindings={MixedClefPicker:ui.MixedClefPicker,settings:{mixedClefs:['alto','tenor']},draft:{mixedClefs:['alto','tenor']},busy:true,change:(...args)=>changed.push(args)};
    const output=ts.transpileModule(`module.exports=(${picker.getText(tree)});`,{compilerOptions:{target:ts.ScriptTarget.ES2023,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
    const module={exports:{}};vm.runInNewContext(output,{module,exports:module.exports,...bindings,require:spec=>{assert.equal(spec,'react/jsx-runtime');return jsxRuntime;}});
    const props=module.exports.props;
    assert.deepEqual(plain(props.value),['alto','tenor']);props.onChange(['alto','bass']);
    assert.deepEqual(changed,[['mixedClefs',['alto','bass']]]);
    if(file.includes('PracticeSettings'))assert.equal(props.disabled,true);
  }
});
