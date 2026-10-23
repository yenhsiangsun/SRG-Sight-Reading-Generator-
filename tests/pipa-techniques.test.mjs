import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

const {addPipaTechniques,validPipaTechnique}=loadModule('src/music/pipaTechniques.ts');
const {pipaChordFingering}=loadModule('src/music/pipaFingering.ts');
const {notePitches,forMonophonicAssessment}=loadModule('src/music/notePitches.ts');
const {createPlaybackEvents}=loadModule('src/audio/PlaybackController.ts');
const {composeExercise}=loadModule('src/music/composeExercise.ts',3913);
const {addInstrumentHarmony}=loadModule('src/music/instrumentHarmony.ts',72);
const {describeTonality}=loadModule('src/music/scales.ts');
const {validStudy,readLibrary}=loadModule('src/practice/library.ts');
const plain=x=>JSON.parse(JSON.stringify(x));
const pitch=midi=>({midi,key:['c','c#','d','d#','e','f','f#','g','g#','a','a#','b'][midi%12]+'/'+(Math.floor(midi/12)-1),octave:Math.floor(midi/12)-1});
const note=(midi,i=0)=>({...pitch(midi),duration:'q',dots:0,durationUnits:4,startUnits:i*4,rest:false});
const measure=keys=>({events:keys.map(note),timeSignature:'4/4',totalUnits:16,groups:[4,4,4,4],beamGroups:[4,4,4,4]});
const source=()=>({instrument:'Sheng',soundProfile:'Pipa',clef:'treble',difficulty:'intermediate',keySignature:'C',timeSignature:'4/4',rhythmLevel:'simple',tempo:100,tonality:describeTonality('C','major'),measures:[measure([69,64,67,72]),measure([72,74,76,72]),measure([69,67,64,62]),measure([64,62,59,60])]});
const all=ex=>[...ex.measures,...(ex.lowerMeasures??[])].flatMap(b=>b.events);

test('pipa open-string chords occupy unique adjacent strings',()=>{
  const drone=pipaChordFingering([45,60].map(pitch));
  assert.ok(drone?.some(p=>p.fret===0));
  const chord=pipaChordFingering([52,55,60].map(pitch));
  assert.ok(chord);assert.equal(new Set(chord.map(p=>p.string)).size,3);
  assert.equal(pipaChordFingering([45,47].map(pitch)),null);
  assert.equal(pipaChordFingering([60,60].map(pitch)),null);
});

test('pipa technique decoration is sparse, modal, within range and preserves the entire composed melody/rhythm',()=>{
  const kinds=new Set();
  for(let seed=0;seed<50;seed++) {
    const range={min:45,max:86};
    const exercise=composeExercise({instrument:'Sheng',instrumentProfile:'Pipa',clef:'treble',difficulty:'intermediate',keySignature:'C',timeSignature:'4/4',rhythmLevel:'medium',measures:8,tempo:100,range,allowAccidentals:false,mixedMeters:false,meters:['4/4'],tonic:'C',scaleId:'major'});
    exercise.soundProfile='Pipa';
    const original=addInstrumentHarmony(exercise,range),before=plain(original), decorated=addPipaTechniques(original,range);
    assert.deepEqual(plain(original),before);
    const events=all(decorated),prior=all(original);
    assert.ok(events.filter(n=>n.technique).length<=3);
    events.forEach((n,i)=>{
      for(const key of ['key','midi','startUnits','durationUnits','rest','duration','dots'])assert.equal(n[key],prior[i][key]);
      if(n.technique){assert.ok(validPipaTechnique(n));kinds.add(n.technique);}
      for(const p of notePitches(n)){assert.ok(p.midi>=45&&p.midi<=86);assert.ok([0,2,4,5,7,9,11].includes(p.midi%12));}
    });
  }
  assert.deepEqual([...kinds].sort(),['pipa-open-double','pipa-roll']);
  const nonPipa={...source(),soundProfile:'Violin'};assert.equal(addPipaTechniques(nonPipa,{min:45,max:86}),nonPipa);
});

