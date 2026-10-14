import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadModule} from './helpers.mjs';

const require = createRequire(import.meta.url);
const cache = new Map();
function component(filename) {
  const absolute = path.resolve(filename);
  if (cache.has(absolute)) return cache.get(absolute).exports;
  const module = {exports: {}};
  cache.set(absolute, module);
  const output = ts.transpileModule(fs.readFileSync(absolute, 'utf8').replaceAll('import.meta.env.BASE_URL', JSON.stringify('/')).replaceAll('import.meta.env.DEV', 'false'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX},
  }).outputText;
  vm.runInNewContext(output, {module, exports: module.exports, require(name) {
    if (name.endsWith('.css')) return {};
    if (!name.startsWith('.')) return require(name);
    const target = path.resolve(path.dirname(absolute), name);
    return component(fs.existsSync(`${target}.tsx`) ? `${target}.tsx` : `${target}.ts`);
  }}, {filename: absolute});
  return module.exports;
}

const {createProgress} = loadModule('src/progress/progress.ts');
const {recordCompanionPractice, selectCompanionStage} = loadModule('src/progress/companionGrowth.ts');
const {CompanionDesignPicker} = component('src/components/CompanionDesignPicker.tsx');
const render = (progress, pet = null) => renderToStaticMarkup(React.createElement(CompanionDesignPicker, {progress, pet}));

test('growth picker prevents locked forms and permits keeping an unlocked younger form', () => {
  const initial = createProgress();
  const baby = render(initial);
  assert.equal((baby.match(/ disabled=""/g) ?? []).length, 2, 'young and adult remain visible but unselectable');
  assert.ok(baby.includes('再陪伴 30 分鐘'));
  let grown = recordCompanionPractice(initial, null, 10800);
  grown = selectCompanionStage(grown, null, 'young');
  const young = render(grown);
  assert.equal((young.match(/ disabled=""/g) ?? []).length, 0, 'all earned appearances remain selectable');
  assert.ok(young.includes('少年<span class="companion-design-check" aria-hidden="true">✓'));
  assert.ok(young.includes('class="companion-growth-auto" aria-pressed="false"'));
});

test('unowned reward previews cannot change growth and no public art picker exposes classic', () => {
  const markup = render(createProgress(), 'pet-musicfox');
  assert.equal((markup.match(/ disabled=""/g) ?? []).length, 3);
  assert.equal(markup.includes('class="companion-growth-auto"'), false);
  assert.ok(markup.includes('兌換後開始陪伴牠長大'));
  assert.equal(markup.includes('經典原版'), false);
  assert.equal(markup.includes('data-design="classic"'), false);
});
