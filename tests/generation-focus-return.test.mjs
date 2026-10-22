import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

function generationFocusHarness({reducedMotion=true,scoreHeading=true}={}){
  const slots=[],effects=[],focusCalls=[],animations=[],mediaListeners=new Set();
  let cursor=0,modal=null;
  const document={body:{name:'body'},activeElement:null,querySelector:selector=>selector==='dialog[open]'?modal:null};
  document.activeElement=document.body;
  const element=name=>({name,isConnected:true,tabIndex:0,focus(options){document.activeElement=this;focusCalls.push({name,preventScroll:options?.preventScroll});}});
  const heading=element('score-heading'),pageHeading=element('page-heading');
  const score={animate(frames,options){const record={frames,options,cancelled:false};animations.push(record);return {cancel(){record.cancelled=true;}};}};
  const root={current:{querySelector(selector){
    if(selector==='#score-heading')return scoreHeading?heading:null;
    if(selector==='main h1, main h2')return pageHeading;
    if(selector==='.score-card')return score;
    return null;
  }}};
  const react={
    useRef(initial){const index=cursor++;if(!(index in slots))slots[index]={current:initial};return slots[index];},
    useLayoutEffect(effect,dependencies){const index=cursor++,old=slots[index];
      if(old&&dependencies.every((value,i)=>Object.is(value,old.dependencies[i])))return;
      const slot={dependencies};slots[index]=slot;
      effects.push(()=>{old?.cleanup?.();slot.cleanup=effect();});
    },
  };
  const preference={matches:reducedMotion,addEventListener(_type,callback){mediaListeners.add(callback);},removeEventListener(_type,callback){mediaListeners.delete(callback);}};
  const {useStudioPageMotion}=loadModule('src/hooks/useStudioMotion.ts',1,undefined,{react},{document,window:{matchMedia:()=>preference}});
  function StudioMotionHarness(page,number){useStudioPageMotion(root,page,number);}
  return {
    render(page='practice',number=1){cursor=0;StudioMotionHarness(page,number);while(effects.length)effects.shift()();},
    focus(name){const control=element(name);document.activeElement=control;return control;},
    removeFocused(){document.activeElement.isConnected=false;document.activeElement=document.body;},
    modal(value){modal=value?element('dialog'):null;},
    currentFocus:()=>document.activeElement.name,
    unmount(){for(const slot of slots)slot?.cleanup?.();},
    focusCalls,animations,heading,
    mediaListeners:()=>mediaListeners.size,
  };
}

test('successful quick-settings and focused-study generation recover the focus lost by keyed controls',()=>{
  for(const action of ['apply-practice-settings','generate-focused-study']){
    const h=generationFocusHarness();h.render('practice',1);
    h.focus(action);
    // Both actions increment current.number and replace their keyed subtree.
    // Native DOM removal leaves the browser on body before layout effects run.
    h.removeFocused();assert.equal(h.currentFocus(),'body');
    h.render('practice',2);
    assert.equal(h.currentFocus(),'score-heading',action);
    assert.equal(h.heading.tabIndex,-1);
    assert.deepEqual(h.focusCalls,[{name:'score-heading',preventScroll:true}]);
    h.unmount();
  }
});

test('a surviving generation button or another focused control keeps its focus',()=>{
  for(const name of ['next-score','tempo','score-size']){
    const h=generationFocusHarness();h.render();h.focus(name);h.render('practice',2);
    assert.equal(h.currentFocus(),name);assert.equal(h.focusCalls.length,0);h.unmount();
  }
});

test('a modal is never interrupted, even if its own focus temporarily rests on body',()=>{
  for(const bodyFocused of [false,true]){
    const h=generationFocusHarness();h.render();h.modal(true);
    h.focus('dialog-action');if(bodyFocused)h.removeFocused();
    h.render('practice',2);
    assert.equal(h.currentFocus(),bodyFocused?'body':'dialog-action');
    assert.equal(h.focusCalls.length,0);h.unmount();
  }
});

test('initial render and layout-only renders do not manufacture a focus change',()=>{
  const h=generationFocusHarness();h.render('practice',1);
  assert.equal(h.currentFocus(),'body');assert.equal(h.focusCalls.length,0);
  h.focus('score-size');h.removeFocused();h.render('practice',1);
  assert.equal(h.currentFocus(),'body');assert.equal(h.focusCalls.length,0);
  h.unmount();
});

test('an absent score heading leaves focus alone instead of throwing or targeting the page header',()=>{
  const h=generationFocusHarness({scoreHeading:false});h.render();
  h.focus('apply-practice-settings');h.removeFocused();
  assert.doesNotThrow(()=>h.render('practice',2));
  assert.equal(h.currentFocus(),'body');assert.equal(h.focusCalls.length,0);h.unmount();
});

test('focus recovery preserves the existing score fade and cleans up its animation listener',()=>{
  const h=generationFocusHarness({reducedMotion:false});h.render();
  const oldAnimation=h.animations.at(-1);
  h.focus('apply-practice-settings');h.removeFocused();h.render('practice',2);
  assert.equal(oldAnimation.cancelled,true);
  const fade=h.animations.at(-1);
  assert.equal(fade.options.duration,300);
  assert.deepEqual(Array.from(fade.frames,frame=>frame.transform),['none','none']);
  assert.equal(h.mediaListeners(),1);
  assert.equal(h.currentFocus(),'score-heading');
  h.unmount();assert.equal(fade.cancelled,true);assert.equal(h.mediaListeners(),0);
});
