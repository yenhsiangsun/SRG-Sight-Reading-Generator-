import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createRequire} from 'node:module';
import {loadModule} from './helpers.mjs';

const require=createRequire(import.meta.url);
const {translate,localeOrder}=loadModule('src/i18n/messages.ts');
const {instrumentLabel,scaleLabel}=loadModule('src/i18n/musicLabels.ts');
const settings={instrument:'Piano',clef:'grand',difficulty:'Beginner',rhythmLevel:'Simple',keySignature:'C',tonic:'C',scaleId:'major',timeSignature:'4/4',measureCount:8,rangeMinMidi:48,rangeMaxMidi:84,allowAccidentals:false,mixedMeters:false,meters:['4/4','6/8']};
const preset={id:'first',created:Date.UTC(2026,9,19,9,0,0),bpm:72,settings};
const empty=()=>({version:1,scores:[],presets:[]});

function stateHarness(){
  const states=[];let cursor=0;
  return {reset(){cursor=0;},react:{useRef(value){return {current:value};},useState(initial){
    const index=cursor++;
    if(!(index in states))states[index]=typeof initial==='function'?initial():initial;
    return [states[index],next=>{states[index]=typeof next==='function'?next(states[index]):next;}];
  }}};
}

// Exercise the real tab and action callbacks without adding a DOM dependency.
// Shared modal presentation is tested by the browser audit, not duplicated here.
function libraryUI(locale='en'){
  const state=stateHarness(),module={exports:{}};
  const output=ts.transpileModule(fs.readFileSync('src/components/PracticeTools.tsx','utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023,jsx:ts.JsxEmit.ReactJSX},
  }).outputText;
  vm.runInNewContext(output,{module,exports:module.exports,require(name){
    if(name.endsWith('.css'))return {};
    if(name==='react')return state.react;
    if(name==='react/jsx-runtime')return require(name);
    if(name==='../i18n/context')return {useI18n:()=>({locale,t:key=>translate(locale,key)})};
    if(name==='../i18n/musicLabels')return {instrumentLabel,scaleLabel};
    if(name==='../music/scales')return loadModule('src/music/scales.ts');
    if(name==='../audio/tempo')return loadModule('src/audio/tempo.ts');
    if(name==='../practice/focus')return loadModule('src/practice/focus.ts');
    if(name==='../notation/mixedClefs')return loadModule('src/notation/mixedClefs.ts');
    if(name==='../practice/librarySearch')return loadModule('src/practice/librarySearch.ts');
    if(name==='./StudioDialogs')return {StudioDialog:({title,children})=>React.createElement('section',{'aria-label':title},children)};
    throw Error('Unexpected import: '+name);
  }},{filename:'src/components/PracticeTools.tsx'});
  return {render(props={}){
    state.reset();
    const tree=module.exports.LibraryDialog({library:empty(),onOpen(){},onRemove(){},onClose(){},...props});
    return {tree,html:renderToStaticMarkup(tree)};
  }};
}

function elements(node){
  if(!node||typeof node!=='object')return [];
  return [node,...React.Children.toArray(node.props?.children).flatMap(elements)];
}
const buttons=tree=>elements(tree).filter(node=>node.type==='button');
const text=node=>node==null?'':typeof node==='object'?React.Children.toArray(node.props?.children).map(text).join(''):String(node);
function selectPresets(ui,props={}){
  const view=ui.render(props);
  buttons(view.tree).find(button=>text(button).startsWith(translate('en','savedPresets'))).props.onClick();
  return ui.render(props);
}

test('each library tab explains its actual save path in every supported language',()=>{
  for(const locale of localeOrder){
    const ui=libraryUI(locale),scores=ui.render();
    assert.ok(scores.html.includes(translate(locale,'libraryEmpty')),locale);
    const tabs=buttons(scores.tree);
    tabs.find(button=>text(button).startsWith(translate(locale,'savedPresets'))).props.onClick();
    const presets=ui.render();
    assert.ok(presets.html.includes(translate(locale,'libraryPresetEmpty')),locale);
    assert.ok(!presets.html.includes(translate(locale,'libraryEmpty')),locale);
    assert.match(presets.html,/aria-pressed="true"/);
  }
});

test('search filters the current shelf, opens the original object and clears without changing saves',()=>{
  const flute={...preset,id:'flute',settings:{...settings,instrument:'Flute',clef:'treble'}};
  const library={...empty(),presets:[preset,flute]},saved=JSON.stringify(library),opened=[];
  const props={library,onOpen:study=>opened.push(study)},ui=libraryUI();
  let view=selectPresets(ui,props);
  elements(view.tree).find(node=>node.type==='input'&&node.props.type==='search').props.onChange({target:{value:'flute simple'}});
  view=ui.render(props);
  assert.ok(!view.html.includes('<h3>Piano'));
  buttons(view.tree).find(node=>node.props['aria-label']?.startsWith(translate('en','openStudy'))).props.onClick();
  assert.equal(opened[0],flute);
  assert.equal(opened[0].bpm,72);
  elements(view.tree).find(node=>node.type==='input').props.onChange({target:{value:'no-such-study'}});
  view=ui.render(props);
  assert.ok(view.html.includes(translate('en','librarySearchEmpty')));
  buttons(view.tree).find(node=>text(node)===translate('en','clearInstrumentSearch')).props.onClick();
  view=ui.render(props);
  assert.equal(buttons(view.tree).filter(node=>node.props['aria-label']?.startsWith(translate('en','openStudy'))).length,2);
  assert.equal(JSON.stringify(library),saved);
});

