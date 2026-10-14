import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

const plain = value => JSON.parse(JSON.stringify(value));
const {meterSections} = loadModule('src/music/meterSections.ts');
const selected = ['4/4', '3/8', '6/8', '9/8', '12/8'];
const options = {instrument:'Sheng', clef:'treble', difficulty:'beginner', keySignature:'C',
  timeSignature:'4/4', rhythmLevel:'medium', measures:16, tempo:80, range:{min:55,max:88},
  allowAccidentals:false, mixedMeters:true, meters:selected, tonic:'C', scaleId:'major'};

test('actual meter sections are contiguous exclusive ranges, without changing the supplied meters', () => {
  const source = Object.freeze(['4/4','4/4','6/8','6/8','6/8','4/4']);
  assert.deepEqual(plain(meterSections(source)), [
    {startBar:0,endBar:2,meter:'4/4'}, {startBar:2,endBar:5,meter:'6/8'}, {startBar:5,endBar:6,meter:'4/4'},
  ]);
  assert.deepEqual(plain(meterSections([])), []);
});

test('mixed studies give each chosen meter a complete section and never leave a stranded bar', () => {
  const {planMixedMeterSequence} = loadModule('src/music/meterSections.ts', 18032);
  for (const rhythmLevel of ['simple','medium','complex']) for (const start of selected)
    for (let count=1; count<=32; count++) for (let sample=0; sample<12; sample++) {
      const sequence = planMixedMeterSequence(start, selected, count, rhythmLevel);
      assert.equal(sequence.length, count);
      assert.equal(sequence[0], start);
      assert.ok(sequence.every(meter => selected.includes(meter)));
      if (count > 1) assert.ok(new Set(sequence).size > 1, 'even a short mixed exercise changes meter');
      if (count >= 4) for (const section of meterSections(sequence)) {
        const bars = section.endBar-section.startBar;
        assert.ok(bars >= 2 && bars <= 4, JSON.stringify(sequence));
        if (section.meter === '3/8' && count >= 5) assert.ok(bars >= 3, 'short 3/8 bars form a longer gesture');
      }
    }
});

test('simple mixed practice changes less often, while every grade has different section layouts', () => {
  const averages = [];
  for (const rhythmLevel of ['simple','medium','complex']) {
    const {planMixedMeterSequence} = loadModule('src/music/meterSections.ts', 317);
    let count=0;
    const layouts = new Set();
    for (let sample=0; sample<240; sample++) {
      const sequence = planMixedMeterSequence('4/4', ['4/4','6/8','9/8'], 16, rhythmLevel);
      const sections = meterSections(sequence);
      count += sections.length;
      layouts.add(sections.map(section => section.endBar-section.startBar).join(','));
      assert.equal(new Set(sequence).size, 3, 'selected meters get heard before earlier ones repeat');
    }
    assert.ok(layouts.size >= 12, `${rhythmLevel}: ${layouts.size} section shapes`);
    averages.push(count/240);
  }
  assert.ok(averages[1] > averages[0]+.4 && averages[2] > averages[1]+.4, JSON.stringify(averages));
});

test('the rhythm pipeline preserves selected starting meters and pitch-setting independence', () => {
  for (const rhythmLevel of ['simple','medium','complex']) {
    const baseline = loadModule('src/music.ts', 782).createPracticeRhythmPlan({...options,rhythmLevel});
    for (const difficulty of ['beginner','intermediate','advanced']) for (const allowAccidentals of [false,true]) {
      const actual = loadModule('src/music.ts', 782).createPracticeRhythmPlan({...options,rhythmLevel,difficulty,allowAccidentals});
      assert.deepEqual(plain(actual), plain(baseline));
    }
    assert.equal(baseline[0].meter, '4/4');
  }
  const fallback = loadModule('src/music.ts', 72).createPracticeRhythmPlan({...options,timeSignature:'7/8',meters:['9/8','6/8']});
  assert.equal(fallback[0].meter, '9/8');
  assert.ok(fallback.every(bar => ['9/8','6/8'].includes(bar.meter)));
  const engine = loadModule('src/music.ts');
  assert.throws(() => engine.createPracticeRhythmPlan({...options,meters:['6/8','6/8']}));
  assert.throws(() => engine.createPracticeRhythmPlan({...options,measures:33}));
});

test('non-mixed rhythm selection consumes no meter draws and ignores the unused mixed selection', () => {
  const first = loadModule('src/music.ts', 734).createPracticeRhythmPlan({...options,mixedMeters:false});
  const second = loadModule('src/music.ts', 734).createPracticeRhythmPlan({...options,mixedMeters:false,meters:['3/8','7/8'],difficulty:'advanced',allowAccidentals:true});
  const direct = loadModule('src/music/phraseRhythm.ts', 734).selectPhraseRhythmPlan(Array(16).fill('4/4'),'medium');
  assert.deepEqual(plain(first),plain(second));
  assert.deepEqual(plain(first),plain(direct));
});
