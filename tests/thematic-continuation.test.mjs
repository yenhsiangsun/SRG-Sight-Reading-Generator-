import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

const api=loadModule('src/music/thematicContinuation.ts');
const {describeTonality,buildPitchMaterial,pitchClass}=loadModule('src/music/scales.ts');
const {planPhraseHarmony}=loadModule('src/music/phraseHarmony.ts');
const {addModalPhrasing}=loadModule('src/music/modalPhrasing.ts');
const {validateGeneratedExercise}=loadModule('src/music/exerciseQuality.ts');
const {PITCH_DIFFICULTY}=loadModule('src/music/pitchDifficulty.ts');
const plain=x=>JSON.parse(JSON.stringify(x));
const base={instrument:'Sheng',instrumentProfile:'Sheng',clef:'treble',difficulty:'intermediate',keySignature:'C',tonic:'C',scaleId:'major',
  timeSignature:'4/4',rhythmLevel:'medium',measures:8,tempo:80,range:{min:55,max:90},allowAccidentals:false,mixedMeters:false,meters:['4/4','6/8']};
const randomFor=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
function fixture(scaleId='major',difficulty='intermediate') {
  const tonality=describeTonality('C',scaleId),pitches=buildPitchMaterial(tonality,base.range).pitches;
  const measures=Array.from({length:8},()=>({timeSignature:'4/4',totalUnits:16,groups:[4,4,4,4],beamGroups:[4,4,4,4],
    events:Array.from({length:4},(_,i)=>({key:'c/5',octave:5,midi:72,startUnits:i*4,durationUnits:4,duration:'q',dots:0,rest:false}))}));
  const phrases=api.continuationPhrases(8),harmony=api.continuationHarmony(planPhraseHarmony(tonality,Array(8).fill('4/4'),311),phrases,tonality);
  return {pitches,phrases,harmony,exercise:{...base,scaleId,difficulty,tonality,measures,phrasePlan:phrases,harmonyPlan:harmony}};
}

test('longer phrase grammar spans three to four bars without an automatic two-bar full stop',()=>{
  for(const count of [8,10,12,14,16]) {
    const phrases=api.continuationPhrases(count);
    assert.equal(phrases[0].startBar,0);assert.equal(phrases.at(-1).endBar,count-1);
    phrases.forEach((p,i)=>{assert.ok(p.endBar-p.startBar>=2);assert.ok(p.endBar-p.startBar<=3);if(i)assert.equal(p.startBar,phrases[i-1].endBar+1);});
  }
  assert.deepEqual(Array.from(api.continuationPhrases(8),p=>[p.startBar,p.endBar]),[[0,3],[4,7]]);
});

test('constructed themes have legal real intervals and multiple complete contours rather than one catalogue entry',()=>{
  const {pitches,exercise}=fixture(),signatures=new Set();
  for(const seed of [29,71,113,191,251,389,443,557,647,773,881,977]) {
    const theme=api.buildContinuationTheme(pitches,exercise.tonality,'intermediate',8,randomFor(seed));
    assert.ok(theme);assert.equal(theme.degrees.length,8);
    const midi=theme.degrees.map(i=>pitches[i].midi);
    assert.ok(midi.slice(1).every((n,i)=>Math.abs(n-midi[i])<=PITCH_DIFFICULTY.intermediate.maxLeap));
    signatures.add(theme.degrees.map(n=>n-theme.degrees[0]).join(','));
  }
  assert.ok(signatures.size>=6,`only ${signatures.size} constructed themes`);
});

