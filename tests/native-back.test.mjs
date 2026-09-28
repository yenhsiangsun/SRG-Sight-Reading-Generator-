import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture({platform='android',available=true,pending=false,minimizeError}={}){
  let listener,resolveHandle,cleanup,reference,effectRan=false,registrations=0,removed=0,minimized=0;
  const warnings=[];
  const handle={async remove(){removed++;}};
  const api=loadModule('src/hooks/useNativeBack.ts',1,undefined,{
    react:{useRef(value){reference??={current:value};return reference;},useLayoutEffect(effect){effect();},useEffect(effect){if(!effectRan){effectRan=true;cleanup=effect();}}},
    '@capacitor/core':{Capacitor:{getPlatform:()=>platform,isPluginAvailable:()=>available}},
    '@capacitor/app':{App:{addListener(event,callback){assert.equal(event,'backButton');registrations++;listener=callback;return pending?new Promise(resolve=>{resolveHandle=resolve;}):Promise.resolve(handle);},async minimizeApp(){minimized++;if(minimizeError)throw minimizeError;}}},
  },{console:{warn:(...args)=>warnings.push(args)}});
  return {api,render:api.useNativeBack,fire:()=>listener?.({canGoBack:false}),cleanup:()=>cleanup?.(),resolve:()=>resolveHandle?.(handle),registrations:()=>registrations,removed:()=>removed,minimized:()=>minimized,warnings};
}
const state=(overrides={})=>({dialogOpen:false,examActive:false,page:'home',closeDialog(){},goHome(){},...overrides});

test('Android back closes the dialog first and keeps an active assessment intact',async()=>{
  const f=fixture(),actions=[];
  const minimize=async()=>actions.push('minimize');
  await f.api.handleNativeBack(state({dialogOpen:true,examActive:true,page:'practice',closeDialog:()=>actions.push('close'),goHome:()=>actions.push('home')}),minimize);
  assert.deepEqual(actions,['close']);
  actions.length=0;
  await f.api.handleNativeBack(state({examActive:true,page:'practice',goHome:()=>actions.push('home')}),minimize);
  assert.deepEqual(actions,[],'the existing Cancel control must be used to discard an active question');
});

test('non-home pages use the existing home callback; home minimizes without exiting',async()=>{
  const f=fixture(),actions=[];
  for(const page of ['practice','setup','home']){
    await f.api.handleNativeBack(state({page,goHome:()=>actions.push('home')}),async()=>actions.push('minimize'));
  }
  assert.deepEqual(actions,['home','home','minimize']);
});

test('one Android listener reads current dialog, exam and page state after rerenders',async()=>{
  const f=fixture(),actions=[];
  f.render(state());await tick();
  f.render(state({page:'practice',dialogOpen:true,closeDialog:()=>actions.push('close')}));
  f.fire();await tick();
  f.render(state({page:'practice',examActive:true,goHome:()=>actions.push('unexpected home')}));
  f.fire();await tick();
  f.render(state({page:'practice',goHome:()=>actions.push('capture, stop, home')}));
  f.fire();await tick();
  f.render(state());f.fire();await tick();
  assert.deepEqual(actions,['close','capture, stop, home']);
  assert.equal(f.registrations(),1);assert.equal(f.minimized(),1);
  f.cleanup();f.fire();await tick();
  assert.equal(f.removed(),1);assert.equal(f.minimized(),1);
});

test('unmount before async registration resolves removes the late listener and ignores queued back events',async()=>{
  const f=fixture({pending:true});let navigated=0;
  f.render(state({page:'practice',goHome:()=>navigated++}));
  f.cleanup();f.fire();f.resolve();await tick();f.fire();await tick();
  assert.equal(f.removed(),1);assert.equal(navigated,0);assert.equal(f.minimized(),0);
});

test('web, iOS and builds without App do not register an Android back listener',()=>{
  for(const options of [{platform:'web'},{platform:'ios'},{available:false}]){
    const f=fixture(options);f.render(state());f.cleanup();
    assert.equal(f.registrations(),0);assert.equal(f.minimized(),0);
  }
});

test('native minimize failures are caught without navigating or an unhandled rejection',async()=>{
  const f=fixture({minimizeError:new Error('activity unavailable')});
  f.render(state());await tick();f.fire();await tick();
  assert.equal(f.warnings.length,1);assert.match(f.warnings[0][0],/Android back/);
  f.cleanup();
});
