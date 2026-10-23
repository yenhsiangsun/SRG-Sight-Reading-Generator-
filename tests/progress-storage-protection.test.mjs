import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadModule} from './helpers.mjs';

const KEY='sight-reading-progress-v1',plain=value=>JSON.parse(JSON.stringify(value));
const FIXED_NOW=new Date(2026,9,19,12).getTime();
const {createProgress}=loadModule('src/progress/progress.ts');
const savedProgress=()=>({...plain(createProgress(new Date(FIXED_NOW))),xp:240,points:75,completedSessions:['kept-session'],cosmetics:['pet-orange'],activePet:'pet-orange',companionGrowth:{'pet-orange':{seconds:3600,selectedStage:'baby'}}});

function storage(raw=JSON.stringify(savedProgress())){
  let value=raw,readError=false,writeError=false;
  const writes=[];
  return {writes,get raw(){return value;},set raw(next){value=next;},set readError(next){readError=next;},set writeError(next){writeError=next;},
    getItem(key){assert.equal(key,KEY);if(readError)throw Error('read unavailable');return value;},
    setItem(key,next){assert.equal(key,KEY);if(writeError)throw Error('quota exhausted');writes.push(String(next));value=String(next);}};
}

function hook(saved,allowPreviewTools=false){
  const slots=[],effects=[],microtasks=[],activeEffects=new Map(),listeners=new Map();let cursor=0,dirty=false,now=FIXED_NOW;
  class HookDate extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
  const same=(a,b)=>a&&b&&a.length===b.length&&a.every((value,i)=>Object.is(value,b[i]));
  const react={
    useState(initial){const i=cursor++;if(!(i in slots))slots[i]={value:typeof initial==='function'?initial():initial};return[slots[i].value,next=>{const value=typeof next==='function'?next(slots[i].value):next;if(!Object.is(value,slots[i].value)){slots[i].value=value;dirty=true;}}];},
    useRef(initial){const i=cursor++;if(!(i in slots))slots[i]={current:initial};return slots[i];},
    useCallback(fn,deps){const i=cursor++;if(!(i in slots)||!same(slots[i].deps,deps))slots[i]={deps,value:fn};return slots[i].value;},
    useEffect(effect,deps){const i=cursor++,old=slots[i];if(old&&same(old.deps,deps))return;slots[i]={deps,cleanup:old?.cleanup};activeEffects.set(i,effect);effects.push(()=>{slots[i].cleanup?.();slots[i].cleanup=effect();});},
  };
  const source=fs.readFileSync(process.env.PROGRESS_BEFORE_SOURCE??'src/progress/useProgress.ts','utf8');
  const {useProgress:invokeProgressHook}=loadModule('src/progress/useProgress.ts',1,source,{react},{Date:HookDate,localStorage:saved,queueMicrotask:fn=>microtasks.push(fn),setInterval:()=>1,clearInterval(){},window:{addEventListener:(name,listener)=>listeners.set(name,listener),removeEventListener:name=>listeners.delete(name)}});
  // Modeled Node hooks and cleanup, not actual React or browser StrictMode.
  return {render(flush=true){let value,turn=0;do{assert.ok(turn++<15);cursor=0;dirty=false;value=invokeProgressHook(allowPreviewTools);while(effects.length)effects.shift()();if(flush)while(microtasks.length)microtasks.shift()();}while(dirty);return value;},flush(){while(microtasks.length)microtasks.shift()();},replayEffects(){for(const [i,effect]of activeEffects){slots[i].cleanup?.();slots[i].cleanup=effect();}},advanceDay(){now+=86400000;listeners.get('focus')?.();},unmount(){for(const slot of slots)slot?.cleanup?.();}};
}

test('an initial progress read failure preserves the original save after writes recover',()=>{
  const saved=storage(),raw=saved.raw;saved.readError=true;
  const h=hook(saved,true);let current=h.render();
  assert.equal(current.storageWarning,true);assert.equal(current.state.xp,0);assert.equal(saved.writes.length,0);
  saved.readError=false;current.complete('in-memory');current.grantPreviewPoints();current.selectStage(null,'baby');
  current=h.render();
  assert.equal(current.state.xp,20);assert.equal(current.state.points,10000);assert.equal(current.state.companionGrowth.original.seconds,0);
  assert.equal(current.storageWarning,true);assert.equal(saved.raw,raw);assert.equal(saved.writes.length,0);h.unmount();
});

