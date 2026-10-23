import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {loadModule} from './helpers.mjs';

const plain = value => JSON.parse(JSON.stringify(value));
const appSource = fs.readFileSync(process.env.SESSION_APP_SOURCE ?? 'src/App.tsx', 'utf8');
const appTree = ts.createSourceFile('App.tsx', appSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function appExpression(name, context) {
  let expression;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(appTree) === name) expression = node.initializer?.getText(appTree);
    ts.forEachChild(node, visit);
  }
  visit(appTree);
  assert.ok(expression, `real App declaration ${name}`);
  const source = ts.transpileModule(`(${expression})`, {compilerOptions: {target: ts.ScriptTarget.ES2023}}).outputText;
  return vm.runInNewContext(source, context);
}

function hooks() {
  const slots = [], effects = [];
  let cursor = 0, dirty = false, lastArgs = [], last;
  const equal = (a, b) => a && b && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = {value: typeof initial === 'function' ? initial() : initial};
      return [slots[index].value, next => {
        const value = typeof next === 'function' ? next(slots[index].value) : next;
        if (!Object.is(value, slots[index].value)) {slots[index].value = value; dirty = true;}
      }];
    },
    useRef(initial) {const index = cursor++; if (!(index in slots)) slots[index] = {current: initial}; return slots[index];},
    useMemo(make, deps) {const index = cursor++; if (!(index in slots) || !equal(slots[index].deps, deps)) slots[index] = {deps, value: make()}; return slots[index].value;},
    useCallback(fn, deps) {return react.useMemo(() => fn, deps);},
    useEffect(effect, deps) {
      const index = cursor++, old = slots[index];
      if (old && equal(old.deps, deps)) return;
      slots[index] = {deps, cleanup: old?.cleanup};
      effects.push(() => {slots[index].cleanup?.(); slots[index].cleanup = effect();});
    },
  };
  react.useLayoutEffect = react.useEffect;
  return {
    react,
    render(fn, ...args) {
      lastArgs = args;
      let count = 0;
      do {assert.ok(count++ < 10, 'hooks settle'); dirty = false; cursor = 0; last = fn(...lastArgs); while (effects.length) effects.shift()();} while (dirty);
      return last;
    },
    unmount() {for (const slot of slots) {slot?.cleanup?.(); if (slot) slot.cleanup = undefined;}},
  };
}

function storage() {
  const values = new Map();
  return {values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value))};
}

function exerciseHook(saved = storage()) {
  const state = hooks();
  const source = fs.readFileSync(process.env.SESSION_EXERCISE_SOURCE ?? 'src/hooks/useExercise.ts', 'utf8');
  const api = loadModule('src/hooks/useExercise.ts', 821, source, {react: state.react}, {
    Error, localStorage: saved, window: {matchMedia: () => ({matches: false})},
  });
  const render = preview => state.render(api.useExercise, preview);
  const settings = {...api.DEFAULT_SETTINGS, instrument: 'Sheng', clef: 'treble', rangeMinMidi: 55, rangeMaxMidi: 90, difficulty: 'Advanced', rhythmLevel: 'Moderate', measureCount: 8};
  assert.equal(render().generateFrom(settings, 80, 80), 80);
  return {render, saved, settings, defaults: api.DEFAULT_SETTINGS};
}

const {PlaybackController} = loadModule('src/audio/PlaybackController.ts');
const {refreshSlurPhrasing} = loadModule('src/music/refreshSlurPhrasing.ts');
const {validStudy, LIBRARY_KEY} = loadModule('src/practice/library.ts');

function studio(h) {
  let bpm = 80, mode = 'practice', page = 'practice', dialog = 'library', identity = null, status = 'idle';
  const scheduled = new Map(), seeks = [], log = {starts: 0, stops: 0, capture: 0, scrolls: 0};
  let nextId = 0;
  const player = new PlaybackController({
    unlock: async () => {},
    createSynth: () => ({triggerAttackRelease() {}, releaseAll() {}, dispose() {}}),
    schedule: callback => {const id = nextId++; scheduled.set(id, callback); return id;},
    scheduleEnd: callback => {const id = nextId++; scheduled.set(id, callback); return id;},
    clear: id => scheduled.delete(id), start: () => {log.starts++;}, pause() {}, stop: () => {log.stops++;},
    getSeconds: () => 0, setTempo() {}, setLoop() {},
  }, next => {status = next;});
  const resume = {last: null, capture: () => {log.capture++;}};
  const playback = {
    stop: () => player.stop(), getPosition: () => player.getPosition(),
    seek(exercise, tempo, position) {seeks.push({exercise, tempo, position}); return player.seek(exercise, tempo, position);},
  };
  const context = {
    resume, playback, collection: {clearMessage() {}}, sessionBase: 'fresh-session',
    setBpm: value => {bpm = value;}, setMode: value => {mode = value;}, setPage: value => {page = value;},
    setDialog: value => {dialog = value;}, setSetupStep() {}, setComparison() {}, setResumeIdentity: value => {identity = value;},
    window: {scrollTo() {log.scrolls++;}},
  };
  Object.defineProperties(context, {
    practice: {get: () => h.render()}, current: {get: () => h.render().current},
    bpm: {get: () => bpm}, resumeIdentity: {get: () => identity},
  });
  return {
    player, seeks, resume, log, scheduled,
    open: study => appExpression('openStudy', context)(study),
    resumeLast: () => appExpression('resumeLast', context)(),
    home: () => appExpression('home', context)(), settings: () => appExpression('settings', context)(),
    state: () => ({bpm, mode, page, dialog, identity, status}),
    sessionId: () => appExpression('sessionId', context),
  };
}

