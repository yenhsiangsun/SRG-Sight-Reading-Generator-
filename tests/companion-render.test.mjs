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
  const output = ts.transpileModule(fs.readFileSync(absolute, 'utf8').replaceAll('import.meta.env.BASE_URL', JSON.stringify('/')), {
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

test('every companion renders both styles with unique paint IDs and original Mimo remains unchanged', () => {
  const {CompanionPortrait} = component('src/components/CompanionPortrait.tsx');
  const {PET_IDS} = loadModule('src/progress/progress.ts');
  const arts = [null, ...PET_IDS].flatMap(pet => ['classic', 'storybook'].map(design => ({pet, design})));
  const markup = renderToStaticMarkup(React.createElement('div', {}, arts.map(({pet, design}) =>
    React.createElement(CompanionPortrait, {key: `${pet}-${design}`, pet, design}))));
  assert.equal((markup.match(/<svg\b/g) ?? []).length, arts.length);
  const identifiers = [...markup.matchAll(/ id="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(identifiers).size, identifiers.length, 'paint servers cannot cross-colour another preview');
  const ids = new Set(identifiers);
  for (const match of markup.matchAll(/url\(#([^)]+)\)/g)) assert.ok(ids.has(match[1]), `missing SVG paint ${match[1]}`);
  const original = renderToStaticMarkup(React.createElement(CompanionPortrait, {pet: null, design: 'classic'}));
  assert.ok(original.includes('M149 30q11-6 22 0l44 139q3 11-9 11h-92q-12 0-9-11Z'), 'the original metronome silhouette is retained');
  assert.equal(original.includes('soft-companion__pendulum'), false);
  assert.equal(original.includes('forest-storybook-v2.png'), false);
  assert.ok(markup.includes('data-pet="pet-ragdoll" data-design="classic"'));
  assert.equal((markup.match(/data-storybook-pet=/g) ?? []).length, PET_IDS.length + 1);
});

test('all forest animals map to distinct valid regions in the bundled transparent atlas', () => {
  const {storybookRegions} = loadModule('src/progress/storybookAtlas.ts');
  const {PET_IDS} = loadModule('src/progress/progress.ts');
  const png = fs.readFileSync('public/companions/forest-storybook-v2.png');
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
  assert.equal(png[25], 6, 'the atlas must retain RGBA transparency');
  const regions = [null, ...PET_IDS].map(pet => storybookRegions[pet ?? 'original']);
  assert.equal(new Set(regions.map(region => JSON.stringify(region))).size, regions.length);
  for (const [x, y, w, h] of regions) {
    assert.ok(x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= width && y + h <= height);
  }
});
