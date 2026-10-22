import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

const plain=value=>JSON.parse(JSON.stringify(value));
const {composeExercise}=loadModule('src/music/composeExercise.ts',2026180090);
const {planStudyMelody}=loadModule('src/music/studyMelody.ts');
const {buildPitchMaterial}=loadModule('src/music/scales.ts');
const {melodicVoice,validateGeneratedExercise}=loadModule('src/music/exerciseQuality.ts');
const range={min:48,max:84};
const sharedPhrases=[
  {startBar:0,endBar:3,role:'opening'},
  {startBar:4,endBar:5,role:'answer'},
  {startBar:6,endBar:7,role:'closing'},
];
const options={instrument:'Sheng',instrumentProfile:'Sheng',clef:'treble',difficulty:'intermediate',
  keySignature:'C',tonic:'C',scaleId:'major',timeSignature:'4/4',rhythmLevel:'medium',measures:8,
  tempo:80,range,allowAccidentals:false,mixedMeters:false,meters:['4/4']};

function scalarShaper(){
  const plans=[];
  const module=loadModule('src/music/scalePractice.ts',90210,undefined,{
    './studyMelody':{planStudyMelody(...args){
      const result=planStudyMelody(...args);
      plans.push(plain(result));
      return result;
    }},
  });
  return {shape:module.addScalePractice,plans};
}
const voices=exercise=>[melodicVoice(exercise),...(exercise.grandMode==='two-hand'?[exercise.lowerMeasures]:[])];
const timing=exercise=>plain(voices(exercise).map(staff=>staff.map(bar=>({
  meter:bar.timeSignature,total:bar.totalUnits,groups:bar.groups,beamGroups:bar.beamGroups,
  events:bar.events.map(note=>[note.startUnits,note.durationUnits,note.rest,note.tuplet??null]),
}))));

function assertScalarLegality(exercise){
  validateGeneratedExercise(exercise,range,false);
  for(const [staffIndex,staff] of voices(exercise).entries()){
    const voiceRange=exercise.grandMode==='two-hand'?(staffIndex===0?{min:60,max:range.max}:{min:range.min,max:59}):range;
    const material=buildPitchMaterial(exercise.tonality,voiceRange).pitches.map(pitch=>pitch.midi);
    const notes=staff.flatMap(bar=>bar.events).filter(note=>!note.rest);
    assert.ok(notes.every(note=>material.includes(note.midi)&&!note.chord));
    const steps=notes.slice(1).map((note,index)=>Math.abs(material.indexOf(note.midi)-material.indexOf(notes[index].midi)));
    assert.ok(steps.filter(step=>step<=1).length>=steps.length*.65,'scalar steps remain the main material');
    assert.equal(notes.at(-1).midi%12,0,'retain the reachable tonic cadence');
    assert.ok(steps.at(-1)<=1,'retain a scalar approach to the cadence');
  }
}

for(const mode of [undefined,'mono','two-hand'])test(`scalar ${mode??'single'} voice uses the supplied shared phrase boundaries`,()=>{
  const source=composeExercise({...options,...(mode?{instrument:'Piano',instrumentProfile:'Piano'}:{})},mode);
  source.phrasePlan=plain(sharedPhrases);
  const before=JSON.stringify(source),originalTiming=timing(source),{shape,plans}=scalarShaper();
  const result=shape(source,range);
  assert.equal(plans.length,mode==='two-hand'?2:1);
  for(const plan of plans){
    const boundaries=plan.phrases.map(({startBar,endBar,role})=>({startBar,endBar,role}));
    assert.deepEqual(boundaries,sharedPhrases,'the scalar figure must turn at the same phrase boundaries as breathing and expression');
    assert.equal(plan.phrases.find(phrase=>phrase.role==='answer').figure,plan.phrases[0].figure);
  }
  assert.equal(JSON.stringify(source),before,'leave the source score intact');
  assert.deepEqual(plain(result.phrasePlan),sharedPhrases);
  assert.deepEqual(timing(result),originalTiming,'preserve meters, rests, tuplets and durations in both hands');
  assert.deepEqual(plain(result.harmonyPlan),plain(source.harmonyPlan));
  assertScalarLegality(result);
});

test('legacy scalar input without a shared phrase plan keeps the generated fallback',()=>{
  const source=composeExercise(options);
  delete source.phrasePlan;
  const before=JSON.stringify(source),{shape,plans}=scalarShaper();
  const result=shape(source,range);
  assert.equal(plans.length,1);
  assert.ok(plans[0].phrases.length>=2,'legacy inputs still receive a whole-study phrase layout');
  assert.equal(plans[0].phrases[0].startBar,0);
  assert.equal(plans[0].phrases.at(-1).endBar,source.measures.length-1);
  assert.equal(result.phrasePlan,undefined,'do not invent stored metadata for legacy inputs');
  assert.equal(JSON.stringify(source),before);
  assert.deepEqual(timing(result),timing(source));
  assertScalarLegality(result);
});
