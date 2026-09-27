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
  assert.deepEqual([...kinds].sort(),['pipa-arpeggio','pipa-brush','pipa-open-double','pipa-roll']);
  const nonPipa={...source(),soundProfile:'Violin'};assert.equal(addPipaTechniques(nonPipa,{min:45,max:86}),nonPipa);
});

test('technique playback keeps score duration and assessment onsets while rolling or spreading audible attacks',()=>{
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
  const roll=audible.events.filter(e=>e.time>=3);assert.ok(roll[0].time<roll[1].time&&roll[1].time<roll[2].time);
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
