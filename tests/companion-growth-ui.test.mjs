import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadModule} from './helpers.mjs';

const require = createRequire(import.meta.url);
const cache = new Map();
function component(filename) {
  const absolute = path.resolve(filename);
  if (cache.has(absolute)) return cache.get(absolute).exports;
  const module = {exports: {}};
  cache.set(absolute, module);
  const output = ts.transpileModule(fs.readFileSync(absolute, 'utf8').replaceAll('import.meta.env.BASE_URL', JSON.stringify('/')).replaceAll('import.meta.env.DEV', 'false'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX},
  }).outputText;
  vm.runInNewContext(output, {module, exports: module.exports, require(name) {
    if (name.endsWith('.css')) return {};
    if (!name.startsWith('.')) return require(name);
    const target = path.resolve(path.dirname(absolute), name);
    return component(fs.existsSync(`${target}.tsx`) ? `${target}.tsx` : `${target}.ts`);
  }}, {filename: absolute});
  return module.exports;
}

const {createProgress} = loadModule('src/progress/progress.ts');
const {redeemCompanionStage, selectCompanionStage, getCompanionGrowth} = loadModule('src/progress/companionGrowth.ts');
const {CompanionDesignPicker} = component('src/components/CompanionDesignPicker.tsx');
const render = (progress, pet = null) => renderToStaticMarkup(React.createElement(CompanionDesignPicker, {progress, pet}));

test('growth picker prevents locked forms and permits keeping an unlocked younger form', () => {
  const initial = createProgress();
  const baby = render(initial);
  assert.equal((baby.match(/ disabled=""/g) ?? []).length, 2, 'young and adult remain visible but unselectable');
  assert.ok(baby.includes('兌換 100 星點'));
  assert.equal(baby.includes('分鐘'),false);
  let grown = redeemCompanionStage({...initial,points:1000}, null, 'young');
  grown = redeemCompanionStage(grown, null, 'adult');
  grown = selectCompanionStage(grown, null, 'young');
  const young = render(grown);
  assert.equal((young.match(/ disabled=""/g) ?? []).length, 0, 'all earned appearances remain selectable');
  assert.ok(young.includes('少年<span class="companion-design-check" aria-hidden="true">✓'));
  assert.ok(young.includes('class="companion-growth-auto" aria-pressed="false"'));
});

test('unowned reward previews cannot change growth and no public art picker exposes classic', () => {
  const markup = render(createProgress(), 'pet-musicfox');
  assert.equal((markup.match(/ disabled=""/g) ?? []).length, 3);
  assert.equal(markup.includes('class="companion-growth-auto"'), false);
  assert.ok(markup.includes('先兌換這位小夥伴'));
  assert.equal(markup.includes('經典原版'), false);
  assert.equal(markup.includes('data-design="classic"'), false);
});

test('home shows the form redemption prompt without a star balance, separate point total or time bar',()=>{
 const {NoteCompanion}=component('src/components/NoteCompanion.tsx');
 const state={...createProgress(),points:120},growth=getCompanionGrowth(state,null);
 const markup=renderToStaticMarkup(React.createElement(NoteCompanion,{level:1,points:state.points,todayCount:0,dailyGoal:3,homeGrowth:growth,stage:growth.displayStage,onRewards(){}}));
 assert.equal(markup.includes('可用 120 星點'),false);assert.equal(markup.includes('home-companion-practiced'),false);assert.ok(markup.includes('少年形態可用 100 星點兌換'));
 assert.equal(markup.includes('home-companion-progress'),false);assert.equal(markup.includes('練習點數'),false);assert.equal(markup.includes('分鐘'),false);
});

test('all growth locales use star redemption with no time or separate growth-point placeholders',()=>{
 const {companionGrowthCopy}=loadModule('src/progress/companionGrowthCopy.ts');
 for(const locale of ['zh-TW','en','ja','es','de','fr','ko','pt-BR','ru','it','zh-CN','th']){
  const copy=companionGrowthCopy(locale);assert.ok(copy.practiced.includes('{points}'));assert.ok(copy.redeem.includes('{points}'));assert.ok(copy.next.includes('{stage}'));
  assert.equal(JSON.stringify(copy).includes('{minutes}'),false);
 }
});

