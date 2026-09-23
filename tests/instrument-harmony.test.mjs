import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

const {SHENG_FINGER_ROWS,canPlayShengChord,shengButton}=loadModule('src/music/shengFingering.ts');
const {addInstrumentHarmony}=loadModule('src/music/instrumentHarmony.ts',412);
const {generatePracticeExercise}=loadModule('src/music.ts',184);
const {generateGrandExercise}=loadModule('src/music/grandStaff.ts',184);
const {SCALES,describeTonality,pitchClass}=loadModule('src/music/scales.ts');
const {pipaDoubleStopFingering,isPipaHarmony}=loadModule('src/music/pipaFingering.ts');
const {notePitches,hasPolyphony,midiFromKey,forMonophonicAssessment}=loadModule('src/music/notePitches.ts');
const {createPlaybackEvents,createMetronomeEvents}=loadModule('src/audio/PlaybackController.ts');
const {assess}=loadModule('src/assessment/scoring.ts');
const {readLibrary,emptyLibrary,addStudy,validStudy}=loadModule('src/practice/library.ts');
const opts={instrument:'Piano',clef:'treble',difficulty:'advanced',keySignature:'C',timeSignature:'4/4',rhythmLevel:'complex',measures:8,tempo:100,range:{min:55,max:90},allowAccidentals:true,mixedMeters:true,meters:['4/4','6/8','7/8'],tonic:'C',scaleId:'major'};
const plain=x=>JSON.parse(JSON.stringify(x));
const pitches=keys=>keys.map(key=>({key,octave:Number(key.split('/')[1]),midi:midiFromKey(key)}));
const notes=ex=>[...ex.measures,...(ex.lowerMeasures??[])].flatMap(bar=>bar.events);
const withoutChords=ex=>JSON.parse(JSON.stringify(ex,(key,value)=>key==='chord'?undefined:value));

test('36-key sheng chart is complete; adjacency is physical button adjacency, not pitch distance',()=>{
  assert.deepEqual([...Object.values(SHENG_FINGER_ROWS).flat()].sort((a,b)=>a-b),Array.from({length:36},(_,i)=>55+i));
  assert.equal(shengButton(56).finger,'rightThumb');
  assert.equal(canPlayShengChord([56,67]),false,'G#3 and G4 skip D4 on the same thumb');
  assert.equal(canPlayShengChord([56,62]),true,'G#3 and D4 are adjacent');
  assert.equal(canPlayShengChord([62,67]),true);
  assert.equal(canPlayShengChord([56,62,67]),false,'rare three-button fingerings are excluded');
  assert.equal(canPlayShengChord([60,64,67,72]),true);
  for(const invalid of [[54],[91],[60,60],[60,64,67,72,76]])assert.equal(canPlayShengChord(invalid),false);
  // Check every combination of 2–4 of the 36 physical buttons against a separate exhaustive oracle.
  const buttons=Object.entries(SHENG_FINGER_ROWS).flatMap(([finger,keys])=>keys.map((midi,index)=>({finger,midi,index})));
  const visit=(chord,start)=>{
    if(chord.length>=2){
      const valid=chord.every(button=>{
        const same=chord.filter(other=>other.finger===button.finger);
        return same.length===1||(same.length===2&&Math.abs(same[0].index-same[1].index)===1);
      });
      assert.equal(canPlayShengChord(chord.map(b=>b.midi)),valid);
    }
    if(chord.length===4)return;
    for(let i=start;i<buttons.length;i++)visit([...chord,buttons[i]],i+1);
  };
  visit([],0);
});

test('pipa double stops have real spellings and two reachable distinct strings',()=>{
  for(const pair of [['c/4','e/4'],['c/4','f/4'],['c/4','g/4'],['c/4','a/4']]){
    const chord=pitches(pair), fingering=pipaDoubleStopFingering(chord);
    assert.equal(isPipaHarmony(chord),true);
    assert.ok(fingering,pair.join(' '));
    assert.equal(Math.abs(fingering[0].string-fingering[1].string),1);
  }
  assert.equal(isPipaHarmony(pitches(['c/4','d#/4'])),false,'an augmented second is not a written third');
  assert.equal(pipaDoubleStopFingering(pitches(['a/2','c/3'])),null,'both pitches are below the second open string');
});