test('malformed or unsupported progress envelopes are retained through current-session changes',()=>{
  for(const raw of ['{bad','', 'null','[]','"progress"','{}','{"version":2,"xp":240,"future":"keep"}']){
    const saved=storage(raw),h=hook(saved);let current=h.render();
    assert.equal(current.storageWarning,true,raw);current.complete('temporary');current=h.render();
    assert.equal(current.state.xp,20,raw);assert.equal(saved.raw,raw,raw);assert.equal(saved.writes.length,0,raw);h.unmount();
  }
});

test('read protection stays for this mount; a fresh valid read restores normal persistence',()=>{
  const saved=storage('{broken'),h=hook(saved);let current=h.render();
  saved.raw=JSON.stringify(savedProgress());const repairedOutside=saved.raw;
  current.complete('temporary');current=h.render();
  assert.equal(current.storageWarning,true);assert.equal(saved.raw,repairedOutside);assert.equal(saved.writes.length,0);h.unmount();
  const fresh=hook(saved);current=fresh.render();
  assert.equal(current.storageWarning,false);assert.equal(current.state.xp,240);assert.equal(current.state.activePet,'pet-orange');
  current.selectStage('pet-orange','young');current.selectStage('pet-orange','young');current=fresh.render();
  const persisted=JSON.parse(saved.raw);
  assert.equal(current.storageWarning,false);assert.equal(persisted.companionGrowth['pet-orange'].seconds,3600);assert.equal(persisted.companionGrowth['pet-orange'].selectedStage,'young');
  assert.equal(persisted.points,75);assert.ok(saved.writes.length>=2);fresh.unmount();
});

test('a missing progress key creates normal persistent progress and preserves completion identity on reload',()=>{
  const saved=storage(null),h=hook(saved);let current=h.render();
  assert.equal(current.storageWarning,false);assert.equal(saved.writes.length,1);
  current.complete('first-score');current=h.render();assert.equal(current.state.xp,20);h.unmount();
  const fresh=hook(saved);current=fresh.render();current.complete('first-score');current=fresh.render();
  assert.equal(current.state.xp,20);assert.deepEqual(Array.from(current.state.completedSessions),['first-score']);fresh.unmount();
});

test('supported legacy progress keeps normalization and one-time retired-color migration',()=>{
  const legacy={...savedProgress(),points:100,cosmetics:['amber','amber','mint','pet-orange'],activeAccent:'amber'};
  delete legacy.companionGrowth;
  const saved=storage(JSON.stringify(legacy,null,2)),h=hook(saved);let current=h.render();
  assert.equal(current.storageWarning,false);assert.equal(current.state.xp,240);assert.equal(current.state.points,160);
  assert.deepEqual(Array.from(current.state.cosmetics),['pet-orange']);assert.equal(current.state.activePet,'pet-orange');
  assert.deepEqual(plain(current.state.companionGrowth),{});h.unmount();
  const fresh=hook(saved);current=fresh.render();assert.equal(current.state.points,160);assert.equal(current.state.xp,240);fresh.unmount();
});

test('ordinary write failure keeps current progress and can retry after quota recovery',()=>{
  const saved=storage(),original=saved.raw;saved.writeError=true;
  const h=hook(saved);let current=h.render();assert.equal(current.storageWarning,true);assert.equal(saved.raw,original);
  current.complete('new-score');current=h.render();assert.equal(current.state.xp,260);assert.equal(saved.raw,original);
  saved.writeError=false;current.selectStage('pet-orange','young');current=h.render();
  assert.equal(current.storageWarning,false);assert.equal(JSON.parse(saved.raw).xp,260);assert.equal(JSON.parse(saved.raw).companionGrowth['pet-orange'].seconds,3600);h.unmount();
});