test('longer rhythmic journey preserves original duration budgets, rare cells, entrance and final bar',()=>{
  let changed=0;
  for(const meter of ['3/4','4/4','6/8'])for(const level of ['simple','medium','complex']) {
    const raw=loadModule('src/music.ts',4127).createPracticeRhythmPlan({...base,timeSignature:meter,rhythmLevel:level}),before=JSON.stringify(raw);
    const shaped=api.continuationRhythm(raw),inventory=bars=>bars.flatMap(b=>b.notes.map(n=>`${n.units}/${n.duration}/${n.dots}/${n.rest}/${n.tuplet??''}`)).sort();
    assert.equal(JSON.stringify(raw),before);assert.deepEqual(Array.from(inventory(shaped)),Array.from(inventory(raw)));
    assert.deepEqual(plain(shaped.slice(0,2)),plain(raw.slice(0,2)));assert.deepEqual(plain(shaped.at(-1)),plain(raw.at(-1)));
    raw.forEach((b,i)=>b.notes.filter(n=>n.rest||n.tuplet).forEach(n=>assert.ok(shaped[i].notes.some(m=>m.startUnits===n.startUnits&&m.units===n.units&&m.rest===n.rest&&m.tuplet===n.tuplet))));
    shaped.forEach(b=>{let end=0;for(const n of b.notes){assert.ok(Math.abs(n.startUnits-end)<1e-7);end+=n.units;}});
    changed+=Number(JSON.stringify(shaped)!==before);
  }
  assert.ok(changed>=6);
});

test('phrase-level harmony keeps Western preparation separate from pentatonic open centres',()=>{
  for(const scaleId of ['major','natural-minor','major-pentatonic','minor-pentatonic']) {
    const {exercise,harmony}=fixture(scaleId),classes=exercise.tonality.notes.map(pitchClass);
    assert.equal(harmony[0].root,0);assert.equal(harmony[3].root,7);assert.equal(harmony.at(-1).root,0);
    assert.ok(harmony.every(h=>classes.includes(h.root)&&h.pitches.every(p=>classes.includes(p))));
    if(classes.length===5)assert.ok(harmony.every(h=>h.pitches.length<=2));
    if(scaleId==='natural-minor')assert.ok(!harmony.some(h=>h.pitches.includes(11)));
  }
});

test('complete long-phrase targets survive the legal solver with cadence and rhythm unchanged',()=>{
  for(const scaleId of ['major','natural-minor','major-pentatonic','minor-pentatonic'])for(const difficulty of ['beginner','intermediate','advanced']) {
    const {exercise,pitches,phrases,harmony}=fixture(scaleId,difficulty);
    const targets=api.continuationTargets(exercise.measures,pitches,exercise.tonality,difficulty,phrases,harmony);
    assert.ok(targets?.length);assert.equal(targets.length,32);
    assert.notEqual(targets[7].fixed,true,'the halfway point is not forced into a two-bar cadence');
    assert.equal(targets[15].midi%12,7,'opening phrase remains open');
    const ex=addModalPhrasing(exercise,base.range,false,harmony,true,'Sheng',true,'thematic-continuation');
    validateGeneratedExercise(ex,base.range,false);
    assert.equal(ex.measures.flatMap(b=>b.events).filter(n=>!n.rest).at(-1).midi%12,0);
    assert.deepEqual(plain(ex.measures.map(b=>b.events.map(n=>[n.startUnits,n.durationUnits,n.rest]))),plain(exercise.measures.map(b=>b.events.map(n=>[n.startUnits,n.durationUnits,n.rest]))));
  }
});

test('continuation remains an internal candidate, has narrow-range fallback and composes complete compound studies',()=>{
  const strategy=loadModule('src/music/phraseStrategy.ts');
  assert.deepEqual(Array.from(strategy.STUDY_STRATEGIES),['continuous-line','sentence-growth']);
  const {exercise,phrases,harmony}=fixture(),small=buildPitchMaterial(exercise.tonality,{min:60,max:65}).pitches;
  assert.equal(api.continuationTargets(exercise.measures,small,exercise.tonality,'advanced',phrases,harmony),undefined);
  for(const [i,seed] of [101,307,509,911].entries()) {
    const options={...base,timeSignature:i%2?'6/8':'4/4',scaleId:['major','natural-minor','major-pentatonic','minor-pentatonic'][i],
      difficulty:['beginner','intermediate','advanced'][i%3],rhythmLevel:['simple','medium','complex'][i%3]};
    const ex=loadModule('src/music/composeExercise.ts',seed).composeExercise(options,undefined,'thematic-continuation');
    validateGeneratedExercise(ex,options.range,false);assert.equal(ex.phrasePlan.length,2);
  }
});
