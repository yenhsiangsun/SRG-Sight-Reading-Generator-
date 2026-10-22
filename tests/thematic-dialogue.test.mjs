import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

const api=loadModule('src/music/thematicDialogue.ts');
const structure=loadModule('src/music/phraseStrategy.ts');
const {describeTonality,buildPitchMaterial}=loadModule('src/music/scales.ts');
const {phraseDirectedHarmony}=loadModule('src/music/motivicStudy.ts');
const {planPhraseHarmony}=loadModule('src/music/phraseHarmony.ts');
const {addModalPhrasing}=loadModule('src/music/modalPhrasing.ts');
const {validateGeneratedExercise}=loadModule('src/music/exerciseQuality.ts');
const base={instrument:'Sheng',instrumentProfile:'Sheng',clef:'treble',difficulty:'intermediate',keySignature:'C',tonic:'C',scaleId:'major',
  timeSignature:'4/4',rhythmLevel:'medium',measures:8,tempo:80,range:{min:55,max:90},allowAccidentals:false,mixedMeters:false,meters:['4/4','6/8']};
const plain=x=>JSON.parse(JSON.stringify(x));
const rhythm=x=>x.measures.map(b=>b.events.map(n=>[n.startUnits,n.durationUnits,n.rest,n.tuplet]));
function fixture(scaleId='major',difficulty='intermediate') {
  const tonality=describeTonality('C',scaleId),pitches=buildPitchMaterial(tonality,base.range).pitches;
  const measures=Array.from({length:8},()=>({timeSignature:'4/4',totalUnits:16,groups:[4,4,4,4],beamGroups:[4,4,4,4],
    events:Array.from({length:4},(_,i)=>({key:'c/5',octave:5,midi:72,startUnits:i*4,durationUnits:4,duration:'q',dots:0,rest:false}))}));
  const phrases=api.dialoguePhrases(8),harmony=phraseDirectedHarmony(planPhraseHarmony(tonality,Array(8).fill('4/4'),307),phrases,tonality);
  return {pitches,harmony,phrases,exercise:{...base,scaleId,difficulty,tonality,measures,phrasePlan:phrases,harmonyPlan:harmony}};
}

test('complete-theme candidate stays outside the default strategy registry and odd lengths retain B01',()=>{
  assert.deepEqual(Array.from(structure.STUDY_STRATEGIES),['continuous-line','sentence-growth']);
  assert.ok(structure.EXPERIMENTAL_STUDY_STRATEGIES.includes('thematic-dialogue'));
  const raw=loadModule('src/music.ts',801).createPracticeRhythmPlan({...base,measures:9});
  const fallback=structure.planStudyStructure(raw,'thematic-dialogue');
  assert.notEqual(fallback.strategy,'thematic-dialogue');
  assert.deepEqual(plain(fallback),plain(structure.planStudyStructure(raw)));
});

test('rhythmic theme development preserves inventory, metre, rests, tuplets and the full opening two bars',()=>{
  let changes=0;
  for(const meter of ['3/4','4/4','6/8'])for(const level of ['simple','medium','complex']) {
    const raw=loadModule('src/music.ts',1109).createPracticeRhythmPlan({...base,timeSignature:meter,rhythmLevel:level});
    const before=JSON.stringify(raw),after=api.dialogueRhythm(raw);
    assert.equal(JSON.stringify(raw),before);
    const inventory=bars=>bars.flatMap(b=>b.notes.map(n=>`${n.units}/${n.duration}/${n.dots}/${n.rest}/${n.tuplet??''}`)).sort();
    assert.deepEqual(Array.from(inventory(after)),Array.from(inventory(raw)));
    assert.deepEqual(plain(after.slice(0,2)),plain(raw.slice(0,2)));assert.deepEqual(plain(after.at(-1)),plain(raw.at(-1)));
    raw.forEach((bar,b)=>bar.notes.filter(n=>n.rest||n.tuplet).forEach(n=>assert.ok(after[b].notes.some(m=>m.startUnits===n.startUnits&&m.units===n.units&&m.rest===n.rest&&m.tuplet===n.tuplet))));
    after.forEach((bar,b)=>{let end=0;for(const n of bar.notes){assert.ok(Math.abs(n.startUnits-end)<1e-7);end+=n.units;}assert.equal(end,raw[b].notes.reduce((sum,n)=>sum+n.units,0));});
    changes+=Number(JSON.stringify(after)!==before);
  }
  assert.ok(changes>=6,'candidate must actually rearrange most eligible two-bar rhythms');
});

