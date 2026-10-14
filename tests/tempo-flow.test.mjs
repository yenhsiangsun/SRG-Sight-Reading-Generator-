import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

const {fastMotionPenalty,refineFastPassages}=loadModule('src/music/tempoFlow.ts');
const {validateGeneratedExercise}=loadModule('src/music/exerciseQuality.ts');
const plain=x=>JSON.parse(JSON.stringify(x));
const natural={60:'c/4',62:'d/4',64:'e/4',65:'f/4',67:'g/4',69:'a/4',71:'b/4',72:'c/5'};
const source=()=>({instrument:'Flute',soundProfile:'Flute',clef:'treble',difficulty:'intermediate',rhythmLevel:'complex',
  timeSignature:'4/4',keySignature:'C',tempo:160,tonality:{tonic:'C',scaleId:'major',signature:'C',notes:['C','D','E','F','G','A','B']},
  measures:Array.from({length:2},()=>({timeSignature:'4/4',totalUnits:16,groups:[4,4,4,4],beamGroups:[4,4,4,4],
    events:Array.from({length:16},(_,i)=>{const midi=i%2?72:60;return {midi,key:natural[midi],octave:midi===72?5:4,
      rest:false,startUnits:i,durationUnits:1,duration:'16',dots:0};})}))});
const notes=ex=>ex.measures.flatMap(bar=>bar.events).filter(note=>!note.rest);
const skeleton=ex=>ex.measures.map(bar=>({meter:bar.timeSignature,total:bar.totalUnits,events:bar.events.map(n=>[n.startUnits,n.durationUnits,n.duration,n.dots,n.rest])}));

test('actual fast repeated leaps receive sparse local repair without changing cadence, rhythm, tempo or source',()=>{
  const original=source(),before=plain(original),range={min:60,max:72};
  const refined=refineFastPassages(original,range,'Flute');
  assert.ok(fastMotionPenalty(refined,'Flute')<fastMotionPenalty(original,'Flute'));
  assert.deepEqual(plain(original),before);
  assert.deepEqual(plain(skeleton(refined)),plain(skeleton(original)));
  assert.equal(refined.tempo,160);
  assert.deepEqual(notes(refined).slice(-3).map(n=>n.midi),notes(original).slice(-3).map(n=>n.midi));
  const changes=notes(refined).filter((n,i)=>n.midi!==notes(original)[i].midi);
  assert.ok(changes.length>0&&changes.length<=Math.ceil(notes(original).length*.08));
  assert.ok(changes.every(note=>note.startUnits%4!==0));
  validateGeneratedExercise(refined,range,false);
});

test('the same written figure at a comfortable speed and isolated fast leaps retain their original melody',()=>{
  const slow={...source(),tempo:48};
  assert.equal(fastMotionPenalty(slow,'Flute'),0);
  assert.equal(refineFastPassages(slow,{min:60,max:72},'Flute'),slow);
  const isolated=source();
  for(const [i,note] of notes(isolated).entries()) {note.midi=i===8?72:60;note.key=natural[note.midi];note.octave=note.midi===72?5:4;}
  // One arrival/return at a protected pulse is a useful isolated exercise.
  assert.equal(refineFastPassages(isolated,{min:60,max:72},'Flute'),isolated);
});

test('eighth-note BPM and quarter-note BPM use the same absolute speed, including mixed meter',()=>{
  const quarter=source(),eighth=plain(quarter);eighth.tempo=320;eighth.timeSignature='6/8';
  eighth.measures[0].timeSignature='6/8';eighth.measures[0].totalUnits=12;eighth.measures[0].events=eighth.measures[0].events.slice(0,12);
  eighth.measures[0].groups=[6,6];eighth.measures[0].beamGroups=[6,6];
  const reference=plain(quarter);reference.measures[0]=plain(eighth.measures[0]);reference.timeSignature='3/4';
  reference.measures[0].timeSignature='3/4';reference.measures[0].groups=[4,4,4];reference.measures[0].beamGroups=[4,4,4];
  // Compare identical written onsets; total units only determine the barline.
  assert.equal(fastMotionPenalty(eighth,'Flute'),fastMotionPenalty(reference,'Flute'));
});