test('real picker requires confirmation, cancels safely, rechecks affordability and switches unlocked forms free',()=>{
 const source=fs.readFileSync('src/components/CompanionDesignPicker.tsx','utf8'),module={exports:{}};
 const Portrait=()=>null;
 const growth=loadModule('src/progress/companionGrowth.ts');
 const slots=[],effects=[];let cursor=0;
 const react={useState(initial){const i=cursor++;if(!(i in slots))slots[i]={value:initial};return[slots[i].value,next=>{slots[i].value=typeof next==='function'?next(slots[i].value):next;}];},useRef(value){const i=cursor++;if(!(i in slots))slots[i]={current:value};return slots[i];},useEffect(effect,deps){const i=cursor++,old=slots[i];if(!old||deps.some((value,j)=>value!==old.deps[j])){slots[i]={deps};effects.push(effect);}}};
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 vm.runInNewContext(code,{module,exports:module.exports,require(name){
  if(name.endsWith('.css'))return {};
  if(name==='react')return react;
  if(name==='../progress/companionGrowth')return growth;
  if(name==='../progress/companionGrowthCopy')return loadModule('src/progress/companionGrowthCopy.ts');
  if(name==='../i18n/context')return {useI18n:()=>({locale:'zh-TW'})};
  if(name==='./CompanionPortrait')return {CompanionPortrait:Portrait};
  return require(name);
 }});
 let state={...createProgress(),points:500};
 const visit=node=>!node||typeof node!=='object'?[]:[node,...React.Children.toArray(node.props?.children).flatMap(visit)];
 const view=()=>{cursor=0;const tree=module.exports.CompanionDesignPicker({pet:null,progress:state,onSelectStage:(_pet,stage)=>{state=selectCompanionStage(state,null,stage);},onRedeemStage:(_pet,stage)=>{state=redeemCompanionStage(state,null,stage);}});while(effects.length)effects.shift()();const nodes=visit(tree),panel=nodes.find(n=>n.props?.className==='companion-redemption-confirmation');return {buttons:React.Children.toArray(nodes.find(n=>n.props?.className==='companion-design-options').props.children),confirm:nodes.find(n=>n.props?.className==='companion-redemption-confirm'),cancel:panel&&visit(panel).find(n=>n.type==='button'&&n.props.className===undefined)};};
 const click=button=>button.props.onClick({currentTarget:{focus(){}}});
 let ui=view();assert.equal(ui.buttons[1].props.disabled,false);assert.equal(ui.buttons[2].props.disabled,true);
 click(ui.buttons[2]);assert.equal(state.points,500,'a later form cannot skip its prerequisite');
 click(ui.buttons[1]);ui=view();assert.equal(state.points,500,'choosing a locked form opens a quote without spending');
 const cancelledConfirm=ui.confirm.props.onClick;click(ui.cancel);cancelledConfirm();assert.equal(state.points,500,'cancelled quotes cannot be reused');
 click(view().buttons[1]);ui=view();const confirm=ui.confirm.props.onClick;confirm();confirm();assert.equal(state.points,400,'confirming twice charges once');
 ui=view();assert.equal(ui.buttons[2].props.disabled,false);click(ui.buttons[2]);ui=view();assert.equal(state.points,400);
 state={...state,points:0};ui=view();assert.equal(ui.confirm.props.disabled,true);click(ui.confirm);assert.equal(getCompanionGrowth(state,null).unlockedStage,'young');
 state={...state,points:400};ui=view();click(ui.confirm);assert.equal(state.points,0);
 ui=view();assert.ok(ui.buttons.every(b=>b.props.disabled===false));click(ui.buttons[0]);assert.equal(state.points,0);assert.equal(getCompanionGrowth(state,null).displayStage,'baby');
 const markup=render(state);assert.equal(markup.includes('可用 0 星點'),false,'balance is not repeated beneath the companion');
});
