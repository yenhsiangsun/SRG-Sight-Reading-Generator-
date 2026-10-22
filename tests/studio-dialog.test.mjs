import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import ts from 'typescript';

const require=createRequire(import.meta.url);
function dialogFixture({connected=true,anotherModal=false,navigated=false}={}) {
  const effects=[],actions=[];
  class Element {
    isConnected=connected;
    focus(options){actions.push(['focus',options.preventScroll]);}
  }
  const opener=new Element();
  const body=new Element(),heading=new Element();
  const document={activeElement:opener,body,querySelector:()=>anotherModal?{}:null};
  const dialog={showModal(){actions.push(['open']);},close(){actions.push(['close']);},contains:()=>false};
  const module={exports:{}};
  const code=ts.transpileModule(fs.readFileSync('src/components/StudioDialogs.tsx','utf8').replaceAll('import.meta.env.DEV','false'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023,jsx:ts.JsxEmit.ReactJSX},
  }).outputText;
  vm.runInNewContext(code,{
    module,exports:module.exports,HTMLElement:Element,
    document,
    require(name){
      if(name==='react')return {useRef:()=>({current:dialog}),useEffect:effect=>effects.push(effect)};
      if(name==='react/jsx-runtime')return require(name);
      if(name==='../i18n/context')return {useI18n:()=>({locale:'en'})};
      if(name==='../progress/words')return {words:(_locale,_zh,en)=>en};
      return {};
    },
  });
  let closed=0;
  const element=module.exports.StudioDialog({title:'My library',children:null,onClose:()=>closed++});
  const unmount=effects[0]();
  const cleanup=()=>{
    // React has removed the dialog by passive cleanup; navigation's layout
    // effect may already have placed focus on the destination page heading.
    document.activeElement=navigated?heading:body;
    unmount();
  };
  return {actions,element,cleanup,closed:()=>closed};
}

test('closing a native modal returns keyboard focus to its connected opener without scrolling',()=>{
  const f=dialogFixture();
  f.element.props.onCancel();
  f.cleanup();
  assert.equal(f.closed(),1,'Escape uses the existing close callback');
  assert.deepEqual(f.actions,[['open'],['close'],['focus',true]]);
});

test('a disappearing opener is not focused during dialog cleanup',()=>{
  const f=dialogFixture({connected:false});f.cleanup();
  assert.deepEqual(f.actions,[['open'],['close']]);
});

test('closing one dialog cannot steal focus from another native modal',()=>{
  const f=dialogFixture({anotherModal:true});f.cleanup();
  assert.deepEqual(f.actions,[['open'],['close']]);
});

test('opening a saved study preserves focus already assigned to the destination page',()=>{
  const f=dialogFixture({navigated:true});f.cleanup();
  assert.deepEqual(f.actions,[['open'],['close']],'navigation focus must not jump back to the library opener');
});