test('the melodic response remembers a full two-bar contour and development uses its fragments',()=>{
  const {exercise,pitches,phrases,harmony}=fixture();
  const targets=api.dialogueTargets(exercise.measures,pitches,exercise.tonality,'intermediate',phrases,harmony);
  assert.equal(targets.length,32);
  const degree=target=>pitches.findIndex(p=>p.midi===target.midi);
  const directions=group=>group.slice(1).map((n,i)=>Math.sign(degree(n)-degree(group[i])));
  assert.deepEqual(directions(targets.slice(0,6)),directions(targets.slice(8,14)),'a response remembers more than four entrance notes');
  assert.notDeepEqual(targets.slice(0,4).map(t=>t.midi),targets.slice(4,8).map(t=>t.midi),'second bar continues the theme');
  assert.notDeepEqual(targets.slice(16,24).map(t=>t.midi),targets.slice(0,8).map(t=>t.midi),'development is a fragment sequence, not the finished theme copied again');
});

test('legal pitch solver realizes the complete candidate across Western and pentatonic contexts',()=>{
  for(const scaleId of ['major','natural-minor','major-pentatonic','minor-pentatonic'])for(const difficulty of ['beginner','intermediate','advanced']) {
    const {exercise,pitches,phrases,harmony}=fixture(scaleId,difficulty),before=JSON.stringify(exercise);
    const planned=api.dialogueTargets(exercise.measures,pitches,exercise.tonality,difficulty,phrases,harmony);
    assert.ok(planned?.length);
    const ex=addModalPhrasing(exercise,base.range,false,harmony,true,'Sheng',true,'thematic-dialogue');
    validateGeneratedExercise(ex,base.range,false);
    assert.equal(JSON.stringify(exercise),before);assert.deepEqual(plain(rhythm(ex)),plain(rhythm(exercise)));
    const notes=ex.measures.flatMap(b=>b.events).filter(n=>!n.rest);
    assert.equal(notes.at(-1).midi%12,0);
    const same=planned.filter(t=>t.index<16&&Math.sign(t.midi-(planned[t.index-1]?.midi??t.midi))===Math.sign(notes[t.index].midi-(notes[t.index-1]?.midi??notes[t.index].midi))).length;
    assert.ok(same>=10,`${scaleId}/${difficulty}: thematic direction lost (${same}/16)`);
  }
});

test('constrained themes fall back safely and candidate generation remains bounded under actual rhythm tiers',()=>{
  const {exercise,phrases,harmony}=fixture(),small=buildPitchMaterial(exercise.tonality,{min:60,max:65}).pitches;
  assert.equal(api.dialogueTargets(exercise.measures,small,exercise.tonality,'advanced',phrases,harmony),undefined);
  for(const [index,seed] of [101,307,509,911].entries()) {
    const options={...base,scaleId:['major','natural-minor','major-pentatonic','minor-pentatonic'][index],timeSignature:index%2?'6/8':'4/4',
      difficulty:['beginner','intermediate','advanced'][index%3],rhythmLevel:['simple','medium','complex'][index%3]};
    const ex=loadModule('src/music/composeExercise.ts',seed).composeExercise(options,undefined,'thematic-dialogue');
    validateGeneratedExercise(ex,options.range,false);
    assert.equal(ex.phrasePlan.length,4);
  }
});
