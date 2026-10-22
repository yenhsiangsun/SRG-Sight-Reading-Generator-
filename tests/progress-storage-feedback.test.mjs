import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import {renderToStaticMarkup} from 'react-dom/server';

// Real React SSR of actual presentation components and AST-selected App JSX.
// No fake React/hooks, App boot, effects, Storage, audio or device APIs. This is
// presentation coverage; browser StrictMode persistence is verified separately.
const sourceRoot=path.resolve(process.env.PROGRESS_FEEDBACK_SOURCE_ROOT??'.');
const cache=new Map();
const source=relative=>fs.readFileSync(path.join(sourceRoot,relative),'utf8');
function productModule(relative){
  const file=path.resolve(sourceRoot,relative);
  assert.ok(!path.relative(path.join(sourceRoot,'src'),file).startsWith('..'));
  if(cache.has(file))return cache.get(file).exports;
  const module={exports:{}};cache.set(file,module);
  const output=ts.transpileModule(fs.readFileSync(file,'utf8').replaceAll('import.meta.env.BASE_URL',"'/'"),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023,jsx:ts.JsxEmit.ReactJSX},
  }).outputText;
  vm.runInNewContext(output,{module,exports:module.exports,require(spec){
    if(spec==='react')return React;
    if(spec==='react/jsx-runtime')return jsxRuntime;
    if(spec.endsWith('.css'))return {};
    assert.ok(spec.startsWith('.'),'unexpected dependency: '+spec);
    const target=path.resolve(path.dirname(file),spec);
    const candidate=['.ts','.tsx','.json'].map(ext=>target+ext).find(p=>fs.existsSync(p));
    assert.ok(candidate,'missing relative module: '+spec);
    if(candidate.endsWith('.json'))return JSON.parse(fs.readFileSync(candidate,'utf8'));
    return productModule(path.relative(sourceRoot,candidate));
  }},{filename:file});
  return module.exports;
}
const {translate,localeOrder}=productModule('src/i18n/messages.ts');
const {words}=productModule('src/progress/words.ts');
const {LocalizationContext}=productModule('src/i18n/context.ts');
const Companion=productModule('src/components/PracticeCompanion.tsx').default;
const exercise={timeSignature:'4/4',measures:[{events:[{key:'c/4',midi:60,rest:false,duration:'q',durationUnits:4}]}]};
const appTree=ts.createSourceFile('App.tsx',source('src/App.tsx'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function findNode(predicate,root=appTree){let found;function visit(node){if(found)return;if(predicate(node)){found=node;return;}ts.forEachChild(node,visit);}visit(root);assert.ok(found,'actual App presentation node missing');return found;}
const checkout=findNode(node=>ts.isJsxElement(node)&&node.openingElement.attributes.properties.some(p=>ts.isJsxAttribute(p)&&p.name.getText(appTree)==='className'&&p.initializer&&ts.isStringLiteral(p.initializer)&&p.initializer.text==='practice-checkout'));
const heading=findNode(node=>ts.isJsxElement(node)&&node.openingElement.tagName.getText(appTree)==='strong',checkout);
function compileAppFragment(node,bindings){
  const module={exports:{}};
  const output=ts.transpileModule(`module.exports=function AppPresentation(){return (${node.getText(appTree)});}`,{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023,jsx:ts.JsxEmit.ReactJSX},
  }).outputText;
  vm.runInNewContext(output,{module,exports:module.exports,...bindings,require:spec=>{assert.equal(spec,'react/jsx-runtime');return jsxRuntime;}});
  return module.exports;
}
function render(locale,Component,props={}){
  return renderToStaticMarkup(React.createElement(LocalizationContext.Provider,{value:{locale,setLocale(){},t:key=>translate(locale,key)}},React.createElement(Component,props)));
}
const text=html=>html.replace(/<[^>]*>/g,'').replaceAll('&amp;','&').replaceAll('&#x27;',"'").replaceAll('&quot;','"').replaceAll('&lt;','<').replaceAll('&gt;','>');
function checkoutTitle(locale){
  const Heading=compileAppFragment(heading,{completed:true,t:key=>translate(locale,key),w:(zh,en,ja)=>words(locale,zh,en,ja)});
  return text(renderToStaticMarkup(React.createElement(Heading)));
}
function companionTip(locale){
  const markup=render(locale,Companion,{exercise,pet:null,playing:false,metronomeOnly:false,examActive:false,completed:true});
  const match=markup.match(/<p class="practice-companion__message"[^>]*>([\s\S]*?)<\/p>/);
  assert.ok(match);return text(match[1]);
}
const noSaved=/recorded|saved|已經收進|已经收进|已經記下|已经记下|記録しました|記録できた/iu;

test('completed checkout persistence contract',()=>{
  for(const locale of ['en','zh-TW','ja'])assert.doesNotMatch(checkoutTitle(locale),noSaved,locale+' cannot infer persistence from completion');
});

test('completed companion persistence contract',()=>{
  for(const locale of ['en','zh-TW','ja'])assert.doesNotMatch(companionTip(locale),noSaved,locale+' cannot infer persistence from completion');
});

test('actual App checkout resolves the neutral completed title in all twelve locales',()=>{
  for(const locale of localeOrder){
    const expected=translate(locale,'practiceCompletedTitle');assert.ok(expected?.length>0,locale);
    assert.equal(checkoutTitle(locale),expected,locale);
  }
});

test('actual companion completed view resolves the neutral tip in all twelve locales',()=>{
  for(const locale of localeOrder){
    const expected=translate(locale,'practiceCompletedTip');assert.ok(expected?.length>0,locale);
    assert.equal(companionTip(locale),expected,locale);
  }
});

test('actual notice renders nothing when no store reports a warning',()=>{
  const Notice=productModule('src/components/ProgressStorageNotice.tsx').default;
  for(const locale of localeOrder)assert.equal(render(locale,Notice,{warning:false}),'',locale);
});

test('actual notice is one polite atomic status with locale-specific content',()=>{
  const Notice=productModule('src/components/ProgressStorageNotice.tsx').default;
  for(const locale of localeOrder){
    const markup=render(locale,Notice,{warning:true});
    assert.equal((markup.match(/role="status"/g)??[]).length,1,locale);
    assert.match(markup,/aria-live="polite"/);assert.match(markup,/aria-atomic="true"/);
    assert.match(markup,/data-progress-storage-notice/);
    assert.equal(text(markup),translate(locale,'practiceRecordsTemporary'),locale);
  }
});

test('notice copy distinguishes partial unsaved records and describes preservation, reload and close',()=>{
  const semantics={
    'zh-TW':[/部分/,/保留/,/未儲存/,/重新載入/,/關閉/],en:[/Some /,/preserved/,/Unsaved/,/reload/,/close/],
    ja:[/一部/,/保持/,/未保存/,/再読み込み/,/終了/],es:[/Algunos/,/conservan/,/sin guardar/,/recargar/,/cerrar/],
    de:[/Einige/,/erhalten/,/Nicht gespeicherte/,/Neuladen/,/Schließen/],fr:[/Certains/,/préservées/,/non enregistrés/,/rechargez/,/fermez/],
    ko:[/일부/,/보존/,/저장되지 않은/,/새로 고치/,/닫/],'pt-BR':[/Alguns/,/preservados/,/não salvo/,/recarregar/,/fechar/],
    ru:[/Некоторые/,/сохранены/,/несохранённый/,/перезагрузке/,/закрытии/],it:[/Alcuni/,/conservati/,/non salvati/,/ricaricando/,/chiudendo/],
    'zh-CN':[/部分/,/保留/,/未保存/,/重新加载/,/关闭/],th:[/บางส่วน/,/ข้อมูลเดิมยังคงอยู่/,/ยังไม่ได้บันทึก/,/โหลดใหม่/,/ปิดแอป/],
  };
  for(const locale of localeOrder)for(const meaning of semantics[locale])assert.match(translate(locale,'practiceRecordsTemporary'),meaning,locale);
});

test('storage notice offers no reload, erase or focus-stealing action',()=>{
  const Notice=productModule('src/components/ProgressStorageNotice.tsx').default;
  for(const locale of localeOrder)assert.doesNotMatch(render(locale,Notice,{warning:true}),/<button\b|<a\b|autoFocus|autofocus|role="alert"/i,locale);
});

test('actual App notice binding covers either store warning and stays absent for healthy stores',()=>{
  const Notice=productModule('src/components/ProgressStorageNotice.tsx').default;
  const node=findNode(n=>ts.isJsxSelfClosingElement(n)&&n.tagName.getText(appTree)==='ProgressStorageNotice');
  for(const [progress,training] of [[false,false],[true,false],[false,true],[true,true]]){
    const Fragment=compileAppFragment(node,{ProgressStorageNotice:Notice,growth:{storageWarning:progress},training:{storageWarning:training}});
    const markup=render('en',Fragment);
    assert.equal(markup.includes('data-progress-storage-notice'),progress||training);
  }
});

test('actual conflict notice resolves distinct changed-data and unsaved-progress copy in all twelve locales',()=>{
  const Notice=productModule('src/components/ProgressStorageNotice.tsx').default;
  const meanings={
    'zh-TW':[/部分/,/變更/,/避免覆寫/,/相關新進度尚未儲存/,/最新資料/,/可能.*遺失/],
    en:[/Some saved practice data has changed/,/avoid overwriting/,/affected new progress has not been saved/,/latest data/,/may be lost/],
    ja:[/一部が変更/,/上書きを避ける/,/関連する新しい進捗は未保存/,/最新のデータ/,/失われる場合/],
    es:[/Algunos/,/han cambiado/,/evitar sobrescribir/,/progreso nuevo afectado no se ha guardado/,/más recientes/,/puede perderse/],
    de:[/Einige/,/wurden geändert/,/nicht zu überschreiben/,/betroffene neue Fortschritte nicht gespeichert/,/neuesten Daten/,/verloren gehen/],
    fr:[/Certaines/,/ont changé/,/éviter de les écraser/,/progrès concernés n’ont pas été enregistrés/,/dernières données/,/peuvent être perdus/],
    ko:[/일부가 변경/,/덮어쓰지 않도록/,/새 진행 상황은 저장하지 않았/,/최신 데이터/,/사라질 수/],
    'pt-BR':[/Alguns/,/mudaram/,/evitar sobrescrevê-los/,/novos progressos afetados não foram salvos/,/dados mais recentes/,/podem ser perdidos/],
    ru:[/Часть/,/данных занятий изменилась/,/не перезаписать/,/новые результаты не сохранены/,/последние данные/,/может быть потерян/],
    it:[/Alcuni/,/sono cambiati/,/non sovrascriverli/,/nuovi progressi interessati non sono stati salvati/,/dati più recenti/,/possono andare persi/],
    'zh-CN':[/部分/,/变更/,/避免覆盖/,/相关新进度尚未保存/,/最新数据/,/可能.*丢失/],
    th:[/บางส่วนเปลี่ยนไป/,/ไม่ให้เขียนทับ/,/ยังไม่ได้บันทึกความคืบหน้าใหม่ที่เกี่ยวข้อง/,/ข้อมูลล่าสุด/,/อาจสูญหาย/],
  };
  for(const locale of localeOrder){
    const expected=translate(locale,'practiceRecordsConflict');
    assert.notEqual(expected,translate(locale,'practiceRecordsTemporary'),locale+' conflict must not reuse unavailable copy');
    for(const meaning of meanings[locale])assert.match(expected,meaning,locale);
    for(const inline of [false,true])assert.equal(text(render(locale,Notice,{warning:true,conflict:true,inline})),expected,locale);
    assert.equal(render(locale,Notice,{warning:false,conflict:true}),'',locale+' no warning still renders nothing');
  }
});

test('both actual App notices bind all warning and conflict combinations with one shared live announcement',()=>{
  const Notice=productModule('src/components/ProgressStorageNotice.tsx').default,notices=[];
  function collect(node){if(ts.isJsxSelfClosingElement(node)&&node.tagName.getText(appTree)==='ProgressStorageNotice')notices.push(node);ts.forEachChild(node,collect);}
  collect(appTree);assert.equal(notices.length,2,'actual App must keep a global notice and a notice after the score');
  for(const progressWarning of [false,true])for(const trainingWarning of [false,true]){
    for(const progressConflict of [false,true])for(const trainingConflict of [false,true]){
      const bindings={ProgressStorageNotice:Notice,growth:{storageWarning:progressWarning,storageConflict:progressConflict},training:{storageWarning:trainingWarning,storageConflict:trainingConflict}};
      const Fragments=notices.map(node=>compileAppFragment(node,bindings));
      const Both=()=>React.createElement(React.Fragment,null,...Fragments.map((Fragment,i)=>React.createElement(Fragment,{key:i})));
      const markup=render('en',Both),warning=progressWarning||trainingWarning;
      const state=JSON.stringify([progressWarning,trainingWarning,progressConflict,trainingConflict]);
      if(!warning){assert.equal(markup,'',state);continue;}
      const expected=translate('en',progressConflict||trainingConflict?'practiceRecordsConflict':'practiceRecordsTemporary');
      assert.equal(text(markup),expected+expected,state);
      assert.equal((markup.match(/data-progress-storage-notice/g)??[]).length,2,state);
      assert.equal((markup.match(/role="status"/g)??[]).length,1,state);
      assert.equal((markup.match(/aria-live="polite"/g)??[]).length,1,state);
      assert.equal((markup.match(/aria-atomic="true"/g)??[]).length,1,state);
      assert.equal((markup.match(/progress-storage-note--inline/g)??[]).length,1,state);
    }
  }
});

test('inline notices stay ordinary paragraphs without repeated live announcements or fixed score overlays',()=>{
  const Notice=productModule('src/components/ProgressStorageNotice.tsx').default;
  for(const locale of localeOrder)for(const conflict of [false,true]){
    const markup=render(locale,Notice,{warning:true,conflict,inline:true});
    assert.match(markup,/^<p\b/);assert.match(markup,/progress-storage-note--inline/);
    assert.doesNotMatch(markup,/\brole=|\baria-live=|\baria-atomic=|<button\b|<a\b|autofocus/i,locale);
  }
  const css=source('src/components/ProgressStorageNotice.css');
  assert.match(css,/\.storage-note\.progress-storage-note--inline\s*\{/);
  assert.doesNotMatch(css,/\bposition\s*:\s*(?:fixed|sticky)\b/i,'the notice stylesheet must not pin warnings over the score');
});
