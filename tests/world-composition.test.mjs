import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

const {composeExercise}=loadModule('src/music/composeExercise.ts',20261010);
const {validateGeneratedExercise}=loadModule('src/music/exerciseQuality.ts');
const options={instrument:'Sheng',instrumentProfile:'Sheng',clef:'treble',difficulty:'intermediate',keySignature:'C',
  timeSignature:'4/4',rhythmLevel:'medium',measures:8,tempo:80,range:{min:55,max:90},allowAccidentals:false,
  mixedMeters:false,meters:['4/4'],tonic:'C',scaleId:'major'};

test('same-key studies vary their melodic entry and neighbouring cadence while keeping a complete tonic ending',()=>{
  const entries=new Set(),approaches=new Set(),melodies=new Set(),colors=new Set();
  for(let sample=0;sample<96;sample++) {
    const exercise=composeExercise(options);
    validateGeneratedExercise(exercise,options.range,false);
    const notes=exercise.measures.flatMap(bar=>bar.events).filter(note=>!note.rest);
    const final=notes.at(-1),previous=notes.at(-2);
    entries.add(notes[0].midi%12);approaches.add(previous.midi%12);
    notes.forEach(note=>colors.add(note.midi%12));
    melodies.add(notes.map(note=>note.midi-notes[0].midi).join(','));
    assert.equal(final.midi%12,0);
    assert.ok(final.durationUnits>=4);
    assert.ok(Math.abs(final.midi-previous.midi)>0&&Math.abs(final.midi-previous.midi)<=3);
    assert.ok([0,4,7].includes(notes[0].midi%12),'the opening belongs to the home harmony');
  }
  assert.deepEqual([...entries].sort((a,b)=>a-b),[0,4,7]);
  assert.ok(approaches.has(2)&&approaches.has(11),'both falling and rising major cadences are audible');
  assert.ok(colors.has(5)&&colors.has(11),'major-scale fourth/seventh degrees are not suppressed into pentatonic material');
  assert.ok(melodies.size>=90,'fixed key and settings still produce distinct complete melodic lines');
});

test('equal note counts no longer determine one repeated harmonic progression',()=>{
  const grouped=new Map();
  for(let sample=0;sample<100;sample++) {
    const exercise=composeExercise({...options,rhythmLevel:'simple'});
    const count=exercise.measures.reduce((sum,bar)=>sum+bar.events.length,0);
    if(!grouped.has(count))grouped.set(count,new Set());
    grouped.get(count).add(exercise.harmonyPlan.map(bar=>bar.root).join(','));
  }
  assert.ok([...grouped.values()].some(progressions=>progressions.size>=4),
    'harmony uses the fresh composition identity, not the total number of notes');
});