test('finger rolls reserve a playable interior melody note before cadence or chord decorations',()=>{
  const original=source(),before=plain(original);
  const exercise=addPipaTechniques(original,{min:45,max:86},()=>.5);
  const interior=exercise.measures.slice(1,-1).flatMap(b=>b.events).filter(n=>n.technique==='pipa-roll');
  assert.ok(interior.length>0,'a middle bar can carry the roll instead of only the last note');
  assert.deepEqual(plain(original),before,'the source score is not mutated');
  assert.ok(all(exercise).filter(n=>n.technique).length<=2,'interior priority shares the existing sparse budget');
  all(exercise).forEach((n,i)=>{for(const key of ['midi','key','duration','dots','durationUnits','startUnits','rest'])assert.equal(n[key],all(original)[i][key]);});
});

test('every tier requires a full written beat for a finger roll, and fast tempos cannot force short rolls',()=>{
  const original=source();
  original.measures=Array.from({length:4},()=>({...measure([]),events:Array.from({length:8},(_,i)=>({
    ...pitch(69+(i%2)),duration:i%2?'16':'8',dots:i%2?0:1,durationUnits:i%2?1:3,startUnits:Math.floor(i/2)*4+(i%2?3:0),rest:false,
  }))}));
  const decorated=addPipaTechniques(original,{min:45,max:86},()=>.5);
  assert.ok(all(decorated).every(n=>n.technique!=='pipa-roll'),'dotted eighths are shorter than a written beat');
  const playback=createPlaybackEvents(decorated,80,true),written=createPlaybackEvents(original,80);
  assert.equal(playback.duration,written.duration);
  assert.ok(playback.events.every(e=>e.time>=0&&e.time+e.duration<=playback.duration+1e-9));
  for(const difficulty of ['beginner','intermediate','advanced']){
    const score=addPipaTechniques({...original,difficulty},{min:45,max:86},()=>.5);
    assert.ok(all(score).every(n=>n.technique!=='pipa-roll'),'all tiers require a quarter or longer');
  }
  assert.equal(validPipaTechnique({...note(69),duration:'8',dots:1,durationUnits:3,technique:'pipa-roll'}),false);
  assert.equal(validPipaTechnique({...note(69),duration:'8',durationUnits:2,technique:'pipa-roll'}),false);
  const fast=addPipaTechniques({...source(),tempo:240},{min:45,max:86},()=>.5);
  assert.ok(all(fast).every(n=>n.technique!=='pipa-roll'),'do not force five-finger rolls into very short real durations');
});

test('current ordinary styles and rhythm tiers use an interior roll whenever the composed line has a legal opportunity',()=>{
  const api=loadModule('src/music/__pipaInterior.ts',78007,`export {composeExercise} from './composeExercise';export {addInstrumentHarmony} from './instrumentHarmony';export {addPerformanceMarks} from './performanceMarks';export {addPipaTechniques} from './pipaTechniques';`);
  const opportunities={simple:0,medium:0,complex:0};
  for(const compositionStyle of ['classical','lyrical','pentatonic'])for(const rhythmLevel of ['simple','medium','complex'])for(const difficulty of ['beginner','intermediate','advanced']){
    const range={min:45,max:88};
    let original=api.composeExercise({instrument:'Sheng',instrumentProfile:'Pipa',compositionStyle,clef:'treble',difficulty,keySignature:'C',tonic:'C',scaleId:compositionStyle==='pentatonic'?'major-pentatonic':'major',timeSignature:'4/4',rhythmLevel,measures:8,tempo:80,range,allowAccidentals:false,mixedMeters:false,meters:['4/4']});
    original=api.addPerformanceMarks(api.addInstrumentHarmony({...original,soundProfile:'Pipa'},range));
    const suitable=original.measures.slice(1,-1).flatMap(b=>b.events).filter(n=>!n.rest&&!n.chord&&!n.tuplet&&n.midi>=57&&n.durationUnits>=4);
    const decorated=api.addPipaTechniques(original,range);
    assert.ok(all(decorated).filter(n=>n.technique==='pipa-roll').every(n=>n.durationUnits>=4||n.pipaRollGroup),'short notes only occur within a continuous roll with a held-note anchor');
    if(suitable.length){opportunities[rhythmLevel]++;assert.ok(decorated.measures.slice(1,-1).some(b=>b.events.some(n=>n.technique==='pipa-roll')),`${compositionStyle}/${rhythmLevel}/${difficulty}`);}
    all(decorated).forEach((n,i)=>{for(const key of ['midi','durationUnits','startUnits','rest'])assert.equal(n[key],all(original)[i][key]);});
  }
  assert.ok(opportunities.simple>=3,'exercise legal interior holds across pitch grades in sparse studies');
  assert.ok(opportunities.complex>=3,'exercise legal interior holds across pitch grades without requiring medium rhythms to imitate the old grammar');
});

