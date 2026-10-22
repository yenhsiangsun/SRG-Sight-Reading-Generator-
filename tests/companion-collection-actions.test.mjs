import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import {createRequire} from 'node:module';
import {loadModule} from './helpers.mjs';
const require=createRequire(import.meta.url);
const progressApi=loadModule('src/progress/progress.ts');
const growthApi=loadModule('src/progress/companionGrowth.ts');
const {REWARDS,createProgress}=progressApi;
const Picker=()=>null;
function collection(progress){
  const states=[];let cursor=0;const events={redeemed:[],reset:0,stage:0};
  const react={useState(initial){const i=cursor++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return [states[i],next=>{states[i]=typeof next==='function'?next(states[i]):next;}];},useRef:()=>({current:null})};
  const module={exports:{}};
  const source=fs.readFileSync('src/components/StudioDialogs.tsx','utf8').replaceAll('import.meta.env.DEV','false');
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  vm.runInNewContext(code,{module,exports:module.exports,require(name){
    if(name.endsWith('.css'))return {};
    if(name==='react')return react;
    if(name==='react/jsx-runtime')return require(name);
    if(name==='../i18n/context')return {useI18n:()=>({locale:'zh-TW'})};
    if(name==='../progress/progress')return progressApi;
    if(name==='../progress/companionGrowth')return growthApi;
    if(name==='../progress/companionNames')return loadModule('src/progress/companionNames.ts');
    if(name==='../progress/words')return loadModule('src/progress/words.ts');
    if(name==='./CompanionPortrait')return {CompanionPortrait:()=>null};
    if(name==='./CompanionDesignPicker')return {CompanionDesignPicker:Picker};
    throw Error('Unexpected import: '+name);
  }});
  const onSelectStage=()=>{events.stage++;};
  return {events,render(){cursor=0;return module.exports.RewardsDialog({progress,onRedeem:id=>events.redeemed.push(id),onResetPet:()=>events.reset++,onClose(){},onSelectStage});},onSelectStage};
}
function nodes(node){return !node||typeof node!=='object'?[]:[node,...React.Children.toArray(node.props?.children).flatMap(nodes)];}
const tiles=tree=>nodes(tree).filter(n=>n.props?.className==='companion-journal-tile');
const equip=tree=>nodes(tree).find(n=>n.props?.className?.includes('companion-journal-equip'));

test('every existing companion is previewable without spending points or changing a growth selection',()=>{
  const c=collection(createProgress()),tree=c.render();assert.equal(tiles(tree).length,REWARDS.length+1);
  for(let i=0;i<REWARDS.length;i++){
    tiles(c.render())[i+1].props.onClick();const next=c.render();
    assert.equal(tiles(next)[i+1].props['aria-pressed'],true);assert.equal(equip(next).props.disabled,true);
    const picker=nodes(next).find(n=>n.type===Picker);assert.equal(picker.props.pet,REWARDS[i].id);assert.equal(picker.props.onSelectStage,c.onSelectStage);
  }
  assert.deepEqual(c.events,{redeemed:[],reset:0,stage:0});
});

test('the single detail action retains affordability, ownership and the existing redeem callback',()=>{
  const reward=REWARDS[0];
  for(const owned of [false,true]){
    const progress=createProgress();progress.points=owned?0:reward.cost;progress.cosmetics=owned?[...progress.cosmetics,reward.id]:progress.cosmetics;
    const c=collection(progress);tiles(c.render())[1].props.onClick();const tree=c.render();
    assert.equal(equip(tree).props.disabled,false);equip(tree).props.onClick();assert.deepEqual(c.events.redeemed,[reward.id]);
  }
  const progress=createProgress();progress.points=reward.cost-1;const c=collection(progress);tiles(c.render())[1].props.onClick();assert.equal(equip(c.render()).props.disabled,true);
});

test('the free original companion remains selectable and already-equipped actions stay disabled',()=>{
  const progress=createProgress();progress.activePet=REWARDS[0].id;progress.cosmetics.push(REWARDS[0].id);
  const c=collection(progress);assert.equal(equip(c.render()).props.disabled,true);
  tiles(c.render())[0].props.onClick();const tree=c.render();assert.equal(equip(tree).props.disabled,false);equip(tree).props.onClick();
  assert.equal(c.events.reset,1);assert.deepEqual(c.events.redeemed,[]);
});