test('generated harmony stays sparse, within the selected range/scale, and physically playable in every scale',()=>{
  const sizes=new Set(), totals={Piano:0,Pipa:0,Sheng:0};
  for(const instrument of Object.keys(totals))for(const difficulty of ['beginner','intermediate','advanced'])for(const scale of SCALES){
    const range=instrument==='Piano'?{min:36,max:84}:instrument==='Pipa'?{min:45,max:88}:{min:55,max:90};
    const options={...opts,range,difficulty,scaleId:scale.id};
    const source=instrument==='Piano'?generateGrandExercise(options):generatePracticeExercise(options);
    source.soundProfile=instrument;
    const before=plain(source), ex=addInstrumentHarmony(source,range);
    assert.deepEqual(plain(source),before,'pure decoration');
    assert.deepEqual(withoutChords(ex),before,'original pitches, rests, and rhythmic timing preserved');
    const sounded=notes(ex).filter(n=>!n.rest), chords=sounded.filter(n=>n.chord);
    assert.ok(chords.length<=Math.max(1,Math.floor(sounded.length*(instrument==='Piano'?.32:.20))));
    totals[instrument]+=chords.length;
    if(instrument==='Piano')assert.equal(ex.measures.flatMap(m=>m.events).some(n=>n.chord),false);
    for(const note of chords){
      const chord=note.chord;
      assert.ok(chord.length>=2&&chord.length<=(instrument==='Pipa'?2:instrument==='Piano'?3:4));
      assert.ok(chord.some(p=>p.key===note.key));
      for(const pitch of chord){
        assert.ok(pitch.midi>=range.min&&pitch.midi<=range.max);
        assert.equal(midiFromKey(pitch.key),pitch.midi);
        assert.ok(describeTonality('C',scale.id).notes.some(n=>pitchClass(n)===pitch.midi%12));
      }
      if(instrument==='Pipa')assert.ok(pipaDoubleStopFingering(chord));
      if(instrument==='Sheng'){assert.ok(canPlayShengChord(chord.map(p=>p.midi)));sizes.add(chord.length);}
    }
  }
  assert.deepEqual([...sizes].sort(),[2,3,4]);
  for(const total of Object.values(totals))assert.ok(total>100,JSON.stringify(totals));
});

test('narrow custom ranges and other instruments never get impossible/unspecified chords',()=>{
  for(const profile of ['Sheng','Pipa','Violin','Tenor Sheng','Bass Sheng','Yangqin']){
    const source=generatePracticeExercise({...opts,range:{min:60,max:62},scaleId:'major',allowAccidentals:false});
    source.soundProfile=profile;
    const ex=addInstrumentHarmony(source,{min:60,max:62});
    assert.equal(notes(ex).some(n=>n.chord),false);
  }
});

function chordStudy(){
  const chord=pitches(['c/4','e/4','g/4']);
  const events=[0,4,8,12].map(startUnits=>({...chord[0],duration:'q',dots:0,rest:false,startUnits,durationUnits:4,...(startUnits===0?{chord,articulation:'tenuto',dynamic:'mf'}:{})}));
  return {instrument:'Sheng',soundProfile:'Sheng',clef:'treble',difficulty:'intermediate',keySignature:'C',timeSignature:'4/4',rhythmLevel:'simple',tempo:60,measures:[{timeSignature:'4/4',events,totalUnits:16,groups:[4,4,4,4],beamGroups:[4,4,4,4]}]};
}

test('each chord pitch sounds together with one shared duration; transposition, meter, and grading remain honest',()=>{
  const ex=chordStudy(), {events,duration}=createPlaybackEvents(ex,60);
  assert.equal(duration,4);assert.equal(events.length,6);
  assert.deepEqual(plain(events.slice(0,3).map(e=>[e.note,e.time,e.duration])),[['c4',0,1],['e4',0,1],['g4',0,1]]);
  assert.ok(events.slice(0,3).every(e=>Math.abs(e.velocity-.73/Math.sqrt(3))<1e-8));
  assert.deepEqual(plain(createPlaybackEvents({...ex,transposition:-2},60).events.slice(0,3).map(e=>e.note)),['A#3','D4','F4']);
  assert.equal(createMetronomeEvents(ex,60).length,4);
  assert.equal(hasPolyphony(ex),true);assert.throws(()=>assess(ex,60,[]),/Polyphonic/);
  assert.equal(notePitches({...ex.measures[0].events[0],rest:true}).length,0);
});

test('saved chords survive reopening and corrupt/unplayable sheng chords are rejected',()=>{
  const settings={instrument:'Sheng',clef:'treble',difficulty:'Intermediate',keySignature:'C',tonic:'C',scaleId:'major',timeSignature:'4/4',rhythmLevel:'Simple',measureCount:1,rangeMinMidi:55,rangeMaxMidi:90,allowAccidentals:false,mixedMeters:false,meters:['4/4']};
  const study={id:'harmony',created:1,bpm:60,settings,exercise:chordStudy()};
  const saved=addStudy(emptyLibrary(),study,'scores');
  assert.deepEqual(plain(readLibrary(JSON.stringify(saved))),plain(saved));
  for(const corrupt of [[{key:'c/4',midi:70,octave:4}],pitches(['g#/3','g/4']),pitches(['c/4','c/4'])]){
    const bad=plain(study),note=bad.exercise.measures[0].events[0];
    Object.assign(note,corrupt[0],{chord:corrupt});
    assert.equal(validStudy(bad,true),false);
  }
});

test('microphone mode displays and assesses the original melody without destroying practice harmony',()=>{
  const ex=chordStudy(), before=plain(ex), melody=forMonophonicAssessment(ex);
  assert.deepEqual(plain(ex),before);
  assert.equal(hasPolyphony(melody),false);
  assert.equal(createPlaybackEvents(melody,60).events.length,4);
  assert.doesNotThrow(()=>assess(melody,60,[]));
  assert.deepEqual(plain(melody),withoutChords(ex));
  assert.equal(forMonophonicAssessment(melody),melody);
  const twoHand={...ex,grandMode:'two-hand',lowerMeasures:ex.measures};
  assert.equal(forMonophonicAssessment(twoHand),twoHand,'do not pretend independent piano hands are one melody');
});