test('technique playback retains finger rolls but disables legacy sweeps without changing score or assessment time',()=>{
  const exercise=source();exercise.measures=[measure([69,64,67,60])];
  const notes=exercise.measures[0].events;
  notes[0].technique='pipa-roll';
  notes[2].technique='pipa-brush';notes[2].chord=[52,67].map(pitch);
  notes[3].technique='pipa-arpeggio';notes[3].chord=[52,55,60].map(pitch);
  const written=createPlaybackEvents(exercise,60),audible=createPlaybackEvents(exercise,60,true);
  assert.equal(written.duration,4);assert.equal(audible.duration,4);
  assert.equal(written.events.length,7);assert.equal(audible.events.length,18);
  assert.equal(audible.events.filter(e=>e.time<1).length,12);
  assert.equal(audible.events.find(e=>e.time===1).note,'e4');
  assert.ok(audible.events.filter(e=>e.time>=2&&e.time<3).every(e=>e.time===2),'legacy brush chord attacks together');
  assert.ok(audible.events.filter(e=>e.time>=3).every(e=>e.time===3),'legacy arpeggio chord attacks together');
  assert.ok(audible.events.every(e=>e.time+e.duration<=4+1e-9));
  const single=forMonophonicAssessment(exercise);
  assert.equal(all(single).some(n=>n.chord||n.technique),false);
  assert.equal(createPlaybackEvents(single,60).events.length,4);
  assert.ok(notes[0].technique,'original study preserved');
});

test('saved pipa techniques reject incompatible instrument, retired technique, and contradictory staccato',()=>{
  const exercise=source();exercise.measures[0].events[0].technique='pipa-roll';
  const study={id:'pipa',created:1,bpm:100,exercise,settings:{instrument:'Pipa',clef:'mixedStaff',difficulty:'Intermediate',rhythmLevel:'Simple',rangeMinMidi:45,rangeMaxMidi:86,keySignature:'C',tonic:'C',scaleId:'major',timeSignature:'4/4',measureCount:4,allowAccidentals:false,mixedMeters:false,meters:['4/4'],performanceMarks:true}};
  assert.ok(validStudy(study,true));
  const legacy=plain(study);
  legacy.exercise.measures[0].events[0].technique='pipa-harmonic';
  const restored=readLibrary(JSON.stringify({version:1,scores:[legacy],presets:[]}));
  assert.equal(restored.scores.length,1,'retiring a technique must not erase a saved study');
  const expected=plain(legacy);delete expected.exercise.measures[0].events[0].technique;
  assert.deepEqual(plain(restored.scores[0]),expected,'only remove the annotation; retain notes, timing and settings');
  const bad=plain(study);bad.exercise.measures[0].events[0].articulation='staccato';assert.equal(validStudy(bad,true),false);
  delete bad.exercise.measures[0].events[0].articulation;
  bad.exercise.measures[0].events[0]={...note(60),technique:'pipa-harmonic'};assert.equal(validStudy(bad,true),false);
  const other=plain(study);other.settings.instrument=other.exercise.soundProfile='Violin';assert.equal(validStudy(other,true),false);
});

test('disabling legacy sweeps keeps saved scores and last-practice resume readable without altering their pitches',()=>{
  const {readLastPractice}=loadModule('src/practice/resume.ts');
  const exercise=source(),notes=exercise.measures[0].events;
  notes[1]={...note(67,1),technique:'pipa-brush',chord:[52,67].map(pitch)};
  notes[3]={...note(60,3),technique:'pipa-arpeggio',chord:[52,55,60].map(pitch)};
  const study={id:'old-sweeps',created:1,bpm:100,exercise,settings:{instrument:'Pipa',clef:'mixedStaff',difficulty:'Intermediate',rhythmLevel:'Simple',rangeMinMidi:45,rangeMaxMidi:86,keySignature:'C',tonic:'C',scaleId:'major',timeSignature:'4/4',measureCount:4,allowAccidentals:false,mixedMeters:false,meters:['4/4'],performanceMarks:true}};
  assert.ok(validStudy(study,true));
  const raw=JSON.stringify({version:1,scores:[study],presets:[]});
  assert.deepEqual(plain(readLibrary(raw).scores),plain([study]));
  const resumed=readLastPractice(JSON.stringify({version:1,study,position:1}));
  assert.deepEqual(plain(resumed.study),plain(study));
});
