import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

const plain=value=>JSON.parse(JSON.stringify(value));
const api=loadModule('src/music/motivicStudy.ts',307);
const {describeTonality,buildPitchMaterial}=loadModule('src/music/scales.ts');
const {planPhraseHarmony}=loadModule('src/music/phraseHarmony.ts');
const {addModalPhrasing}=loadModule('src/music/modalPhrasing.ts');
const {validateGeneratedExercise}=loadModule('src/music/exerciseQuality.ts');
const {createPlaybackEvents}=loadModule('src/audio/PlaybackController.ts');
const base={instrument:'Sheng',instrumentProfile:'Sheng',clef:'treble',difficulty:'intermediate',keySignature:'C',tonic:'C',scaleId:'major',
  timeSignature:'4/4',rhythmLevel:'medium',measures:8,tempo:80,range:{min:60,max:84},allowAccidentals:false,mixedMeters:false,meters:['4/4','6/8']};
const phrases=[{startBar:0,endBar:2,role:'opening'},{startBar:3,endBar:5,role:'answer'},{startBar:6,endBar:7,role:'closing'}];
const q=(midi,startUnits)=>({midi,key:`c/${Math.floor(midi/12)-1}`,octave:Math.floor(midi/12)-1,
  startUnits,durationUnits:4,duration:'q',dots:0,rest:false});
function fixture(scaleId='major',range=base.range) {
  const tonality=describeTonality('C',scaleId),pitches=buildPitchMaterial(tonality,range).pitches;
  const measures=Array.from({length:8},(_,b)=>({timeSignature:'4/4',totalUnits:16,groups:[4,4,4,4],beamGroups:[4,4,4,4],
    events:Array.from({length:4},(_,n)=>{const p=pitches[(b+n)%pitches.length];return {...q(p.midi,n*4),key:`${p.key.toLowerCase()}/${p.octave}`};})}));
  const harmony=api.phraseDirectedHarmony(planPhraseHarmony(tonality,Array(8).fill('4/4'),307),phrases,tonality);
  return {exercise:{...base,tonality,measures,phrasePlan:phrases,harmonyPlan:harmony},pitches,harmony};
}

test('the first MVP is bounded to short, single-meter studies and never replaces grand or specialist rhythm engines',()=>{
  assert.equal(api.supportsMotivicStudy(base),true);
  for(const overrides of [{mixedMeters:true},{measures:2},{measures:32},{rhythmFocus:'triplets'},{scaleId:'atonal'},{scaleId:'pelog-pentatonic'}])
    assert.equal(api.supportsMotivicStudy({...base,...overrides}),false);
  assert.equal(api.supportsMotivicStudy(base,'two-hand'),false);
  assert.equal(api.supportsMotivicStudy(base,'mono'),false);
});

test('independent development strategies retain a recognisable clue rather than redrawing every musical dimension',()=>{
  const motif=[0,1,2,1],before=[...motif];
  const [tail,contrary]=api.MOTIVIC_DEVELOPMENTS.map(strategy=>strategy.develop(motif));
  assert.deepEqual(motif,before);
  assert.deepEqual(Array.from(tail).slice(0,3),motif.slice(0,3));
  assert.deepEqual(Array.from(contrary,n=>Math.abs(n)),motif.map(Math.abs));
  assert.notDeepEqual(Array.from(tail),Array.from(contrary));
});

test('a compatible rhythmic motive returns at a later phrase without copying a bar or changing the subdivision budget',()=>{
  const bar=units=>{let startUnits=0;return {meter:'4/4',notes:units.map(units=>{const note={units,startUnits,duration:units===1?'16':units===2?'8':'q',dots:0,rest:false};startUnits+=units;return note;})};};
  const original=[bar([1,1,2,4,4,4]),bar([4,4,4,4]),bar([2,1,1,4,2,2,4]),bar([4,4,4,4])];
  const before=JSON.stringify(original),linked=api.linkMotivicRhythm(original,[{startBar:0,endBar:1,role:'opening'},{startBar:2,endBar:3,role:'answer'}]);
  assert.equal(JSON.stringify(original),before);
  assert.deepEqual(Array.from(linked[2].notes.slice(0,4),n=>n.units),[1,1,2,4]);
  assert.notDeepEqual(plain(linked[0].notes),plain(linked[2].notes),'the complete second phrase entry is not a copied measure');
  for(let i=0;i<original.length;i++)assert.deepEqual(Array.from(linked[i].notes,n=>n.units).sort(),Array.from(original[i].notes,n=>n.units).sort());
  const unsafe=plain(original);unsafe[0].notes[0].tuplet=3;
  assert.equal(api.linkMotivicRhythm(unsafe,[{startBar:0,endBar:1,role:'opening'},{startBar:2,endBar:3,role:'answer'}]),unsafe);
});

