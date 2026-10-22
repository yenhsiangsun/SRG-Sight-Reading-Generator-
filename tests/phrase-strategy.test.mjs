import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

const plain=x=>JSON.parse(JSON.stringify(x));
const {planStudyStructure,strategyPhrases,STUDY_STRATEGIES}=loadModule('src/music/phraseStrategy.ts');
const base={instrument:'Sheng',instrumentProfile:'Sheng',clef:'treble',difficulty:'intermediate',keySignature:'C',tonic:'C',scaleId:'major',
  timeSignature:'4/4',rhythmLevel:'medium',measures:8,tempo:80,range:{min:60,max:84},allowAccidentals:false,mixedMeters:false,meters:['4/4','6/8']};
const rhythm=exercise=>exercise.measures.map(b=>b.events.map(n=>[n.startUnits,n.durationUnits,n.rest,n.tuplet]));
const inventory=bars=>bars.flatMap(b=>b.notes.map(n=>`${n.units}/${n.duration}/${n.dots}/${n.rest}/${n.tuplet??''}`)).sort();

test('phrase strategies arrange complete, contrasting phrases without one-bar fragments',()=>{
  for(const count of [8,9,10,12,16]) {
    const plans=STUDY_STRATEGIES.map(s=>strategyPhrases(count,s));
    assert.notDeepEqual(plain(plans[0]),plain(plans[1]));
    for(const phrases of plans) {
      assert.equal(phrases[0].startBar,0);assert.equal(phrases.at(-1).endBar,count-1);
      assert.equal(phrases.at(-1).role,'closing');
      assert.ok(phrases.some(p=>p.role==='development'));
      phrases.forEach((p,i)=>{assert.ok(p.endBar>p.startBar);if(i)assert.equal(p.startBar,phrases[i-1].endBar+1);});
    }
  }
});

test('rhythmic development changes whole-phrase activity while preserving duration, rest and tuplet budgets',()=>{
  let changed=0;
  for(const meter of ['3/4','4/4','6/8'])for(const level of ['simple','medium','complex']) {
    const {createPracticeRhythmPlan}=loadModule('src/music.ts',331);
    const original=createPracticeRhythmPlan({...base,timeSignature:meter,rhythmLevel:level}),before=JSON.stringify(original);
    for(const strategy of STUDY_STRATEGIES) {
      const developed=planStudyStructure(original,strategy).rhythm;
      assert.equal(JSON.stringify(original),before);
      assert.deepEqual(Array.from(inventory(developed)),Array.from(inventory(original)));
      assert.deepEqual(plain(developed[0]),plain(original[0]));assert.deepEqual(plain(developed.at(-1)),plain(original.at(-1)));
      for(const bar of developed) {
        let end=0;
        for(const n of bar.notes){assert.ok(Math.abs(n.startUnits-end)<1e-7);end+=n.units;}
        assert.ok(Math.abs(end-original[0].notes.reduce((sum,n)=>sum+n.units,0))<1e-7);
      }
      if(JSON.stringify(developed)!==before)changed++;
    }
  }
  assert.ok(changed>=12,'most real fixtures must actually change rhythm, not merely return strategy labels');
});

test('two strategies use distinct rhythm and pitch development under the same seed and challenge budget',()=>{
  const {validateGeneratedExercise}=loadModule('src/music/exerciseQuality.ts');
  const {createPlaybackEvents}=loadModule('src/audio/PlaybackController.ts');
  let rhythmDifferences=0;
  for(const [index,seed] of [101,307,509,911].entries()) {
    const options={...base,scaleId:['major','natural-minor','major-pentatonic','minor-pentatonic'][index],timeSignature:index%2?'6/8':'4/4'};
    const studies=STUDY_STRATEGIES.map(s=>loadModule('src/music/composeExercise.ts',seed).composeExercise(options,undefined,s));
    for(const ex of studies){validateGeneratedExercise(ex,options.range,false);assert.equal(createPlaybackEvents(ex,80).duration,options.timeSignature==='6/8'?36:24);}
    assert.notDeepEqual(plain(studies[0].phrasePlan),plain(studies[1].phrasePlan));
    assert.notDeepEqual(plain(studies[0].measures.map(b=>b.events.map(n=>n.midi))),plain(studies[1].measures.map(b=>b.events.map(n=>n.midi))));
    if(JSON.stringify(rhythm(studies[0]))!==JSON.stringify(rhythm(studies[1])))rhythmDifferences++;
  }
  assert.ok(rhythmDifferences>=3,'a strategy comparison must be audible through time as well as pitch');
});

test('strategy rhythm is independent of pitch grade, chromatic option and instrumental pitch focus',()=>{
  for(const strategy of STUDY_STRATEGIES) {
    let reference;
    for(const options of [{difficulty:'beginner'},{difficulty:'intermediate'},{difficulty:'advanced'},{allowAccidentals:true},{pitchFocus:'scales'}]) {
      const ex=loadModule('src/music/composeExercise.ts',607).composeExercise({...base,...options},undefined,strategy);
      const signature=JSON.stringify(rhythm(ex));reference??=signature;assert.equal(signature,reference);
    }
  }
});

test('whole-line guides preserve actual scale membership, real leap limits and tonic cadence across families',()=>{
  const {validateGeneratedExercise}=loadModule('src/music/exerciseQuality.ts');
  for(const [index,instrumentProfile] of ['Sheng','AltoSheng','Flute','Erhu','Pipa'].entries())for(const strategy of STUDY_STRATEGIES) {
    const options={...base,instrumentProfile,scaleId:index%2?'major-pentatonic':'natural-minor',difficulty:index%2?'beginner':'advanced'};
    const ex=loadModule('src/music/composeExercise.ts',1709+index).composeExercise(options,undefined,strategy);
    validateGeneratedExercise(ex,options.range,false);
    const notes=ex.measures.flatMap(b=>b.events).filter(n=>!n.rest);
    assert.equal(notes.at(-1).midi%12,0);
  }
});
