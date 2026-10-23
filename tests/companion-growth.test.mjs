import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {loadModule} from './helpers.mjs';
const {createProgress,normalizeProgress,recordPractice,redeemReward,unequipPet,PET_IDS,REWARDS}=loadModule('src/progress/progress.ts');
const {getCompanionGrowth,redeemCompanionStage,selectCompanionStage,COMPANION_STAGE_COST}=loadModule('src/progress/companionGrowth.ts');
const date=new Date(2026,9,13,12),plain=value=>JSON.parse(JSON.stringify(value));

test('stages require explicit star redemption in order, charge once and keep free appearance switching',()=>{
 const initial={...createProgress(date),points:1000};
 assert.deepEqual(plain(getCompanionGrowth(initial,null)),{unlockedStage:'baby',selectedStage:null,displayStage:'baby',nextStage:'young',nextCost:100});
 assert.equal(selectCompanionStage(initial,null,'young'),initial);
 assert.equal(redeemCompanionStage(initial,null,'adult'),initial,'the previous form must be unlocked first');
 let state=redeemCompanionStage(initial,null,'young');
 assert.equal(state.points,900);assert.equal(getCompanionGrowth(state,null).displayStage,'young');
 assert.equal(redeemCompanionStage(state,null,'young'),state,'duplicate redemption cannot charge again');
 state=redeemCompanionStage(state,null,'adult');
 assert.equal(state.points,1000-COMPANION_STAGE_COST.young-COMPANION_STAGE_COST.adult);
 assert.equal(getCompanionGrowth(state,null).unlockedStage,'adult');assert.equal(getCompanionGrowth(state,null).nextStage,null);
 state=selectCompanionStage(state,null,'baby');
 const balance=state.points;
 assert.equal(getCompanionGrowth(state,null).displayStage,'baby');
 state=normalizeProgress(plain(state),date);assert.equal(getCompanionGrowth(state,null).selectedStage,'baby');
 assert.equal(getCompanionGrowth(selectCompanionStage(state,null,null),null).displayStage,'adult');
 assert.equal(state.points,balance);assert.equal(initial.points,1000);assert.deepEqual(plain(initial.companionGrowth),{});
});

test('wallet balance, completing practice and midnight never auto-unlock a form',()=>{
 let state={...createProgress(date),points:10000};
 for(let i=0;i<5;i++)state=recordPractice(state,'score-'+i,date).state;
 assert.equal(state.points,10030);assert.equal(state.xp,60);assert.equal(getCompanionGrowth(state,null).displayStage,'baby');
 state=recordPractice(state,'score-0',new Date(2026,9,14,12)).state;
 assert.equal(state.points,10030);assert.equal(getCompanionGrowth(state,null).displayStage,'baby');
 assert.deepEqual(plain(state.companionGrowth),{});assert.equal('points' in getCompanionGrowth(state,null),false);
});

test('redemption uses the shared wallet, belongs to the chosen owned pet and leaves XP and practice identity intact',()=>{
 let state={...createProgress(date),points:1000,xp:240};
 state=redeemCompanionStage(state,null,'young');state=redeemReward(state,'pet-husky',date).state;
 state=redeemCompanionStage(state,'pet-husky','young');
 assert.equal(state.points,720);assert.equal(getCompanionGrowth(state,null).unlockedStage,'young');
 assert.equal(getCompanionGrowth(state,'pet-husky').unlockedStage,'young');assert.equal(getCompanionGrowth(state,'pet-calico').unlockedStage,'baby');
 const prior=plain(state);state=selectCompanionStage(state,'pet-husky','baby');
 const restored=normalizeProgress(plain(unequipPet(state,date)),date);
 assert.equal(restored.activePet,null);assert.equal(restored.xp,240);assert.equal(restored.points,720);
 assert.deepEqual(plain(restored.completedSessions),prior.completedSessions);assert.equal(getCompanionGrowth(restored,'pet-husky').displayStage,'baby');
});

