import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {Children} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createRequire} from 'node:module';
import {loadModule} from './helpers.mjs';

const require=createRequire(import.meta.url);

function focusHarness(){
  const slots=[],layout=[],effects=[],listeners=new Map(),orientationListeners=new Set(),focusCalls=[];
  let cursor=0,dirty=false,active=true,stored=JSON.stringify({portrait:1.2,landscape:1});
  const query={matches:false,addEventListener(_type,callback){orientationListeners.add(callback);},removeEventListener(_type,callback){orientationListeners.delete(callback);}};
  const effect=(queue,callback,dependencies)=>{
    const index=cursor++,old=slots[index];
    if(old&&dependencies.every((value,i)=>Object.is(value,old.dependencies[i])))return;
    const slot={dependencies};slots[index]=slot;
    queue.push(()=>{old?.cleanup?.();slot.cleanup=callback();});
  };
  const react={
    useState(initial){const index=cursor++;if(!(index in slots))slots[index]={value:typeof initial==='function'?initial():initial};return [slots[index].value,next=>{
      const value=typeof next==='function'?next(slots[index].value):next;
      if(!Object.is(value,slots[index].value)){slots[index].value=value;dirty=true;}
    }];},
    useRef(initial){const index=cursor++;if(!(index in slots))slots[index]={current:initial};return slots[index];},
    useEffect:(callback,dependencies)=>effect(effects,callback,dependencies),
    useLayoutEffect:(callback,dependencies)=>effect(layout,callback,dependencies),
  };
  const window={matchMedia:()=>query,addEventListener(type,callback){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(callback);},removeEventListener(type,callback){listeners.get(type)?.delete(callback);}};
  const {useScoreFocus}=loadModule('src/hooks/useScoreFocus.ts',1,undefined,{react},{window,localStorage:{getItem:()=>stored,setItem(_key,value){stored=value;}}});
  function ScoreFocusHookHarness(enabled){return useScoreFocus(enabled);}
  const button=name=>({focus(options){focusCalls.push({name,preventScroll:options?.preventScroll});}});
  const entry=button('entry'),exit=button('exit');
  return {
    render:function ScoreFocusHarness(enabled=active){
      active=enabled;let result,commits=0;
      do{
        assert.ok(commits++<5,'focus transitions must settle without a render loop');
        dirty=false;cursor=0;result=ScoreFocusHookHarness(active);
        // React sets mounted DOM refs before running layout effects.
        result.entryRef.current=active&&!result.focus?entry:null;
        result.exitRef.current=active&&result.focus?exit:null;
        while(layout.length)layout.shift()();
        while(effects.length)effects.shift()();
      }while(dirty);
      return result;
    },
    press(key,defaultPrevented=false){for(const callback of [...(listeners.get('keydown')??[])])callback({key,defaultPrevented});},
    orient(portrait){query.matches=portrait;for(const callback of orientationListeners)callback();},
    listenerCount:()=>listeners.get('keydown')?.size??0,
    unmount(){for(const slot of slots)slot?.cleanup?.();},
    focusCalls,
    saved:()=>JSON.parse(stored),
  };
}

test('focus mode moves keyboard focus to the mounted exit and back to the entry without scrolling',()=>{
  const h=focusHarness();let state=h.render();
  assert.equal(state.focus,false);assert.equal(h.focusCalls.length,0);
  state.toggle();state=h.render();
  assert.equal(state.focus,true);
  assert.deepEqual(h.focusCalls,[{name:'exit',preventScroll:true}]);
  state.toggle();state=h.render();
  assert.equal(state.focus,false);
  assert.deepEqual(h.focusCalls,[{name:'exit',preventScroll:true},{name:'entry',preventScroll:true}]);
  h.unmount();
});

test('Escape restores the entry, respects nested controls and removes its listener outside focus mode',()=>{
  const h=focusHarness();let state=h.render();
  assert.equal(h.listenerCount(),0);
  state.toggle();state=h.render();assert.equal(h.listenerCount(),1);
  h.press('ArrowRight');assert.equal(h.render().focus,true);
  h.press('Escape',true);assert.equal(h.render().focus,true,'a nested control may consume Escape first');
  assert.equal(h.focusCalls.length,1);
  h.press('Escape');state=h.render();
  assert.equal(state.focus,false);assert.equal(h.listenerCount(),0);
  assert.deepEqual(h.focusCalls.at(-1),{name:'entry',preventScroll:true});
  h.press('Escape');h.render();assert.equal(h.focusCalls.length,2);
  state.toggle();h.render();h.unmount();assert.equal(h.listenerCount(),0);
});