test('resuming a legacy slur refresh uses one accepted exercise for current, completion identity and seek', async t => {
  const h = exerciseHook(), ui = studio(h); t.after(() => ui.player.dispose());
  const current = JSON.parse(fs.readFileSync(new URL('./fixtures/legacy-slur-session.json',import.meta.url))), slurs = current.exercise.expressionSpans.filter(span => span.kind === 'slur');
  assert.ok(slurs.length > 1, 'frozen pre-C generated fixture has multiple phrase slurs');
  const legacy = {...current.exercise, expressionSpans: [...current.exercise.expressionSpans.filter(span => span.kind !== 'slur'), slurs[0]]};
  assert.notEqual(refreshSlurPhrasing(legacy), legacy, 'this valid saved fixture really needs a new phrasing object');
  const study = {id: 'persistent-completed-session', created: 1, bpm: 80, settings: current.settings, exercise: legacy};
  assert.equal(validStudy(study, true), true);
  const beforeStorage = [...h.saved.values].filter(([key]) => key.includes('recent'));
  ui.resume.last = {version: 1, study, position: 7.25}; ui.resumeLast();
  const accepted = h.render().current.exercise;
  assert.notEqual(accepted, legacy);
  assert.equal(ui.state().identity.exercise, accepted, 'completion identity must use the refreshed accepted object');
  assert.equal(ui.sessionId(), study.id);
  assert.equal(ui.seeks[0].exercise, accepted, 'seek and the visible score must share the accepted object');
  assert.equal(ui.player.getPosition(), 7.25);
  await ui.player.play(accepted, 80);
  assert.equal(ui.player.getPosition(), 7.25, 'next Play keeps the restored bookmark instead of resetting it');
  assert.deepEqual([...h.saved.values].filter(([key]) => key.includes('recent')), beforeStorage, 'restoring is recent-history neutral');
  assert.deepEqual(plain(accepted.measures), plain(legacy.measures), 'refresh never rerolls notes or rhythm');
});

for (const state of ['idle', 'paused', 'playing']) {
  test(`failed saved-preset generation preserves the current score, settings, tempo and ${state} position`, async t => {
    const h = exerciseHook(), ui = studio(h); t.after(() => ui.player.dispose());
    const previous = h.render().current, settings = plain(h.render().settings);
    await ui.player.seek(previous.exercise, 80, 1.25);
    if (state !== 'idle') {await ui.player.play(previous.exercise, 80); if (state === 'paused') ui.player.pause();}
    const starts = ui.log.starts, recent = [...h.saved.values].filter(([key]) => key.includes('recent'));
    const preset = {id: 'unplayable-grand-range', created: 1, bpm: 160, settings: {...h.defaults, rangeMinMidi: 72, rangeMaxMidi: 84}};
    assert.equal(validStudy(preset, false), true, 'it is a structurally valid saved preset, but its grand-staff range cannot generate');
    ui.open(preset);
    assert.ok(h.render().error);
    assert.equal(h.render().current, previous, state);
    assert.deepEqual(plain(h.render().settings), settings);
    assert.deepEqual({bpm: ui.state().bpm, position: ui.player.getPosition(), status: ui.state().status},
      {bpm: 80, position: 1.25, status: state}, `${state}: failed generation cannot commit tempo, reset the bookmark, or stop old playback`);
    assert.equal(ui.log.starts, starts, 'failure never starts new audio, even through the fake adapter');
    assert.equal(ui.state().dialog, null, 'existing modal close behavior is preserved');
    assert.deepEqual([...h.saved.values].filter(([key]) => key.includes('recent')), recent);
  });
}