test('old saves preserve earned forms and appearance choices without charging or inventing points',()=>{
 const legacy={...createProgress(date),xp:240,points:80,cosmetics:['pet-nocturne','pet-husky'],activePet:'pet-nocturne',companionGrowth:{
  original:{seconds:50,selectedStage:'adult'},'pet-nocturne':{seconds:1900.1234,selectedStage:'young'},
  'pet-husky':{seconds:10800,selectedStage:'baby'},'pet-calico':{seconds:999999,selectedStage:'adult'},unknown:{seconds:999999}}};
 const repaired=normalizeProgress(legacy,date);
 assert.deepEqual(Object.keys(repaired.companionGrowth).sort(),['original','pet-husky','pet-nocturne']);
 assert.equal(repaired.points,80);assert.equal(repaired.xp,240);assert.equal(getCompanionGrowth(repaired,null).selectedStage,null);
 assert.equal(repaired.companionGrowth['pet-nocturne'].seconds,1900.123);
 assert.equal(getCompanionGrowth(repaired,'pet-nocturne').displayStage,'young');
 assert.equal(getCompanionGrowth(repaired,'pet-husky').unlockedStage,'adult');assert.equal(getCompanionGrowth(repaired,'pet-husky').displayStage,'baby');
 assert.deepEqual(plain(normalizeProgress(plain(repaired),date)),plain(repaired));
 assert.equal(redeemCompanionStage(repaired,'pet-nocturne','young'),repaired,'old unlocked forms are not charged again');
 const next=recordPractice(repaired,'new-practice',date).state;
 assert.equal(next.companionGrowth['pet-nocturne'].seconds,1900.123,'new completions never add archived time');
 assert.equal(next.points,90);assert.equal(getCompanionGrowth(next,'pet-nocturne').unlockedStage,'young');
});

test('insufficient stars, unowned pets, invalid stages and corrupt counters cannot spend or unlock',()=>{
 const initial=createProgress(date);
 assert.equal(redeemCompanionStage({...initial,points:99},null,'young').points,99);
 for(const points of [-1,.5,NaN,Infinity,'100']){const state={...initial,points};assert.equal(redeemCompanionStage(state,null,'young'),state);}
 const funded={...initial,points:10000};
 for(const stage of ['baby','unknown',null,'adult'])assert.equal(redeemCompanionStage(funded,null,stage),funded);
 assert.equal(redeemCompanionStage(funded,'pet-husky','young'),funded);
 assert.equal(selectCompanionStage(funded,'pet-husky','baby'),funded);assert.equal(selectCompanionStage(funded,null,'unknown'),funded);
 for(const seconds of [-1,NaN,Infinity,'1800']){
  const state=normalizeProgress({...initial,companionGrowth:{original:{seconds,unlockedStage:'unknown',selectedStage:'young'}}},date);
  assert.equal(getCompanionGrowth(state,null).unlockedStage,'baby');assert.equal(getCompanionGrowth(state,null).selectedStage,null);
 }
});

test('all companions retain independent unlocked forms and owned-pet switching never charges twice',()=>{
 let state={...createProgress(date),points:100000};
 for(const id of PET_IDS){const reward=REWARDS.find(r=>r.id===id);assert.ok(reward);
  state=redeemReward(state,id,date).state;assert.equal(getCompanionGrowth(state,id).displayStage,'baby');
  state=redeemCompanionStage(state,id,'young');state=normalizeProgress(plain(state),date);
  assert.equal(getCompanionGrowth(state,id).displayStage,'young');const balance=state.points;
  state=redeemReward(state,id,date).state;assert.equal(state.points,balance);
 }
 assert.equal(getCompanionGrowth(state,null).displayStage,'baby');
});

test('App uses a completion-only foreground clock and explicitly connects star redemption',()=>{
 const source=fs.readFileSync('src/App.tsx','utf8'),tree=ts.createSourceFile('App.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),calls=[];
 function visit(node){if(ts.isCallExpression(node)&&node.expression.getText(tree)==='usePracticeClock')calls.push(node);ts.forEachChild(node,visit);}visit(tree);
 assert.equal(calls.length,1);assert.equal(calls[0].arguments.length,2);
 assert.match(calls[0].arguments[1].getText(tree),/page==='practice'/);assert.match(calls[0].arguments[1].getText(tree),/!dialog/);
 assert.doesNotMatch(source,/addPracticeTime|creditCompanionTime/);assert.match(source,/onRedeemStage=\{growth\.redeemStage\}/);
});
