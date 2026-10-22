import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import * as jsxRuntime from 'react/jsx-runtime';
import {loadModule} from './helpers.mjs';

const {searchMessages, searchNamed} = loadModule('src/i18n/searchMessages.ts');
const fixtures = [
  {name: 'Piano', zh: '鋼琴', family: '鍵盤', clef: 'grand', min: 21, max: 108},
  {name: 'Pipa', zh: '琵琶', family: '國樂・彈撥', clef: 'treble', min: 45, max: 88},
  {name: 'Flute', zh: '長笛', family: '木管', clef: 'treble', min: 60, max: 96},
];
const t = key => searchMessages[key]?.[1] ?? key;
const file = 'src/components/SetupPage.tsx';
const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: {jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS},
}).outputText;

function mount() {
  const states = [];
  let cursor = 0;
  const settings = {instrument: 'Piano', difficulty: 'Beginner', mixedMeters: false, meters: ['4/4'], rangeMinMidi: 21, rangeMaxMidi: 108};
  const changes = [];
  const react = {
    useState(initial) {
      const slot = cursor++;
      if (!(slot in states)) states[slot] = typeof initial === 'function' ? initial() : initial;
      return [states[slot], value => {states[slot] = typeof value === 'function' ? value(states[slot]) : value;}];
    },
    useRef: () => ({current: null}), useEffect() {}, useId: () => `search-${cursor++}`,
  };
  const Component = loadModule(file, 1, source, {
    react, 'react/jsx-runtime': jsxRuntime,
    '../hooks/useStudioMotion': {useSetupStepMotion() {}},
    '../hooks/useCompactScreen': {useCompactScreen: () => false},
    '../i18n/context': {useI18n: () => ({locale: 'en', t})},
    '../progress/words': {words: (_locale, _zh, en) => en},
    '../i18n/musicLabels': {instrumentLabel: name => ({Piano: 'Piano', Pipa: 'Chinese lute', Flute: 'Flute'})[name]},
    '../music/instruments': {INSTRUMENT_LIST: fixtures, INSTRUMENTS: Object.fromEntries(fixtures.map(item => [item.name, item]))},
    '../exerciseConfig': {CLEFS: [], TIME_SIGNATURES: [], RANGE_OPTIONS: [], midiToNoteLabel: value => String(value)},
    './StaffRangePicker': {}, './InstrumentArtwork': {InstrumentArtwork: () => null}, './KeySignaturePicker': {},
    './MixedClefPicker': {MixedClefPicker: () => null},
    './CompositionStylePicker': {CompositionStylePicker: () => null},
    './InstrumentSelection.css': {},
    './SetupWizard.css': {},
  }).default;
  return {
    changes,
    render() {cursor = 0; return Component({settings, change: (...args) => changes.push(args), onStart() {}, error: ''});},
  };
}

function elements(node) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(elements);
  return [node, ...elements(node.props?.children)];
}
const find = (tree, predicate) => elements(tree).find(predicate);
const input = tree => find(tree, node => node.type === 'input' && node.props.type === 'search');
const cards = tree => elements(tree).filter(node => node.props?.className?.startsWith('instrument-card '));
const button = (tree, label) => find(tree, node => node.type === 'button' && (node.props['aria-label'] === label || node.props.children === label));
const search = (app, value) => {input(app.render()).props.onChange({target: {value}}); return app.render();};

test('instrument search trims surrounding whitespace and matches localized and source names', () => {
  const app = mount();
  assert.equal(cards(search(app, '   ')).length, 3);
  assert.equal(cards(search(app, '  cHiNeSe LuTe  ')).length, 1);
  assert.equal(cards(search(app, ' 琵琶 ')).length, 1);
  assert.equal(cards(search(app, '  FLUTE  ')).length, 1);
  assert.deepEqual(app.changes, [], 'filtering never changes the selected instrument or its settings');
});

test('the explicit clear action restores all results and returns keyboard focus to search', () => {
  const app = mount();
  const tree = search(app, 'unknown');
  assert.equal(cards(tree).length, 0);
  let focused = 0;
  input(tree).props.ref.current = {focus() {focused++;}};
  button(tree, t('clearInstrumentSearch')).props.onClick();
  assert.equal(input(app.render()).props.value, '');
  assert.equal(cards(app.render()).length, 3);
  assert.equal(focused, 1);
  assert.deepEqual(app.changes, []);
});

test('empty-state actions recover the active filters independently and retain the chosen instrument', () => {
  const app = mount();
  button(app.render(), 'keyboard').props.onClick();
  let tree = search(app, 'pipa');
  assert.equal(cards(tree).length, 0);
  const empty = find(tree, node => node.props?.className === 'instrument-search-empty');
  let focused = 0;
  input(tree).props.ref.current = {focus() {focused++;}};
  button(empty, t('allInstrumentFamilies')).props.onClick();
  tree = app.render();
  assert.equal(focused, 1, 'focus returns to search when its recovery action disappears');
  assert.equal(input(tree).props.value, 'pipa');
  assert.equal(cards(tree).length, 1);
  assert.equal(cards(tree)[0].props['aria-pressed'], false, 'search does not select its matching result');
  button(tree, 'keyboard').props.onClick();
  tree = app.render();
  button(find(tree, node => node.props?.className === 'instrument-search-empty'), t('clearInstrumentSearch')).props.onClick();
  tree = app.render();
  assert.equal(cards(tree).length, 1);
  assert.equal(cards(tree)[0].props['aria-pressed'], true, 'clearing retains the keyboard category and selected Piano');
  const status = find(tree, node => node.props?.role === 'status');
  assert.equal(status.props['aria-live'], 'polite');
  assert.match(status.props.children, /1.*keyboard/);
  assert.equal(find(tree, node => node.props?.className === 'instrument-grid').props['aria-live'], undefined);
  assert.deepEqual(app.changes, []);
});

test('all 12 languages provide search recovery copy and preserve feedback placeholders', () => {
  for (const [key, row] of Object.entries(searchMessages)) {
    assert.equal(row.length, 12, key);
    for (const text of row) assert.ok(text.trim(), key);
  }
  for (const text of searchMessages.instrumentSearchResults) {
    assert.deepEqual(text.match(/\{\w+\}/g), ['{count}', '{family}']);
  }
  for (const index of [10, 11]) {
    const named = searchNamed(index);
    for (const key of Object.keys(searchMessages)) assert.equal(named[key], searchMessages[key][index]);
  }
});
