import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import {createRequire} from 'node:module';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadModule} from './helpers.mjs';

const require=createRequire(import.meta.url);
const {translate,localeOrder}=loadModule('src/i18n/messages.ts');

function component(locale){
  const module={exports:{}};
  const source=ts.transpileModule(fs.readFileSync('src/components/PlaybackButtonLabel.tsx','utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023,jsx:ts.JsxEmit.ReactJSX},
  }).outputText;
  vm.runInNewContext(source,{module,exports:module.exports,require(spec){
    if(spec.endsWith('.css'))return {};
    if(spec==='react/jsx-runtime')return require(spec);
    if(spec==='../i18n/context')return {useI18n:()=>({t:key=>translate(locale,key)})};
    throw Error('Unexpected import: '+spec);
  }});
  return module.exports.default;
}

test('each playback state exposes only its active translated button name in every locale',()=>{
  for(const locale of localeOrder){
    const Label=component(locale);
    for(const label of ['play','loadingAudio','resume']){
      const tree=Label({label}),children=React.Children.toArray(tree.props.children);
      const accessible=children.filter(child=>child.props['aria-hidden']!==true);
      assert.equal(accessible.length,1,`${locale} ${label}`);
      assert.equal(accessible[0].props.children,translate(locale,label));
      assert.equal(children.filter(child=>child.props['aria-hidden']===true).length,2);
      assert.ok(children.every(child=>child.props.hidden===undefined),'inactive labels remain in layout');
      const markup=renderToStaticMarkup(tree);
      assert.equal((markup.match(/aria-hidden="true"/g)??[]).length,2);
      assert.doesNotMatch(markup,/aria-live|role="status"/,'the existing playback status owns announcements');
    }
  }
});

test('switching playback state retains the same locale-specific label nodes and their keys',()=>{
  const Label=component('de');
  const states=['play','loadingAudio','resume'].map(label=>React.Children.toArray(Label({label}).props.children));
  const identity=children=>children.map(child=>[child.key,child.props.children]);
  assert.deepEqual(identity(states[0]),identity(states[1]));
  assert.deepEqual(identity(states[0]),identity(states[2]));
  for(const children of states)assert.equal(children.length,3);
});
