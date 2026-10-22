import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createRequire} from 'node:module';
import {loadModule} from './helpers.mjs';

const require=createRequire(import.meta.url),KEY='sight-reading-pwa-dismissed';
const {words}=loadModule('src/progress/words.ts');
const source=ts.transpileModule(fs.readFileSync('src/components/MobileInstallPrompt.tsx','utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023,jsx:ts.JsxEmit.ReactJSX},
}).outputText;

function installHarness({native=false,compact=true,standalone=false,ios=false,dismissed=false,readBlocked=false,writeBlocked=false,mediaBlocked=false}={}){
  const slots=[],effects=[],events=new Map(),queries=new Map(),storage=new Map();
  let cursor=0,storageReads=0,storageWrites=0,mediaReads=0;
  if(dismissed)storage.set(KEY,'1');
  const react={
    useState(initial){const index=cursor++;if(!(index in slots))slots[index]={value:typeof initial==='function'?initial():initial};return [slots[index].value,next=>{
      slots[index].value=typeof next==='function'?next(slots[index].value):next;
    }];},
    useRef(initial){const index=cursor++;if(!(index in slots))slots[index]={current:initial};return slots[index];},
    useEffect(callback,dependencies){const index=cursor++,old=slots[index];
      if(old&&dependencies.every((value,i)=>Object.is(value,old.dependencies[i])))return;
      const slot={dependencies};slots[index]=slot;
      effects.push(()=>{old?.cleanup?.();slot.cleanup=callback();});
    },
  };
  const navigator={standalone:ios};
  const window={
    localStorage:{getItem(key){storageReads++;if(readBlocked)throw Error('Read denied');return storage.get(key)??null;},setItem(key,value){storageWrites++;if(writeBlocked)throw Error('Write denied');storage.set(key,value);}},
    matchMedia(query){mediaReads++;if(mediaBlocked)throw Error('Media queries denied');if(!queries.has(query)){
      const listeners=new Set();
      queries.set(query,{matches:query==='(max-width: 900px)'?compact:standalone,listeners,addEventListener(_event,callback){listeners.add(callback);},removeEventListener(_event,callback){listeners.delete(callback);}});
    }return queries.get(query);},
    addEventListener(type,callback){if(!events.has(type))events.set(type,new Set());events.get(type).add(callback);},
    removeEventListener(type,callback){events.get(type)?.delete(callback);},
  };
  const module={exports:{}};
  vm.runInNewContext(source,{module,exports:module.exports,window,navigator,require(name){
    if(name==='react')return react;
    if(name==='react/jsx-runtime')return require(name);
    if(name==='@capacitor/core')return {Capacitor:{isNativePlatform:()=>native}};
    if(name==='../i18n/context')return {useI18n:()=>({locale:'en'})};
    if(name==='../progress/words')return {words};
    throw Error('Unexpected import: '+name);
  }});
  const flush=()=>{while(effects.length)effects.shift()();};
  return {
    render({effects:runEffects=true}={}){
      cursor=0;const tree=module.exports.default();
      const view={tree,html:tree?renderToStaticMarkup(tree):''};
      if(runEffects)flush();return view;
    },
    flush,
    dispatch(type,event={}){for(const callback of [...(events.get(type)??[])])callback(event);},
    media(query,matches){const media=queries.get(query);assert.ok(media,query);media.matches=matches;for(const callback of [...media.listeners])callback({matches});},
    ios(value){navigator.standalone=value;},
    listenerCount(){return [...events.values()].reduce((sum,set)=>sum+set.size,0)+[...queries.values()].reduce((sum,query)=>sum+query.listeners.size,0);},
    stored:()=>storage.get(KEY),
    counts:()=>({storageReads,storageWrites,mediaReads}),
    unmount(){for(const slot of slots)slot?.cleanup?.();},
  };
}

function elements(node){
  if(!node||typeof node!=='object')return [];
  return [node,...React.Children.toArray(node.props?.children).flatMap(elements)];
}
const buttons=view=>elements(view.tree).filter(node=>node.type==='button');
const installButton=view=>buttons(view).find(button=>button.props.className!=='mobile-install-secondary');
const closeButton=view=>buttons(view).find(button=>button.props.className==='mobile-install-secondary');

function browserPrompt({outcome='accepted',prompt=async()=>{},choice}={}){
  let calls=0,prevented=0;
  return {event:{prompt(){calls++;return prompt();},userChoice:choice??Promise.resolve({outcome}),preventDefault(){prevented++;}},calls:()=>calls,prevented:()=>prevented};
}

test('dismissed and standalone installs are hidden on the first render, before any effect can flash a banner',()=>{
  for(const options of [{dismissed:true},{standalone:true},{ios:true},{compact:false}]){
    const h=installHarness(options);
    assert.equal(h.render({effects:false}).tree,null,JSON.stringify(options));
    h.flush();assert.equal(h.render().tree,null);h.unmount();
  }
  const h=installHarness();
  const first=h.render({effects:false});
  assert.ok(first.html.includes('Use it like an app'));
  assert.ok(!first.html.includes('Start today'),'the noninteractive pseudo-action is removed');
  h.flush();h.render();assert.equal(h.counts().storageReads,1,'dismissal reads are lazy, not repeated each render');
  h.unmount();
});

