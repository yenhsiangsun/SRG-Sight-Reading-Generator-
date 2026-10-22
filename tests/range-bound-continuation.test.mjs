import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadModule} from './helpers.mjs';

const api=loadModule('src/music/rangeBoundContinuation.ts');
const continuation=loadModule('src/music/thematicContinuation.ts');
const {describeTonality,buildPitchMaterial}=loadModule('src/music/scales.ts');
const {planPhraseHarmony}=loadModule('src/music/phraseHarmony.ts');
const {PITCH_DIFFICULTY}=loadModule('src/music/pitchDifficulty.ts');
const {validateGeneratedExercise}=loadModule('src/music/exerciseQuality.ts');
const {INSTRUMENTS}=loadModule('src/music/instruments.ts');
const plain=x=>JSON.parse(JSON.stringify(x));
const base={instrument:'Sheng',instrumentProfile:'Sheng',clef:'treble',difficulty:'intermediate',keySignature:'C',tonic:'C',scaleId:'major',
  timeSignature:'4/4',rhythmLevel:'medium',measures:8,tempo:80,range:{min:60,max:84},allowAccidentals:false,mixedMeters:false,meters:['4/4','6/8']};
function fixture(count=8,scaleId='major',difficulty='intermediate',meter='4/4') {
  const tonality=describeTonality('C',scaleId),pitches=buildPitchMaterial(tonality,base.range).pitches;
  const beats=meter==='4/4'?4:meter==='3/4'?3:6,unit=meter==='6/8'?2:4;
  const measures=Array.from({length:count},(_,b)=>({timeSignature:meter,totalUnits:beats*unit,
    groups:meter==='6/8'?[6,6]:Array(beats).fill(4),beamGroups:meter==='6/8'?[6,6]:Array(beats).fill(4),
    events:Array.from({length:beats},(_,i)=>({key:'c/5',octave:5,midi:72+(b%2)*2,startUnits:i*unit,durationUnits:unit,duration:unit===2?'8':'q',dots:0,rest:false}))}));
  const phrases=continuation.continuationPhrases(count),harmony=continuation.continuationHarmony(planPhraseHarmony(tonality,Array(count).fill(meter),311),phrases,tonality);
  return {measures,pitches,tonality,difficulty,phrases,harmony};
}
const args=f=>[f.measures,f.pitches,f.tonality,f.difficulty,f.phrases,f.harmony];
function legalPlan(plan,f) {
  assert.ok(plan);assert.ok(plan.proposalsTried<=12);assert.ok(plan.themeBudgetPitches<=f.pitches.length);
  assert.equal(plan.targets.length,f.measures.flatMap(b=>b.events).filter(n=>!n.rest).length);
  plan.targets.forEach((t,i)=>{assert.ok(f.pitches.some(p=>p.midi===t.midi));if(i)assert.ok(Math.abs(t.midi-plan.targets[i-1].midi)<=PITCH_DIFFICULTY[f.difficulty].maxLeap);});
  assert.equal(plan.targets.at(-1).midi%12,0);
  assert.ok(plan.targets[0].fixed&&plan.targets.at(-1).fixed&&plan.targets.at(-2).fixed);
}

test('whole-phrase placement is deterministic and immutable without consuming the global composition RNG',()=>{
  const f=fixture(12),before=JSON.stringify(f),path='src/music/rangeBoundContinuation.ts';
  const observed=loadModule(path,17,'Math.random=()=>{throw Error("global rhythm RNG used")};\n'+fs.readFileSync(path,'utf8'));
  const plan=observed.planRangeBoundContinuation(...args(f));legalPlan(plan,f);
  assert.deepEqual(plain(plan),plain(api.planRangeBoundContinuation(...args(f))));
  assert.equal(JSON.stringify(f),before);
});

test('complete opening identity survives placement rather than being individually clipped into range',()=>{
  for(const scale of ['major','major-pentatonic'])for(const length of [8,12,16]) {
    const f=fixture(length,scale),plan=api.planRangeBoundContinuation(...args(f));legalPlan(plan,f);
    assert.ok(plan.openingIdentity.length>=4);
    for(const identity of plan.openingIdentity)assert.equal(plan.targets[identity.index].midi,f.pitches[identity.degree].midi);
    assert.notEqual(plan.targets[f.measures[0].events.length*2-1].fixed,true,'the second bar is not forced into a cadence');
    assert.equal(plan.phraseShifts.length,f.phrases.length);
  }
});

test('the entire planned path respects real modal steps and grade limits for simple and compound pulses',()=>{
  for(const difficulty of ['beginner','intermediate','advanced'])for(const meter of ['3/4','4/4','6/8']) {
    const f=fixture(12,'major-pentatonic',difficulty,meter),plan=api.planRangeBoundContinuation(...args(f));legalPlan(plan,f);
    assert.ok(plan.themeDegrees.length===(meter==='4/4'?8:meter==='3/4'?6:4));
  }
});

test('unavailable material retains fallback without widening the range, inventing a tonic or accepting mixed meters',()=>{
  const f=fixture();
  assert.equal(api.planRangeBoundContinuation(...args({...f,pitches:f.pitches.slice(0,4)})),undefined);
  assert.equal(api.planRangeBoundContinuation(...args({...f,tonality:describeTonality('C','atonal')})),undefined);
  const mixed=plain(f);mixed.measures[3].timeSignature='6/8';
  assert.equal(api.planRangeBoundContinuation(...args(mixed)),undefined);
  const before=JSON.stringify(f);api.planRangeBoundContinuation(...args(f));assert.equal(JSON.stringify(f),before);
});

test('the independent candidate preserves rhythm, phrase spans and valid final composition on a known long-score diagnostic',()=>{
  const profile=INSTRUMENTS.Voice,options={...base,instrument:profile.engineInstrument,instrumentProfile:'Voice',range:{min:profile.min,max:profile.max},
    difficulty:'advanced',rhythmLevel:'complex',measures:12,scaleId:'major-pentatonic'};
  let available=0;
  const overrides={'./thematicContinuation':{...continuation,continuationTargets:(...input)=>{
    const plan=api.planRangeBoundContinuation(...input);if(plan){available++;legalPlan(plan,{pitches:input[1],difficulty:input[3],measures:input[0]});}return plan?.targets;
  }}};
  const path='src/music/composeExercise.ts';
  const old=loadModule(path,31098).composeExercise(options,undefined,'thematic-continuation');
  const candidate=loadModule(path,31098,undefined,overrides).composeExercise(options,undefined,'thematic-continuation');
  validateGeneratedExercise(candidate,options.range,false);assert.ok(available>0);
  const rhythm=ex=>plain(ex.measures.map(b=>b.events.map(n=>[n.startUnits,n.durationUnits,n.rest,n.tuplet])));
  assert.deepEqual(rhythm(candidate),rhythm(old));assert.deepEqual(plain(candidate.phrasePlan),plain(old.phrasePlan));
});

test('default and earlier candidate registries remain unchanged; range-bound planning is not silently adopted',()=>{
  const strategy=loadModule('src/music/phraseStrategy.ts');
  assert.deepEqual(Array.from(strategy.STUDY_STRATEGIES),['continuous-line','sentence-growth']);
  assert.deepEqual(Array.from(strategy.EXPERIMENTAL_STUDY_STRATEGIES),['thematic-dialogue','thematic-continuation']);
  assert.ok(!fs.readFileSync('src/music/composeExercise.ts','utf8').includes('rangeBoundContinuation'));
});
