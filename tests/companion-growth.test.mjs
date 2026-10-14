import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

const {createProgress,normalizeProgress,recordPractice,redeemReward,unequipPet,PET_IDS,REWARDS}=loadModule('src/progress/progress.ts');
const {getCompanionGrowth,recordCompanionPractice,selectCompanionStage}=loadModule('src/progress/companionGrowth.ts');
const date=new Date(2026,9,13,12);
const plain=value=>JSON.parse(JSON.stringify(value));

test('companions unlock at real practice boundaries and an unlocked younger form stays selected',()=>{
  let state=createProgress(date);
  assert.deepEqual(plain(getCompanionGrowth(state,null)),{seconds:0,unlockedStage:'baby',selectedStage:null,displayStage:'baby',nextUnlockSeconds:1800});
  state=recordCompanionPractice(state,null,1799.75);
  assert.equal(getCompanionGrowth(state,null).unlockedStage,'baby');
  assert.equal(selectCompanionStage(state,null,'young'),state,'locked forms cannot be selected');
  state=recordCompanionPractice(state,null,.25);
  assert.equal(getCompanionGrowth(state,null).displayStage,'young');
  state=selectCompanionStage(state,null,'baby');
  state=recordCompanionPractice(state,null,9000);
  const grown=getCompanionGrowth(state,null);
  assert.equal(grown.unlockedStage,'adult');
  assert.equal(grown.displayStage,'baby','practice unlocks new forms without replacing a chosen younger form');
  assert.equal(grown.nextUnlockSeconds,null);
  state=normalizeProgress(plain(state),date);
  assert.equal(getCompanionGrowth(state,null).selectedStage,'baby');
  assert.equal(getCompanionGrowth(selectCompanionStage(state,null,null),null).displayStage,'adult');
});

test('each owned companion and the original keep independent practice time and stage choices',()=>{
  let state={...createProgress(date),points:200};
  state=recordCompanionPractice(state,null,1900);
  state=redeemReward(state,'pet-husky',date).state;
  state=recordCompanionPractice(state,'pet-husky',11000);
  state=selectCompanionStage(state,'pet-husky','young');
  state=redeemReward(state,'pet-calico',date).state;
  // A final clock flush after switching still belongs to the previously equipped dog.
  state=recordCompanionPractice(state,'pet-husky',.3);
  state=recordCompanionPractice(state,'pet-calico',35);
  assert.equal(getCompanionGrowth(state,'pet-husky').seconds,11000.3);
  assert.equal(getCompanionGrowth(state,'pet-husky').displayStage,'young');
  assert.equal(getCompanionGrowth(state,'pet-calico').seconds,35);
  const restored=normalizeProgress(plain(unequipPet(state,date)),date);
  assert.equal(restored.activePet,null);
  assert.equal(getCompanionGrowth(restored,null).seconds,1900);
  assert.equal(getCompanionGrowth(restored,'pet-husky').selectedStage,'young');
});

test('practice growth continues beyond completion and daily reward caps without granting extra XP or stars',()=>{
  let state=createProgress(date);
  for(let i=0;i<5;i++)state=recordPractice(state,`score-${i}`,date).state;
  const before=plain(state);
  state=recordCompanionPractice(state,null,90);
  state=recordCompanionPractice(state,null,200);
  assert.equal(getCompanionGrowth(state,null).seconds,290);
  assert.equal(state.xp,before.xp);
  assert.equal(state.points,before.points);
  assert.equal(state.today.count,5);
  assert.deepEqual(plain(state.completedSessions),before.completedSessions);
  assert.equal(getCompanionGrowth(recordPractice(state,'score-0',date).state,null).seconds,290);
});

test('migration preserves rewards and refuses fabricated time, unowned records and locked persisted selections',()=>{
  const legacy={version:1,xp:240,points:80,cosmetics:['pet-nocturne'],activePet:'pet-nocturne',practiceDays:['2026-10-13'],completedSessions:['old-score'],today:{date:'2026-10-13',count:3}};
  const restored=normalizeProgress(legacy,date);
  assert.equal(restored.xp,240);
  assert.equal(restored.points,80);
  assert.equal(getCompanionGrowth(restored,'pet-nocturne').seconds,0,'old completion/XP records do not reveal elapsed practice');
  const repaired=normalizeProgress({...legacy,companionGrowth:{
    original:{seconds:50,selectedStage:'adult'},
    'pet-nocturne':{seconds:1900.1234,selectedStage:'young'},
    'pet-husky':{seconds:999999,selectedStage:'adult'},
    unknown:{seconds:999999},
  }},date);
  assert.deepEqual(Object.keys(repaired.companionGrowth).sort(),['original','pet-nocturne']);
  assert.equal(getCompanionGrowth(repaired,null).selectedStage,null);
  assert.equal(getCompanionGrowth(repaired,'pet-nocturne').seconds,1900.123);
  assert.equal(getCompanionGrowth(repaired,'pet-nocturne').displayStage,'young');
  assert.equal(getCompanionGrowth(repaired,'pet-husky').seconds,0);
  assert.equal(recordCompanionPractice(repaired,'pet-husky',5),repaired);
  assert.equal(selectCompanionStage(repaired,'pet-husky','baby'),repaired);
});