test('native apps never show or register web install prompts',()=>{
  const h=installHarness({native:true,readBlocked:true,mediaBlocked:true});
  assert.equal(h.render().tree,null);assert.equal(h.listenerCount(),0);
  assert.deepEqual(h.counts(),{storageReads:0,storageWrites:0,mediaReads:0});h.unmount();
});

test('blocked storage cannot crash the banner or prevent closing it for this visit',()=>{
  const h=installHarness({readBlocked:true,writeBlocked:true});
  const view=h.render();assert.ok(view.tree);
  assert.doesNotThrow(()=>closeButton(view).props.onClick());
  assert.equal(h.render().tree,null);assert.equal(h.stored(),undefined);
  assert.equal(h.counts().storageWrites,1);h.unmount();
  const unavailable=installHarness({mediaBlocked:true});
  assert.doesNotThrow(()=>unavailable.render());assert.equal(unavailable.render().tree,null);unavailable.unmount();
});

test('media changes update compact and standalone visibility without unrelated rerenders and clean up all listeners',()=>{
  const h=installHarness({compact:false});
  assert.equal(h.render().tree,null);assert.equal(h.listenerCount(),4);
  h.media('(max-width: 900px)',true);assert.ok(h.render().tree);
  h.media('(display-mode: standalone)',true);assert.equal(h.render().tree,null);
  h.media('(display-mode: standalone)',false);assert.ok(h.render().tree);
  h.ios(true);h.media('(display-mode: standalone)',false);assert.equal(h.render().tree,null);
  h.ios(false);h.media('(display-mode: standalone)',false);assert.ok(h.render().tree);
  h.media('(max-width: 900px)',false);assert.equal(h.render().tree,null);
  assert.equal(h.stored(),undefined,'responsive changes do not dismiss on the user’s behalf');
  h.unmount();assert.equal(h.listenerCount(),0);
  const prompt=browserPrompt();h.dispatch('beforeinstallprompt',prompt.event);assert.equal(prompt.prevented(),0);
});

test('accepted and dismissed browser choices close safely even when persistence is rejected',async()=>{
  for(const outcome of ['accepted','dismissed'])for(const writeBlocked of [false,true]){
    const h=installHarness({writeBlocked});h.render();
    const prompt=browserPrompt({outcome});h.dispatch('beforeinstallprompt',prompt.event);
    assert.equal(prompt.prevented(),1);
    await assert.doesNotReject(installButton(h.render()).props.onClick());
    assert.equal(prompt.calls(),1);assert.equal(h.render().tree,null);
    assert.equal(h.stored(),writeBlocked?undefined:'1');h.unmount();
  }
});

test('a pending native browser prompt cannot be invoked twice and its button signals busy',async()=>{
  const h=installHarness();h.render();let resolve;
  const prompt=browserPrompt({prompt:()=>new Promise(done=>{resolve=done;})});
  h.dispatch('beforeinstallprompt',prompt.event);
  const button=installButton(h.render()),first=button.props.onClick(),second=button.props.onClick();
  assert.equal(prompt.calls(),1);
  const pending=installButton(h.render());assert.equal(pending.props.disabled,true);assert.equal(pending.props['aria-busy'],true);
  resolve();await Promise.all([first,second]);assert.equal(h.render().tree,null);h.unmount();
});

test('prompt and user-choice rejections stay handled, preserve manual help and allow a fresh prompt',async()=>{
  for(const failure of ['prompt','choice']){
    const h=installHarness();h.render();
    const prompt=browserPrompt(failure==='prompt'?{prompt:async()=>{throw Error('Prompt denied');}}:{choice:Promise.reject(Error('Choice unavailable'))});
    h.dispatch('beforeinstallprompt',prompt.event);
    await assert.doesNotReject(installButton(h.render()).props.onClick());
    let view=h.render();assert.ok(view.tree);assert.ok(view.html.includes('Add this page to your home screen'));
    assert.equal(installButton(view),undefined,'failed browser events are single use');
    assert.equal(h.stored(),undefined,'an error is neither an install nor a user dismissal');
    const fresh=browserPrompt({outcome:'dismissed'});h.dispatch('beforeinstallprompt',fresh.event);
    view=h.render();assert.ok(installButton(view));await installButton(view).props.onClick();
    assert.equal(h.render().tree,null);h.unmount();
  }
});

test('appinstalled independently hides the banner, including when storage is blocked',()=>{
  const h=installHarness({writeBlocked:true});h.render();
  h.dispatch('appinstalled');assert.equal(h.render().tree,null);
  h.media('(max-width: 900px)',false);h.render();h.media('(max-width: 900px)',true);
  assert.equal(h.render().tree,null,'a confirmed installation stays hidden across width changes');
  h.unmount();assert.equal(h.listenerCount(),0);
});