test('later valid external progress is preserved while new progress stays in memory',()=>{
  const saved=storage(),h=hook(saved);let current=h.render();
  const external=JSON.stringify({...savedProgress(),xp:900,completedSessions:['external-score']});saved.raw=external;
  current.complete('temporary-score');current=h.render();
  assert.equal(saved.raw,external);assert.equal(current.state.xp,260);assert.ok(current.state.completedSessions.includes('temporary-score'));
  assert.equal(current.storageWarning,true);assert.equal(current.storageConflict,true);
  current.selectStage('pet-orange','young');current=h.render();
  assert.equal(saved.raw,external);assert.equal(current.state.companionGrowth['pet-orange'].seconds,3600);assert.equal(current.storageConflict,true);h.unmount();
});

test('external malformed, future, deleted or differently formatted raw is never silently replaced',()=>{
  for(const external of ['{external-broken','{"version":2,"xp":900,"future":"preserve"}',null,JSON.stringify(savedProgress(),null,2)]){
    const saved=storage(),h=hook(saved);let current=h.render();saved.raw=external;
    current.complete('temporary-score');current=h.render();
    assert.equal(saved.raw,external);assert.equal(current.state.xp,260);assert.equal(current.storageWarning,true);assert.equal(current.storageConflict,true);h.unmount();
  }
});

test('external saves appearing before the first queued write are retained, including a previously absent key',()=>{
  for(const initial of [JSON.stringify(savedProgress()),null]){
    const saved=storage(initial),h=hook(saved);h.render(false);
    const external=JSON.stringify({...savedProgress(),xp:900});saved.raw=external;
    h.flush();const current=h.render();
    assert.equal(saved.raw,external);assert.equal(current.storageWarning,true);assert.equal(current.storageConflict,true);assert.equal(saved.writes.length,0);h.unmount();
  }
});

test('a transient read failure before writing preserves raw and retries on a later mutation',()=>{
  const saved=storage(),h=hook(saved);let current=h.render();const original=saved.raw;
  saved.readError=true;current.complete('pending-score');current=h.render();
  assert.equal(saved.raw,original);assert.equal(current.state.xp,260);assert.equal(current.storageWarning,true);assert.equal(current.storageConflict,false);
  saved.readError=false;current.selectStage('pet-orange','young');current=h.render();
  assert.equal(current.storageWarning,false);assert.equal(current.storageConflict,false);assert.equal(JSON.parse(saved.raw).xp,260);assert.equal(JSON.parse(saved.raw).companionGrowth['pet-orange'].seconds,3600);h.unmount();
});

test('restoring the exact expected raw permits retry; a fresh mount instead adopts external data',()=>{
  const saved=storage(),h=hook(saved);let current=h.render();const expected=saved.raw;
  const external=JSON.stringify({...savedProgress(),xp:900,completedSessions:['external-score']});saved.raw=external;
  current.complete('temporary-score');current=h.render();assert.equal(saved.raw,external);assert.equal(current.storageConflict,true);
  saved.raw=expected;current.selectStage('pet-orange','young');current=h.render();
  assert.equal(current.storageWarning,false);assert.equal(current.storageConflict,false);assert.equal(JSON.parse(saved.raw).xp,260);
  saved.raw=external;current.selectStage('pet-orange','baby');current=h.render();assert.equal(current.storageConflict,true);h.unmount();
  const fresh=hook(saved);current=fresh.render();
  assert.equal(current.state.xp,900);assert.deepEqual(Array.from(current.state.completedSessions),['external-score']);assert.equal(current.storageWarning,false);assert.equal(current.storageConflict,false);fresh.unmount();
});

test('successful own writes advance the expected raw across completions, growth and stage selection',()=>{
  const saved=storage(),h=hook(saved);let current=h.render();
  current.complete('first-score');current=h.render();current.complete('second-score');current=h.render();
  current.selectStage('pet-orange','young');current.selectStage('pet-orange','young');current=h.render();
  const persisted=JSON.parse(saved.raw);
  assert.equal(persisted.xp,280);assert.equal(persisted.points,95);assert.deepEqual(persisted.completedSessions,['kept-session','first-score','second-score']);
  assert.deepEqual(persisted.companionGrowth['pet-orange'],{seconds:3600,unlockedStage:'young',selectedStage:'young'});assert.equal(current.storageWarning,false);h.unmount();
});

