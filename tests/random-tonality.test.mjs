import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

const {selectRandomTonality, getTonalityDistribution, tonalityFamily, signatureGroup} = loadModule('src/music/randomTonality.ts');
const {SCALES, describeTonality, buildPitchMaterial} = loadModule('src/music/scales.ts');
const {generateGrandExercise} = loadModule('src/music/grandStaff.ts', 971);

function selectScale(index, ranges) {
  const choices = getTonalityDistribution(ranges);
  const target = choices.find(scale => scale.scaleId === SCALES[index].id);
  const start = choices.slice(0, choices.indexOf(target)).reduce((sum, choice) => sum + choice.weight, 0);
  return selectRandomTonality(ranges, () => start + target.weight / 2);
}

test('automatic selection keeps all 33 scales reachable and prefers readable spellings', () => {
  assert.equal(SCALES.length, 33);
  const signatures = new Set(['C', 'G', 'D', 'A', 'E', 'F', 'Bb', 'Eb', 'Ab']);
  SCALES.forEach((scale, index) => {
    const selected = selectScale(index, [{min: 48, max: 84}]);
    assert.equal(selected.scaleId, scale.id);
    const tonality = describeTonality(selected.tonic, selected.scaleId);
    assert.ok(tonality.notes.every(note => note.length <= 2), `${scale.id}: ${tonality.notes}`);
    assert.ok(tonality.signature === null || signatures.has(tonality.signature), `${scale.id}: ${tonality.signature}`);
    if (scale.id === 'atonal') assert.equal(tonality.tonic, null);
  });
});

test('automatic selection never leaves a narrow custom range without scale pitches', () => {
  for (let min = 21; min < 108; min++) {
    const range = {min, max: min + 1};
    SCALES.forEach((scale, index) => {
      const selected = selectScale(index, [range]);
      assert.equal(selected.scaleId, scale.id);
      const material = buildPitchMaterial(describeTonality(selected.tonic, selected.scaleId), range);
      assert.ok(material.pitches.length > 0, `${scale.id} ${min}`);
    });
  }
});

test('one randomly selected tonality supplies valid pitches to both grand-staff hands', () => {
  const range = {min: 58, max: 61};
  const handRanges = [{min: 60, max: 61}, {min: 58, max: 59}];
  SCALES.forEach((scale, index) => {
    const selected = selectScale(index, [range, ...handRanges]);
    assert.equal(selected.scaleId, scale.id);
    const exercise = generateGrandExercise({instrument: 'Piano', clef: 'treble', difficulty: 'beginner', keySignature: 'C', timeSignature: '4/4', rhythmLevel: 'simple', measures: 2, tempo: 72, range, allowAccidentals: false, mixedMeters: false, meters: ['4/4'], ...selected}, 'two-hand');
    const material = buildPitchMaterial(exercise.tonality, range);
    for (const [hand, measures] of [exercise.measures, exercise.lowerMeasures].entries()) {
      const notes = measures.flatMap(measure => measure.events).filter(note => !note.rest);
      assert.ok(notes.length > 0);
      for (const note of notes) {
        assert.ok(material.pitchClasses.includes(note.midi % 12));
        assert.ok(note.midi >= handRanges[hand].min && note.midi <= handRanges[hand].max);
      }
    }
  });
});

test('auto-tonality validates ranges before searching candidate transpositions', () => {
  for (const ranges of [[], [{min: 70, max: 60}], [{min: NaN, max: 72}], [{min: 60.5, max: 70}], [{min: -1, max: 72}], [{min: 60, max: 128}]]) {
    assert.throws(() => selectRandomTonality(ranges));
  }
});