test('leaving practice clears focus mode without stealing navigation focus or reopening focus on return',()=>{
  const h=focusHarness();let state=h.render();
  state.toggle();h.render();assert.equal(h.focusCalls.length,1);
  state=h.render(false);
  assert.equal(state.focus,false);assert.equal(h.listenerCount(),0);
  assert.equal(h.focusCalls.length,1,'unmounted practice controls never receive focus');
  state.toggle();state=h.render(false);assert.equal(state.focus,false);
  state=h.render(true);assert.equal(state.focus,false);
  assert.equal(h.focusCalls.length,1,'returning to practice leaves page navigation in charge of focus');
  h.unmount();
});

test('orientation and size persistence stay independent of keyboard focus',()=>{
  const h=focusHarness();let state=h.render();
  assert.equal(state.size,1);
  state.toggle();state=h.render();state.changeSize(1.4);state=h.render();
  assert.equal(state.size,1.4);assert.equal(h.saved().landscape,1.4);
  h.orient(true);state=h.render();assert.equal(state.size,1.2);
  state.changeSize(1.3);state=h.render();
  assert.equal(state.size,1.3);assert.equal(h.saved().portrait,1.3);
  assert.equal(h.focusCalls.length,1,'resizing never refocuses or scrolls the controls');
  state.toggle();state=h.render();assert.equal(h.focusCalls.length,2);
  assert.equal(state.size,1.3);h.unmount();
});

test('the actual play button shows localized loading and busy state while retaining play and resume behavior',()=>{
  const source=ts.createSourceFile('App.tsx',fs.readFileSync('src/App.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let button;
  const visit=node=>{
    if(ts.isJsxElement(node)&&node.openingElement.tagName.getText(source)==='button'&&node.openingElement.attributes.properties.some(attribute=>
      ts.isJsxAttribute(attribute)&&attribute.name.getText(source)==='className'&&attribute.initializer?.text==='play-main'))button=node;
    ts.forEachChild(node,visit);
  };
  visit(source);assert.ok(button);
  const output=ts.transpileModule(`module.exports=${button.getText(source)}`,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const {translate,localeOrder}=loadModule('src/i18n/messages.ts');
  const labelSource=ts.transpileModule(fs.readFileSync('src/components/PlaybackButtonLabel.tsx','utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023,jsx:ts.JsxEmit.ReactJSX},
  }).outputText;
  const render=(status,locale='en')=>{
    const labelModule={exports:{}};
    vm.runInNewContext(labelSource,{module:labelModule,exports:labelModule.exports,require(spec){
      if(spec.endsWith('.css'))return {};
      if(spec==='react/jsx-runtime')return require(spec);
      if(spec==='../i18n/context')return {useI18n:()=>({locale,t:key=>translate(locale,key)})};
      throw Error('Unexpected label import: '+spec);
    }});
    const PlaybackButtonLabel=labelModule.exports.default;
    const module={exports:{}};
    vm.runInNewContext(output,{module,exports:module.exports,require,PlaybackButtonLabel,t:key=>translate(locale,key),playback:{status,mode:'score'},current:{exercise:{}},bpm:72});
    const element=module.exports,label=Children.toArray(element.props.children).find(child=>child.type===PlaybackButtonLabel);
    assert.ok(label,'render the actual translated label component used by the App');
    const labels=Children.toArray(PlaybackButtonLabel(label.props).props.children);
    const active=labels.filter(child=>child.props['aria-hidden']!==true);
    assert.equal(active.length,1);assert.equal(labels.filter(child=>child.props['aria-hidden']===true).length,2);
    return {element,html:renderToStaticMarkup(element),activeLabel:active[0].props.children};
  };
  for(const locale of localeOrder){
    const {element,html,activeLabel}=render('starting',locale);
    assert.equal(element.props['aria-busy'],true);assert.equal(element.props.disabled,true);
    assert.equal(activeLabel,translate(locale,'loadingAudio'),locale);
    assert.match(html,/aria-busy="true"/);
  }
  for(const [status,key] of [['idle','play'],['paused','resume'],['playing','play']]){
    const {element,activeLabel}=render(status);
    assert.equal(element.props['aria-busy'],false);assert.equal(activeLabel,translate('en',key));
    assert.equal(element.props.disabled,status==='playing');
  }
});
