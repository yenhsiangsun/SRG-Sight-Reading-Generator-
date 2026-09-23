import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

const plain=value=>JSON.parse(JSON.stringify(value));
const levels=['beginner','intermediate','advanced'];
const rhythms=['simple','medium','complex'];
const base={instrument:'Piano',clef:'treble',difficulty:'beginner',keySignature:'C',timeSignature:'4/4',
  rhythmLevel:'complex',measures:16,tempo:72,range:{min:48,max:84},allowAccidentals:false,
  mixedMeters:false,meters:['4/4','6/8','7/8'],tonic:'C',scaleId:'major'};
const engine=loadModule('src/music.ts',910);
const skeleton=ex=>plain(ex.measures.map(m=>({meter:m.timeSignature,units:m.totalUnits,groups:m.beamGroups,
  events:m.events.map(n=>({start:n.startUnits,units:n.durationUnits,duration:n.duration,dots:n.dots,rest:n.rest}))})));

test('pitch difficulty and extra accidentals cannot change rhythms, rests or mixed-meter ordering',()=>{
  const api=loadModule('src/music.ts');
  for(const meter of Object.keys(api.TIME_SIGNATURES))for(const rhythmLevel of rhythms) {
    const ex=loadModule('src/music.ts',820).generatePracticeExercise({...base,timeSignature:meter,rhythmLevel});
    for(const difficulty of levels)for(const allowAccidentals of [false,true]) {
      const other=loadModule('src/music.ts',820).generatePracticeExercise({...base,timeSignature:meter,rhythmLevel,difficulty,allowAccidentals});
      assert.deepEqual(skeleton(other),skeleton(ex));
    }
  }
  for(const rhythmFocus of ['balanced','sixteenths','dotted']) {
    const options={...base,mixedMeters:true,rhythmFocus};
    const ex=loadModule('src/music.ts',193).generatePracticeExercise(options);
    for(const difficulty of levels)assert.deepEqual(skeleton(loadModule('src/music.ts',193).generatePracticeExercise({...options,difficulty,allowAccidentals:true})),skeleton(ex));
  }
});

test('pitch grades increase melodic leaps and optional chromatic density without exceeding range or leap limits',()=>{
  const stats=levels.map(difficulty=>{
    let count=0,chromatic=0,distance=0,steps=0,leaps=0;
    for(let i=0;i<24;i++){
      const ex=engine.generatePracticeExercise({...base,measures:32,difficulty,allowAccidentals:true});
      const notes=ex.measures.flatMap(m=>m.events).filter(n=>!n.rest);
      for(let n=0;n<notes.length;n++){
        const note=notes[n];count++;
        if(![0,2,4,5,7,9,11].includes(note.midi%12))chromatic++;
        assert.ok(note.midi>=48&&note.midi<=84);
        if(n){const d=Math.abs(note.midi-notes[n-1].midi);assert.ok(d<={beginner:7,intermediate:12,advanced:24}[difficulty]);distance+=d;leaps++;if(d<=2)steps++;}
      }
    }
    return {chromatic:chromatic/count,meanLeap:distance/leaps,steps:steps/leaps};
  });
  const bands=[[.02,.06],[.07,.13],[.14,.21]];
  stats.forEach((s,i)=>assert.ok(s.chromatic>bands[i][0]&&s.chromatic<bands[i][1],JSON.stringify(stats)));
  assert.ok(stats[0].steps>.5);
  assert.ok(stats[1].meanLeap>stats[0].meanLeap+.5&&stats[2].meanLeap>stats[1].meanLeap+.5,JSON.stringify(stats));
});

test('turning off extra chromatic notes preserves each mode, including required minor-scale alterations',()=>{
  for(const difficulty of levels)for(const scaleId of ['major','harmonic-minor','egyptian-pentatonic','atonal']) {
    const ex=engine.generatePracticeExercise({...base,difficulty,scaleId,allowAccidentals:false});
    const {buildPitchMaterial}=loadModule('src/music/scales.ts');
    const material=buildPitchMaterial(ex.tonality,base.range);
    for(const note of ex.measures.flatMap(m=>m.events).filter(n=>!n.rest))assert.ok(material.pitchClasses.includes(note.midi%12));
    if(scaleId==='harmonic-minor')assert.ok(material.pitchClasses.includes(11),'C harmonic minor retains its raised leading note');
  }
});

test('piano accompaniment follows selected rhythm complexity even with beginner pitch difficulty',()=>{
  const {generateGrandExercise}=loadModule('src/music/grandStaff.ts',672);
  for(const timeSignature of ['4/4','6/8','7/8']) {
    const shares=rhythms.map(rhythmLevel=>{
      const ex=generateGrandExercise({...base,timeSignature,rhythmLevel,measures:32},'two-hand');
      const notes=ex.lowerMeasures.flatMap(m=>m.events).filter(n=>!n.rest);
      ex.measures.forEach((m,i)=>assert.equal(m.totalUnits,ex.lowerMeasures[i].totalUnits));
      return notes.filter(n=>n.durationUnits===1).length/notes.length;
    });
    assert.ok(shares[2]>shares[1]+.1&&shares[1]>shares[0]+.08,`${timeSignature}: ${shares}`);
  }
});