test('phrase endings distinguish Western open/closed direction from pentatonic centers without inventing pitches',()=>{
  for(const scaleId of ['major','natural-minor','major-pentatonic','minor-pentatonic']) {
    const {exercise,harmony}=fixture(scaleId),classes=exercise.tonality.notes.map(n=>loadModule('src/music/scales.ts').pitchClass(n));
    assert.equal(harmony[2].root,7);
    assert.equal(harmony[5].root,0);assert.equal(harmony[7].root,0);
    assert.ok(harmony.every(bar=>bar.pitches.every(pc=>classes.includes(pc))));
    if(scaleId.includes('pentatonic'))assert.ok(!harmony.some(bar=>bar.pitches.includes(11)||bar.pitches.includes(2)&&scaleId==='minor-pentatonic'));
    if(scaleId==='natural-minor')assert.ok(!harmony.some(bar=>bar.pitches.includes(11)),'do not silently raise a leading tone');
  }
});

test('planned complete gestures are realized by the legal path solver with rhythm, modes and cadence intact',()=>{
  for(const scaleId of ['major','natural-minor','major-pentatonic','minor-pentatonic']) {
    const {exercise,pitches,harmony}=fixture(scaleId),before=JSON.stringify(exercise);
    const targets=api.planMotivicTargets(exercise.measures,pitches,exercise.tonality,'intermediate',phrases,harmony);
    assert.ok(targets?.some(t=>t.fixed));
    const result=addModalPhrasing(exercise,base.range,false,harmony,true,'Sheng',true);
    const sounded=result.measures.flatMap(bar=>bar.events).filter(n=>!n.rest);
    for(const target of targets.filter(t=>t.fixed))assert.equal(sounded[target.index].midi,target.midi,`${scaleId} target ${target.index}`);
    validateGeneratedExercise(result,base.range,false);
    assert.equal(JSON.stringify(exercise),before);
    assert.equal(createPlaybackEvents(result,80).duration,createPlaybackEvents(exercise,80).duration);
    assert.deepEqual(plain(result.measures.map(b=>b.events.map(n=>[n.startUnits,n.durationUnits,n.rest]))),plain(exercise.measures.map(b=>b.events.map(n=>[n.startUnits,n.durationUnits,n.rest]))));
    const entries=phrases.map(p=>sounded.slice(p.startBar*4,p.startBar*4+4).map(n=>n.midi));
    const contour=notes=>notes.slice(1).map((n,i)=>Math.sign(n-notes[i]));
    assert.deepEqual(contour(entries[1]),contour(entries[0]),'an answer remembers the opening gesture');
  }
});

test('whole-gesture range fitting respects real semitone difficulty in pentatonic material',()=>{
  const range={min:60,max:72},{exercise,pitches,harmony}=fixture('major-pentatonic',range);
  const targets=api.planMotivicTargets(exercise.measures,pitches,exercise.tonality,'beginner',phrases,harmony);
  // A complete motif may not fit this restricted register and open ending.
  // Falling back is preferable to independently clipping its notes to an edge.
  if(targets)assert.ok(targets.every(t=>t.midi>=range.min&&t.midi<=range.max));
  const shaped=addModalPhrasing({...exercise,difficulty:'beginner'},range,false,harmony,true,'Sheng',true);
  validateGeneratedExercise(shaped,range,false);
  const source=fixture('major',{min:60,max:65});
  assert.equal(api.planMotivicTargets(source.exercise.measures,source.pitches,source.exercise.tonality,'beginner',phrases,source.harmony),undefined,'unsupported narrow material uses the existing composer');
});

test('declared development seeds and untouched holdout seeds stay legal and produce distinct complete studies',()=>{
  const development=[101,307,509,911],holdout=[1613,2549],fingerprints=new Set();
  for(const [i,seed] of [...development,...holdout].entries()) {
    const {composeExercise}=loadModule('src/music/composeExercise.ts',seed);
    const exercise=composeExercise({...base,scaleId:['major','natural-minor','major-pentatonic','minor-pentatonic'][i%4],
      timeSignature:i%2?'6/8':'4/4',rhythmLevel:['simple','medium','complex'][i%3],difficulty:['beginner','intermediate','advanced'][i%3]});
    validateGeneratedExercise(exercise,base.range,false);
    const sounding=exercise.measures.flatMap(bar=>bar.events).filter(n=>!n.rest);
    assert.equal(sounding.at(-1).midi%12,0);
    fingerprints.add(sounding.map(n=>n.midi).join(','));
    assert.ok(exercise.phrasePlan.some(p=>p.endBar>p.startBar));
  }
  assert.equal(fingerprints.size,development.length+holdout.length);
});