test('a successful preset commits its explicit tempo and instrument only after generation without auto-playing', async t => {
  const h = exerciseHook(), ui = studio(h); t.after(() => ui.player.dispose());
  const old = h.render().current;
  await ui.player.seek(old.exercise, 80, 2); await ui.player.play(old.exercise, 80);
  const starts = ui.log.starts;
  const preset = {id: 'flute-preset', created: 1, bpm: 160, settings: {...h.settings, instrument: 'Flute', rangeMinMidi: 60, rangeMaxMidi: 84, difficulty: 'Intermediate', allowedKeySignatures: ['G'], measureCount: 4}};
  assert.equal(validStudy(preset, false), true); ui.open(preset);
  const current = h.render().current;
  assert.notEqual(current.exercise, old.exercise); assert.equal(current.settings.instrument, 'Flute');
  assert.equal(current.exercise.soundProfile, 'Flute'); assert.equal(current.exercise.tempo, 160); assert.equal(ui.state().bpm, 160);
  assert.equal(current.exercise.keySignature, 'G'); assert.equal(ui.state().status, 'idle');
  assert.equal(ui.player.getPosition(), 0); assert.equal(ui.log.starts, starts); assert.equal(ui.scheduled.size, 0);
});

test('repeated instrument and difficulty changes keep accepted snapshots independent and failed drafts do not commit', () => {
  const h = exerciseHook();
  const presets = [
    {...h.settings, instrument: 'Pipa', rangeMinMidi: 45, rangeMaxMidi: 88, clef: 'mixedStaff', difficulty: 'Beginner', rhythmLevel: 'Simple', allowedKeySignatures: ['C']},
    {...h.settings, instrument: 'Flute', rangeMinMidi: 60, rangeMaxMidi: 84, difficulty: 'Intermediate', rhythmLevel: 'Moderate', allowedKeySignatures: ['G']},
    {...h.settings, instrument: 'Sheng', difficulty: 'Advanced', rhythmLevel: 'Complex', allowedKeySignatures: ['D']},
  ];
  const snapshots = [];
  for (let round = 0; round < 2; round++) for (const settings of presets) {
    assert.equal(h.render().generateFrom(settings, 80, 80), 80);
    const current = h.render().current;
    assert.equal(current.exercise.soundProfile, settings.instrument);
    assert.equal(current.settings.difficulty, settings.difficulty);
    assert.equal(current.exercise.keySignature, settings.allowedKeySignatures[0]);
    snapshots.push({current, serialized: JSON.stringify(current)});
  }
  const last = h.render().current, previousSettings = plain(h.render().settings);
  assert.equal(h.render().generateFrom({...h.settings, rangeMinMidi: 90, rangeMaxMidi: 55}, 80), false);
  assert.equal(h.render().current, last); assert.deepEqual(plain(h.render().settings), previousSettings);
  for (const snapshot of snapshots) assert.equal(JSON.stringify(snapshot.current), snapshot.serialized);
});

test('saving then reopening an exact score retains its notes and does not modify unrelated fake storage', () => {
  const h = exerciseHook(), state = hooks(), ui = studio(h);
  const {useLibrary} = loadModule('src/hooks/useLibrary.ts', 1, undefined, {react: state.react}, {
    Error, localStorage: h.saved, crypto: {randomUUID: () => 'saved-score-1'},
  });
  const renderLibrary = () => state.render(useLibrary), current = h.render().current;
  h.saved.setItem('unrelated-test-key', 'untouched');
  assert.equal(renderLibrary().save({exercise: current.exercise, settings: current.settings, bpm: 80}, 'scores'), true);
  const saved = renderLibrary().library.scores[0]; assert.equal(validStudy(saved, true), true);
  h.render().change('instrument', 'Flute'); h.render().change('difficulty', 'Beginner');
  ui.open(saved);
  assert.deepEqual(plain(h.render().current.exercise.measures), plain(saved.exercise.measures));
  assert.equal(h.render().current.settings.instrument, saved.settings.instrument);
  assert.equal(ui.state().bpm, 80); assert.equal(h.saved.getItem('unrelated-test-key'), 'untouched');
  assert.equal(JSON.parse(h.saved.getItem(LIBRARY_KEY)).scores.length, 1); ui.player.dispose();
});

test('home and settings callbacks capture before stopping and retain the accepted score on return', async t => {
  const h = exerciseHook(), ui = studio(h); t.after(() => ui.player.dispose());
  const current = h.render().current; await ui.player.seek(current.exercise, 80, 2);
  ui.home(); assert.equal(ui.state().page, 'home'); assert.equal(ui.log.capture, 1); assert.equal(ui.player.getPosition(), 0);
  assert.equal(h.render().current, current); ui.settings(); assert.equal(ui.state().page, 'setup');
  assert.equal(ui.log.capture, 2); assert.equal(h.render().current, current); assert.equal(ui.log.starts, 0);
});

function events() {
  const listeners = new Map();
  return {
    addEventListener(type, callback) {if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(callback);},
    removeEventListener(type, callback) {listeners.get(type)?.delete(callback);},
    fire(type) {for (const callback of [...(listeners.get(type) ?? [])]) callback();},
    count: type => listeners.get(type)?.size ?? 0,
  };
}

