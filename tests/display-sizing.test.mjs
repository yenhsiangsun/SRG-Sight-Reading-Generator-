import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';
function mount(saved={},failRead=false,failKeys=[]){
  const slots=[];let cursor=0;const writes=[];const values=new Map(Object.entries(saved));
  const react={useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],v=>{slots[i]=v;}];}};
  const storage={getItem(key){if(failRead)throw Error('unavailable');return values.get(key)??null;},setItem(key,value){if(failKeys.includes(key))throw Error('unavailable');values.set(key,value);writes.push([key,value]);}};
  const {useLayoutSize}=loadModule('src/hooks/useLayoutSize.ts',1,undefined,{react},{localStorage:storage});
  function LayoutHookHarness(){return useLayoutSize();}
  return{render(){cursor=0;return LayoutHookHarness();},writes,values};
}
test('existing layout preference survives and new text control defaults to following layout without writes',()=>{
  const h=mount({'sight-reading-layout-v1':'comfortable'});const state=h.render();
  assert.equal(state.size,'comfortable');assert.equal(state.textSize,'auto');assert.deepEqual(h.writes,[]);
});
test('layout and text persist independently and are restored on a later visit',()=>{
  const h=mount();h.render().changeText('extra-large');h.render().change('standard');
  assert.equal(h.render().size,'standard');assert.equal(h.render().textSize,'extra-large');
  assert.deepEqual(h.writes,[['tonecraft-text-size-v1','extra-large'],['sight-reading-layout-v1','standard']]);
  const reopened=mount(Object.fromEntries(h.values)).render();assert.equal(reopened.size,'standard');assert.equal(reopened.textSize,'extra-large');
  h.render().changeText('auto');assert.equal(h.render().textSize,'auto');assert.equal(h.render().size,'standard');
});
test('unrecognized preferences and choices never overwrite unrelated data or repair storage on mount',()=>{
  const h=mount({'sight-reading-layout-v1':'huge','tonecraft-text-size-v1':'99','sight-reading-library-v1':'keep'});
  assert.equal(h.render().size,'compact');assert.equal(h.render().textSize,'auto');
  h.render().change('huge');h.render().changeText('99');assert.deepEqual(h.writes,[]);assert.equal(h.values.get('sight-reading-library-v1'),'keep');
});
test('blocked storage still applies current choices and a successful other save does not hide a pending failure',()=>{
  const h=mount({},true,['tonecraft-text-size-v1']);assert.equal(h.render().textSize,'auto');
  h.render().changeText('large');h.render().change('comfortable');
  assert.equal(h.render().textSize,'large');assert.equal(h.render().size,'comfortable');assert.equal(h.render().warning,true);
  assert.deepEqual(h.writes,[['sight-reading-layout-v1','comfortable']]);
});