test('calendar rollover preserves progress and permits the next day to be saved',()=>{
  const saved=storage(),h=hook(saved);let current=h.render();current.complete('day-one');current=h.render();
  h.advanceDay();current=h.render();assert.equal(current.state.today.count,0);assert.equal(JSON.parse(saved.raw).today.count,0);
  current.complete('day-two');current=h.render();
  assert.equal(JSON.parse(saved.raw).xp,280);assert.equal(JSON.parse(saved.raw).today.count,1);assert.equal(current.storageWarning,false);h.unmount();
});

test('modeled effect replay and superseded queued writes preserve the latest state without false conflict',()=>{
  const saved=storage(),h=hook(saved);let current=h.render(false);h.replayEffects();
  current.complete('first-score');current=h.render(false);current.complete('second-score');current=h.render(false);
  h.flush();current=h.render();
  assert.equal(JSON.parse(saved.raw).xp,280);assert.deepEqual(JSON.parse(saved.raw).completedSessions,['kept-session','first-score','second-score']);
  assert.equal(current.storageWarning,false);assert.equal(saved.writes.length,1);h.unmount();
});

test('unmount cancels a queued write and preview-only actions remain gated',()=>{
  const saved=storage(),raw=saved.raw,h=hook(saved);const current=h.render(false);
  assert.equal(current.grantPreviewPoints,undefined);h.unmount();h.flush();
  assert.equal(saved.raw,raw);assert.equal(saved.writes.length,0);
  const preview=hook(saved,true);let next=preview.render();next.grantPreviewPoints();next=preview.render();
  assert.equal(next.state.points,10000);assert.equal(JSON.parse(saved.raw).points,10000);preview.unmount();
});

test('stage redemption persists wallet deduction and unlocked form together, and reload cannot charge again',()=>{
 const baseline={...savedProgress(),points:500,companionGrowth:{'pet-orange':{seconds:0,selectedStage:null}}};
 const saved=storage(JSON.stringify(baseline)),h=hook(saved);let current=h.render();
 current.redeemStage('pet-orange','young');current.redeemStage('pet-orange','young');current=h.render();
 let persisted=JSON.parse(saved.raw);assert.equal(persisted.points,400);assert.equal(persisted.companionGrowth['pet-orange'].unlockedStage,'young');
 current.redeemStage('pet-orange','adult');current=h.render();persisted=JSON.parse(saved.raw);
 assert.equal(persisted.points,0);assert.equal(persisted.companionGrowth['pet-orange'].unlockedStage,'adult');assert.equal(persisted.xp,240);
 h.unmount();const fresh=hook(saved);current=fresh.render();current.redeemStage('pet-orange','adult');current.selectStage('pet-orange','baby');current=fresh.render();
 assert.equal(current.state.points,0);assert.equal(current.state.companionGrowth['pet-orange'].selectedStage,'baby');assert.equal(current.state.companionGrowth['pet-orange'].unlockedStage,'adult');fresh.unmount();
});

test('a failed or conflicting redemption write preserves the saved wallet and reports the unsaved in-memory form',()=>{
 for(const conflict of [false,true]){
  const saved=storage(JSON.stringify({...savedProgress(),points:500,companionGrowth:{}})),h=hook(saved);let current=h.render();
  const prior=saved.raw;if(conflict)saved.raw=JSON.stringify({...savedProgress(),points:900});else saved.writeError=true;
  const protectedRaw=saved.raw;current.redeemStage('pet-orange','young');current=h.render();
  assert.equal(current.state.points,400);assert.equal(current.state.companionGrowth['pet-orange'].unlockedStage,'young');
  assert.equal(saved.raw,protectedRaw);assert.equal(current.storageWarning,true);assert.equal(current.storageConflict,conflict);
  if(!conflict){saved.writeError=false;current.selectStage('pet-orange','baby');current=h.render();assert.equal(JSON.parse(saved.raw).points,400);assert.equal(current.storageWarning,false);}
  assert.ok(prior);h.unmount();
 }
});