test('the real resume hook owns one timer and lifecycle listener pair, then removes them on exit and unmount', () => {
  const h = exerciseHook(), current = h.render().current, state = hooks();
  const saved = storage(), page = events(), document = events(), intervals = new Map();
  let nextTimer = 0, position = 1.25;
  const window = {...page, localStorage: saved,
    setInterval(callback, duration) {assert.equal(duration, 1000); const id = nextTimer++; intervals.set(id, callback); return id;},
    clearInterval(id) {intervals.delete(id);},
  };
  const {usePracticeResume} = loadModule('src/hooks/usePracticeResume.ts', 1, undefined, {react: state.react}, {window, document});
  const {LAST_PRACTICE_KEY} = loadModule('src/practice/resume.ts');
  const study = {id: 'cleaned-session', exercise: current.exercise, settings: current.settings, bpm: 80};
  const getPosition = () => position, render = active => state.render(usePracticeResume, study, active, getPosition);
  saved.setItem('unrelated-test-key', 'untouched');
  for (let cycle = 0; cycle < 4; cycle++) {
    for (let rerender = 0; rerender < 20; rerender++) render(true);
    assert.equal(intervals.size, 1); assert.equal(page.count('pagehide'), 1); assert.equal(document.count('visibilitychange'), 1);
    position += 0.5; page.fire('pagehide');
    assert.equal(JSON.parse(saved.getItem(LAST_PRACTICE_KEY)).position, position);
    position += 0.5; document.fire('visibilitychange');
    assert.equal(JSON.parse(saved.getItem(LAST_PRACTICE_KEY)).position, position);
    position += 0.5; for (const callback of intervals.values()) callback();
    assert.equal(JSON.parse(saved.getItem(LAST_PRACTICE_KEY)).position, position);
    render(false);
    assert.equal(intervals.size, 0); assert.equal(page.count('pagehide'), 0); assert.equal(document.count('visibilitychange'), 0);
    const stored = saved.getItem(LAST_PRACTICE_KEY); position += 0.5; page.fire('pagehide'); document.fire('visibilitychange');
    assert.equal(saved.getItem(LAST_PRACTICE_KEY), stored, 'inactive lifecycle events cannot write a stale session');
  }
  render(true); state.unmount();
  assert.equal(intervals.size, 0); assert.equal(page.count('pagehide'), 0); assert.equal(document.count('visibilitychange'), 0);
  const stored = saved.getItem(LAST_PRACTICE_KEY); position += 0.5; page.fire('pagehide'); document.fire('visibilitychange');
  assert.equal(saved.getItem(LAST_PRACTICE_KEY), stored); assert.equal(saved.getItem('unrelated-test-key'), 'untouched');
});

test('the real compact-screen hook keeps a single resize preference listener and releases it on unmount', () => {
  const state = hooks(), preference = {...events(), matches: false};
  const {useCompactScreen} = loadModule('src/hooks/useCompactScreen.ts', 1, undefined, {react: state.react}, {window: {matchMedia: () => preference}});
  for (let count = 0; count < 30; count++) assert.equal(state.render(useCompactScreen), false);
  assert.equal(preference.count('change'), 1);
  preference.matches = true; preference.fire('change'); assert.equal(state.render(useCompactScreen), true);
  preference.matches = false; preference.fire('change'); assert.equal(state.render(useCompactScreen), false);
  state.unmount(); assert.equal(preference.count('change'), 0);
});

test('the real companion hook retains one window and viewport resize/scroll listener then releases all three', () => {
  const state = hooks(), page = events(), viewport = {...events(), width: 900, height: 700, offsetLeft: 0, offsetTop: 0};
  const window = {...page, visualViewport: viewport, innerWidth: 900, innerHeight: 700}, saved = storage();
  const {useCompanionDrag} = loadModule('src/hooks/useCompanionDrag.ts', 1, undefined, {react: state.react}, {window, localStorage: saved});
  let initial;
  for (let count = 0; count < 30; count++) initial = state.render(useCompanionDrag).geometry;
  assert.equal(page.count('resize'), 1); assert.equal(viewport.count('resize'), 1); assert.equal(viewport.count('scroll'), 1);
  viewport.width = 320; viewport.height = 600; viewport.fire('resize');
  const narrow = state.render(useCompanionDrag).geometry; assert.notDeepEqual(narrow, initial);
  viewport.offsetTop = 20; viewport.fire('scroll'); state.render(useCompanionDrag);
  page.fire('resize'); state.render(useCompanionDrag);
  state.unmount(); assert.equal(page.count('resize'), 0); assert.equal(viewport.count('resize'), 0); assert.equal(viewport.count('scroll'), 0);
  assert.equal(saved.values.size, 0, 'layout-only events do not change saved companion position');
});
