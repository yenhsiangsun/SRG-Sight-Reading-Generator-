import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

const {planStudyMelody}=loadModule('src/music/studyMelody.ts');
const fixedPlan=loadModule('src/music/studyMelody.ts',1,undefined,{
  './melodicContours':{melodicRandom:()=>()=>.36},
}).planStudyMelody;
const {buildPitchMaterial,describeTonality}=loadModule('src/music/scales.ts');
const {composeExercise}=loadModule('src/music/composeExercise.ts',63871);
const {validateGeneratedExercise,melodicVoice}=loadModule('src/music/exerciseQuality.ts');
const {pulseGroups}=loadModule('src/music/meterFeel.ts');
const {createPlaybackEvents}=loadModule('src/audio/PlaybackController.ts');
const range={min:55,max:90},tonality=describeTonality('C','major');
const pitches=buildPitchMaterial(tonality,range).pitches;
const base={instrument:'Sheng',instrumentProfile:'Sheng',clef:'treble',difficulty:'intermediate',keySignature:'C',
  timeSignature:'4/4',rhythmLevel:'medium',measures:16,tempo:80,range,allowAccidentals:false,
  mixedMeters:true,meters:['4/4','3/8','6/8','9/8','12/8'],tonic:'C',scaleId:'major'};

function fixture(meters,units=2) {
  return meters.map(timeSignature=>{
    const groups=pulseGroups({timeSignature,groups:[]}),totalUnits=groups.reduce((a,b)=>a+b,0);
    return {timeSignature,totalUnits,groups,beamGroups:groups,
      events:Array.from({length:totalUnits/units},(_,index)=>({midi:60,key:'c/4',octave:4,rest:false,
        duration:units===1?'16':'8',dots:0,startUnits:index*units,durationUnits:units}))};
  });
}
function plannedByTime(measures,plan) {
  const slots=measures.flatMap((bar,b)=>bar.events.filter(n=>!n.rest).map(n=>`${b}/${n.startUnits}`));
  return new Map(plan.targets.map(target=>[slots[target.index],target.midi]));
}

test('extra subdivisions decorate the same /8 pulse path instead of advancing the melody by note count',()=>{
  for(const meter of ['3/8','6/8','9/8','12/8'])for(const difficulty of ['beginner','intermediate','advanced']) {
    const coarse=fixture(Array(8).fill(meter)),fine=fixture(Array(8).fill(meter),1);
    const original=plannedByTime(coarse,fixedPlan(coarse,pitches,0,difficulty));
    const subdivided=plannedByTime(fine,fixedPlan(fine,pitches,0,difficulty));
    for(const [time,midi] of original)assert.equal(subdivided.get(time),midi,`${meter}/${difficulty}/${time}`);
  }
});

test('six eighths in 3/4 and 6/8 get different melodic groupings with identical form choices',()=>{
  for(const difficulty of ['beginner','intermediate','advanced']) {
    const simple=fixedPlan(fixture(Array(8).fill('3/4')),pitches,0,difficulty);
    const compound=fixedPlan(fixture(Array(8).fill('6/8')),pitches,0,difficulty);
    assert.equal(simple.form,compound.form);
    assert.notDeepEqual(compound.targets.map(t=>t.midi),simple.targets.map(t=>t.midi));
  }
});

test('mixed-meter phrases turn at the actual change and cover every sounded note exactly once',()=>{
  for(const rhythmLevel of ['simple','medium','complex'])for(let sample=0;sample<20;sample++) {
    const exercise=composeExercise({...base,rhythmLevel});
    const voice=melodicVoice(exercise),plan=planStudyMelody(voice,pitches,0,exercise.difficulty);
    const starts=new Set(plan.phrases.map(phrase=>phrase.startBar));
    voice.forEach((bar,b)=>{
      if(b&&bar.timeSignature!==voice[b-1].timeSignature)assert.ok(starts.has(b),'a new meter starts a new gesture');
    });
    for(const phrase of plan.phrases) {
      assert.equal(new Set(voice.slice(phrase.startBar,phrase.endBar+1).map(bar=>bar.timeSignature)).size,1);
    }
    assert.equal(new Set(plan.targets.map(t=>t.index)).size,voice.flatMap(bar=>bar.events).filter(n=>!n.rest).length);
  }
});

test('new mixed-meter melodies retain graded playable paths, modal endings and unchanged note-value timing',()=>{
  const joins=[];
  for(const difficulty of ['beginner','intermediate','advanced'])for(const rhythmLevel of ['simple','medium','complex'])
    for(const scaleId of ['major','natural-minor','dorian','major-pentatonic']) {
      const exercise=composeExercise({...base,difficulty,rhythmLevel,scaleId});
      validateGeneratedExercise(exercise,range,false);
      const notes=exercise.measures.flatMap(bar=>bar.events).filter(n=>!n.rest);
      assert.equal(notes.at(-1).midi%12,0);
      assert.ok(notes.at(-1).durationUnits>=4);
      exercise.measures.forEach((bar,b)=>{
        if(b&&bar.timeSignature!==exercise.measures[b-1].timeSignature) {
          const before=exercise.measures[b-1].events.filter(n=>!n.rest).at(-1),after=bar.events.find(n=>!n.rest);
          if(before&&after)joins.push(Math.abs(before.midi-after.midi));
        }
      });
      const expected=exercise.measures.reduce((sum,bar)=>sum+bar.totalUnits,0)*60/base.tempo/4;
      assert.ok(Math.abs(createPlaybackEvents(exercise,base.tempo).duration-expected)<1e-8);
    }
  assert.ok(joins.filter(distance=>distance<=5).length/joins.length>.8,
    `new groupings usually enter through a connected interval: ${joins.filter(distance=>distance<=5).length}/${joins.length}`);
});