test('invalid time and stages never corrupt totals or mutate prior growth records',()=>{
  const initial=createProgress(date);
  for(const invalid of [0,-1,NaN,Infinity,-Infinity])assert.equal(recordCompanionPractice(initial,null,invalid),initial);
  for(const seconds of [-4,NaN,Infinity,'1800']){
    const restored=normalizeProgress({...initial,companionGrowth:{original:{seconds,selectedStage:'young'}}},date);
    assert.equal(getCompanionGrowth(restored,null).seconds,0);
    assert.equal(getCompanionGrowth(restored,null).selectedStage,null);
  }
  const first=recordCompanionPractice(initial,null,1.25);
  const second=recordCompanionPractice(first,null,.5);
  assert.equal(getCompanionGrowth(initial,null).seconds,0);
  assert.equal(getCompanionGrowth(first,null).seconds,1.25);
  assert.equal(getCompanionGrowth(second,null).seconds,1.75);
  assert.equal(selectCompanionStage(second,null,'unknown'),second);
});

test('all seven new cats and dogs can be purchased, normalized and switched without charging twice',()=>{
  let state={...createProgress(date),points:1000};
  for(const id of ['pet-mainecoon','pet-calico','pet-orange','pet-bluecat','pet-husky','pet-shiba','pet-poodle']){
    assert.ok(PET_IDS.includes(id));
    const reward=REWARDS.find(item=>item.id===id);
    assert.ok(reward && reward.cost>0 && reward.name.zh && reward.name.en && reward.name.ja);
    state=redeemReward(state,id,date).state;
    const points=state.points;
    state=recordCompanionPractice(state,id,1800);
    state=normalizeProgress(plain(state),date);
    assert.equal(state.activePet,id);
    assert.equal(getCompanionGrowth(state,id).displayStage,'young');
    state=redeemReward(state,id,date).state;
    assert.equal(state.points,points);
  }
});

function clockHarness(){
  let now=0,slot=0,nextTimer=0;
  const slots=[],effects=[],timers=new Map(),listeners=new Map();
  const react={
    useState(initial){const index=slot++;if(!(index in slots))slots[index]={value:typeof initial==='function'?initial():initial};return[slots[index].value,update=>{slots[index].value=typeof update==='function'?update(slots[index].value):update;}];},
    useRef(initial){const index=slot++;if(!(index in slots))slots[index]={current:initial};return slots[index];},
    useEffect(effect,dependencies){const index=slot++,old=slots[index];if(!old||dependencies.some((value,i)=>value!==old.dependencies[i]))effects.push(()=>{old?.cleanup?.();slots[index]={dependencies,cleanup:effect()};});},
  };
  const document={hidden:false,addEventListener:(type,listener)=>listeners.set(type,listener),removeEventListener:type=>listeners.delete(type)};
  const {usePracticeClock}=loadModule('src/progress/useProgress.ts',90210,undefined,{react},{document,performance:{now:()=>now},setInterval:callback=>{const id=++nextTimer;timers.set(id,callback);return id;},clearInterval:id=>timers.delete(id)});
  return{
    render:function ClockHarness(session='score-one',enabled=true,callback){slot=0;const display=usePracticeClock(session,enabled,callback);while(effects.length)effects.shift()();return display;},
    advance(ms,tick=true){if(!tick){now+=ms;return;}for(let elapsed=0;elapsed<ms;elapsed+=500){now+=Math.min(500,ms-elapsed);for(const timer of [...timers.values()])timer();}},
    visible(visible){document.hidden=!visible;listeners.get('visibilitychange')?.();},
    tick(){for(const timer of [...timers.values()])timer();},
    unmount(){for(const slot of slots)slot?.cleanup?.();},
  };
}

test('clock credits uncapped foreground time and flushes visibility and cleanup tails exactly once',()=>{
  const h=clockHarness(),deltas=[],callback=seconds=>deltas.push(seconds);
  h.render('score-one',true,callback);
  h.advance(90000);
  assert.equal(h.render('score-one',true,callback),60,'completion display keeps its familiar cap');
  assert.equal(deltas.reduce((sum,value)=>sum+value,0),90,'companion time continues beyond 60 seconds');
  h.advance(250,false);h.visible(false);
  assert.equal(deltas.reduce((sum,value)=>sum+value,0),90.25);
  h.advance(45000);h.visible(true);
  assert.equal(deltas.reduce((sum,value)=>sum+value,0),90.25,'background is excluded');
  h.advance(500);h.advance(200,false);h.unmount();
  assert.equal(deltas.reduce((sum,value)=>sum+value,0),90.95,'cleanup credits the final short interval');
  h.tick();
  assert.equal(deltas.reduce((sum,value)=>sum+value,0),90.95,'cleared timers cannot replay practice');
});

test('clock splits companion switches, resets scores and caps device suspension gaps',()=>{
  const h=clockHarness();let oldPet=0,newPet=0;
  const oldCallback=seconds=>oldPet+=seconds,newCallback=seconds=>newPet+=seconds;
  h.render('score-one',true,oldCallback);h.advance(500);h.advance(250,false);
  h.render('score-one',true,newCallback);
  assert.equal(oldPet,.75,'effect replacement flushes to the previously equipped pet');
  h.advance(500);
  assert.equal(newPet,.5);
  assert.equal(h.render('score-two',true,newCallback),0,'new scores keep a separate completion display');
  h.advance(30000,false);h.tick();
  assert.equal(newPet,2,'sleep gaps are bounded to the timer tolerance');
  h.advance(250,false);h.render('score-two',false,newCallback);
  assert.equal(newPet,2.25,'pausing flushes the last foreground tail');
  h.advance(20000);h.render('score-two',true,newCallback);h.advance(500);
  assert.equal(newPet,2.75,'resuming never credits paused time');
  h.unmount();
});