for (const [scaleId, pitchClasses] of [
  ['egyptian-pentatonic', [0, 2, 5, 7, 10]],
  ['pelog-pentatonic', [0, 1, 3, 7, 8]],
  ['slendro-pentatonic', [0, 2, 5, 7, 10]],
]) test(`${scaleId} preview applies once, then restores random scales and chromatic preferences`, () => {
  const state = [];
  let cursor = 0;
  const react = {useState(initial) {
    const index = cursor++;
    if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial;
    return [state[index], next => {state[index] = typeof next === 'function' ? next(state[index]) : next;}];
  }};
  const hook = loadModule('src/hooks/useExercise.ts', 829, undefined, {react}, {window: {matchMedia: () => ({matches: false})}});
  const render = () => {cursor = 0; return hook.useExercise({tonic: 'C', scaleId});};
  assert.equal(render().previewPending, true);
  assert.equal(typeof render().generateNew(72, {allowAccidentals: true}), 'number');
  const first = render().current;
  assert.equal(first.exercise.tonality.scaleId, scaleId);
  assert.equal(first.exercise.tonality.tonic, 'C');
  assert.equal(first.settings.allowAccidentals, false);
  assert.equal(first.isPreview, true);
  assert.equal(render().previewPending, false);
  for (const note of first.exercise.measures.flatMap(measure => measure.events).filter(note => !note.rest)) {
    assert.ok(pitchClasses.includes(note.midi % 12));
  }
  const chosen = new Set(), groups = new Set();
  render().change('instrument', 'Pipa');
  for (let n = 0; n < 20; n++) {
    assert.equal(typeof render().generateNew(72), 'number');
    const {current} = render();
    assert.equal(current.isPreview, false);
    assert.equal(current.settings.allowAccidentals, true);
    chosen.add(current.exercise.tonality.scaleId);
    groups.add(signatureGroup(current.exercise.tonality.signature));
  }
  assert.ok(chosen.size > 5);
  assert.ok(groups.has('sharp') && groups.has('flat'));
});

test('practice gives Western tonal modes a majority without losing world scales or key signatures', () => {
  for (const allowAccidentals of [false, true]) {
    const counts = {'major-minor-modes': 0, pentatonic: 0, colour: 0};
    const signatures = new Set();
    for (let i = 0; i < 200; i++) {
      const selected = selectRandomTonality([{min: 48, max: 84}], () => (i + .5) / 200, {allowAccidentals});
      counts[tonalityFamily(selected.scaleId)]++;
      signatures.add(signatureGroup(describeTonality(selected.tonic, selected.scaleId).signature));
    }
    assert.deepEqual(counts, {'major-minor-modes': 130, pentatonic: 50, colour: 20});
    assert.equal(signatures.size, 4);
  }
});

test('invalid and production preview links are ignored; cleanup preserves unrelated URL parameters', () => {
  const {getTonalityPreview, withoutTonalityPreview} = loadModule('src/practice/tonalityPreview.ts', 1, undefined, {}, {URL, URLSearchParams});
  assert.equal(getTonalityPreview('?previewScale=pelog-pentatonic', false), undefined);
  assert.equal(getTonalityPreview('?previewScale=not-a-scale', true), undefined);
  assert.equal(getTonalityPreview('', true), undefined);
  assert.equal(getTonalityPreview('?previewScale=pelog-pentatonic', true).scaleId, 'pelog-pentatonic');
  assert.equal(withoutTonalityPreview('http://localhost:5173/?previewScale=pelog-pentatonic&keep=1#score'), '/?keep=1#score');
});

test('new exercises choose afresh, preserve snapshot tonality and leave instrument preferences intact', () => {
  const state = [];
  let cursor = 0;
  const react = {useState(initial) {
    const index = cursor++;
    if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial;
    return [state[index], next => {state[index] = typeof next === 'function' ? next(state[index]) : next;}];
  }};
  const hook = loadModule('src/hooks/useExercise.ts', 829, undefined, {react}, {window: {matchMedia: () => ({matches: false})}});
  const render = () => {cursor = 0; return hook.useExercise();};
  render().change('allowAccidentals', true);
  render().change('instrument', 'Guzheng');
  assert.equal(render().settings.allowAccidentals, true);
  render().change('allowAccidentals', false);
  render().change('scaleId', 'major');
  render().change('tonic', 'C');
  const chosen = new Set();
  // Sample enough complete generations that a changed rhythm RNG sequence is
  // not mistaken for a missing scale in the balanced world-mode distribution.
  for (let n = 0; n < 100; n++) {
    const tempo = render().generateNew(72);
    assert.equal(typeof tempo, 'number');
    assert.notEqual(tempo, 72);
    const {current} = render();
    assert.equal(current.exercise.tempo, tempo);
    assert.equal(current.number, n + 1);
    assert.equal(current.settings.scaleId, current.exercise.tonality.scaleId);
    assert.equal(current.exercise.tonality.tonic, current.settings.scaleId === 'atonal' ? null : current.settings.tonic);
    assert.equal(current.exercise.grandMode, 'mono');
    assert.equal(current.exercise.soundProfile, 'Guzheng');
    chosen.add(current.settings.scaleId);
  }
  assert.ok(chosen.size > 15, `selected only ${chosen.size} scales`);
});