test('fast refinement preserves chromatic/atonal studies and already voiced chords',()=>{
  const original=source();
  assert.equal(refineFastPassages(original,{min:60,max:72},'Flute',true),original);
  const atonal={...original,tonality:{...original.tonality,scaleId:'atonal'}};
  assert.equal(refineFastPassages(atonal,{min:60,max:72},'Flute'),atonal);
  original.measures[0].events[1].chord=[{midi:60,key:'c/4',octave:4},{midi:72,key:'c/5',octave:5}];
  assert.equal(refineFastPassages(original,{min:60,max:72},'Flute'),original);
});

test('fast repair retains offbeat phrase entrances and releases as well as all three pitch grades',()=>{
  const original=source();original.phrasePlan=[{startBar:0,endBar:0,role:'opening'},{startBar:1,endBar:1,role:'closing'}];
  original.measures[1].events[0].rest=true;
  const refined=refineFastPassages(original,{min:60,max:72},'Flute');
  assert.equal(refined.measures[0].events.at(-1).midi,original.measures[0].events.at(-1).midi);
  assert.equal(refined.measures[1].events[1].midi,original.measures[1].events[1].midi);
  const {composeExercise}=loadModule('src/music/composeExercise.ts',443);
  const means=[];
  for(const difficulty of ['beginner','intermediate','advanced']) {
    let distance=0,count=0;
    for(let sample=0;sample<12;sample++) {
      const ex=composeExercise({instrument:'Sheng',instrumentProfile:'Sheng',clef:'treble',difficulty,rhythmLevel:'complex',
        keySignature:'C',tonic:'C',scaleId:'major',timeSignature:'4/4',tempo:80,measures:8,range:{min:55,max:90},
        allowAccidentals:false,mixedMeters:false,meters:['4/4','6/8']});
      ex.tempo=160;
      const result=refineFastPassages(ex,{min:55,max:90},'Sheng');validateGeneratedExercise(result,{min:55,max:90},false);
      const pitches=notes(result).map(n=>n.midi);
      for(let i=1;i<pitches.length;i++){distance+=Math.abs(pitches[i]-pitches[i-1]);count++;}
    }
    means.push(distance/count);
  }
  assert.ok(means[1]>means[0]*1.4&&means[2]>means[1]*1.25,JSON.stringify(means));
});

test('real fast generated studies preserve mode, hand ranges, melody endpoints and all instrument chord constraints',()=>{
  const {composeExercise}=loadModule('src/music/composeExercise.ts',387);
  const {addInstrumentHarmony}=loadModule('src/music/instrumentHarmony.ts',341);
  const {isShengPracticeVoicing}=loadModule('src/music/shengFingering.ts');
  for(const instrument of ['Flute','Erhu','Pipa','Sheng','Alto Sheng','Tenor Sheng','Bass Sheng','Piano']) {
    const range=instrument==='Bass Sheng'?{min:36,max:67}:instrument==='Piano'?{min:48,max:84}:{min:55,max:84};
    const ex=composeExercise({instrument:instrument==='Piano'?'Piano':'Sheng',instrumentProfile:instrument,clef:'treble',difficulty:'advanced',
      rhythmLevel:'complex',keySignature:'C',tonic:'C',scaleId:'major',timeSignature:'4/4',tempo:160,measures:8,range,allowAccidentals:false,mixedMeters:false,meters:['4/4','6/8']},instrument==='Piano'?'two-hand':undefined);
    ex.soundProfile=instrument;ex.tempo=160;
    const refined=refineFastPassages(ex,range,instrument);
    validateGeneratedExercise(refined,range,false);
    assert.deepEqual(notes(refined).slice(-3).map(n=>n.midi),notes(ex).slice(-3).map(n=>n.midi));
    const voiced=addInstrumentHarmony(refined,range);
    if(instrument.includes('Sheng'))for(const bar of voiced.measures)for(const note of bar.events)if(note.chord)
      assert.equal(isShengPracticeVoicing(note.chord.map(p=>p.midi),instrument),true);
    if(instrument==='Piano')assert.ok(voiced.lowerMeasures.flatMap(b=>b.events).filter(n=>!n.rest).every(n=>n.midi<60));
  }
});