test('library modal announces storage failures and capacity errors, never a stale success',()=>{
  for(const message of ['libraryError','libraryFull']){
    const {html}=libraryUI().render({message});
    assert.match(html,/role="alert"/);
    assert.ok(html.includes(translate('en',message)));
  }
  for(const message of ['savedStudy','savedPreset',null,undefined]){
    const {html,tree}=libraryUI().render({message});
    assert.doesNotMatch(html,/role="alert"/);
    for(const key of ['savedStudy','savedPreset'])assert.ok(!elements(tree).some(node=>node.type==='p'&&text(node)===translate('en',key)));
  }
});

test('same-instrument saved setups show both difficulty dimensions and distinct dated actions',()=>{
  const second={...preset,id:'second',created:preset.created+20_000,settings:{...settings,difficulty:'Advanced',rhythmLevel:'Complex'}};
  const library={...empty(),presets:[preset,second]},opened=[],removed=[];
  const props={library,onOpen:study=>opened.push(study.id),onRemove:(id,kind)=>removed.push([id,kind])};
  const ui=libraryUI(),view=selectPresets(ui,props);
  for(const key of ['pitchDifficulty','rhythm','beginner','advanced','simple','complex'])assert.ok(view.html.includes(translate('en',key)),key);
  const actions=buttons(view.tree).filter(button=>button.props['aria-label']);
  assert.equal(actions.length,4);
  assert.equal(new Set(actions.map(button=>button.props['aria-label'])).size,4,'same-day saves remain distinguishable by creation time');
  for(const button of actions){
    assert.ok(button.props['aria-label'].includes(instrumentLabel('Piano','en')));
    assert.ok(button.props['aria-label'].includes('2026'));
    button.props.onClick();
  }
  assert.deepEqual(opened,['first','second']);
  assert.deepEqual(removed,[['first','presets'],['second','presets']]);
  assert.ok(view.html.includes(new Date(preset.created).toISOString()));
  // Existing persisted validation accepts all safe-integer timestamps. An old
  // malformed timestamp must not make the entire library impossible to open.
  assert.doesNotThrow(()=>selectPresets(libraryUI(),{library:{...empty(),presets:[{...preset,created:Number.MAX_SAFE_INTEGER}]}}));
});

test('mixed-staff saved setups identify the selected clefs, including legacy defaults',()=>{
  for(const choices of [undefined,['alto','tenor'],['treble','alto','tenor','bass']]){
    const selected=choices??['treble','bass'];
    const study={...preset,settings:{...settings,clef:'mixedStaff',...(choices?{mixedClefs:choices}:{})}};
    const view=selectPresets(libraryUI(),{library:{...empty(),presets:[study]}});
    assert.ok(view.html.includes(translate('en','mixedStaff')));
    for(const clef of ['treble','alto','tenor','bass'])assert.equal(view.html.includes(translate('en',clef)),selected.includes(clef));
  }
});

test('failed removal retains the saved item and surfaces an in-dialog retry error; recovery clears it',()=>{
  const hookState=stateHarness();let blocked=true,stored=JSON.stringify({...empty(),presets:[preset]});
  const {useLibrary}=loadModule('src/hooks/useLibrary.ts',1,undefined,{react:hookState.react},{localStorage:{
    getItem:()=>stored,
    setItem(_key,value){if(blocked)throw Error('Storage denied');stored=value;},
  }});
  function LibraryHookHarness(){hookState.reset();return useLibrary();}
  const draw=LibraryHookHarness;
  let collection=draw();
  const ui=libraryUI();
  let props={library:collection.library,message:collection.message,onRemove:collection.remove};
  let view=selectPresets(ui,props);
  buttons(view.tree).find(button=>button.props['aria-label']?.startsWith(translate('en','removeStudy'))).props.onClick();
  collection=draw();
  props={library:collection.library,message:collection.message,onRemove:collection.remove};
  view=ui.render(props);
  assert.equal(collection.library.presets.length,1);
  assert.equal(JSON.parse(stored).presets.length,1);
  assert.match(view.html,/role="alert"/);
  assert.ok(view.html.includes(translate('en','libraryError')));
  blocked=false;
  buttons(view.tree).find(button=>button.props['aria-label']?.startsWith(translate('en','removeStudy'))).props.onClick();
  collection=draw();
  view=ui.render({library:collection.library,message:collection.message,onRemove:collection.remove});
  assert.equal(collection.library.presets.length,0);
  assert.equal(JSON.parse(stored).presets.length,0);
  assert.doesNotMatch(view.html,/role="alert"/);
  assert.ok(view.html.includes(translate('en','libraryPresetEmpty')));
});
