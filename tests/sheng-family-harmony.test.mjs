import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

const {SHENG_HARMONY_PROFILES,isShengInstrument,shengKeyboardButton,canPlayShengChord,isShengPracticeVoicing}=loadModule('src/music/shengFingering.ts');
const {INSTRUMENTS}=loadModule('src/music/instruments.ts');
const {addInstrumentHarmony}=loadModule('src/music/instrumentHarmony.ts',923);
const {generatePracticeExercise}=loadModule('src/music.ts',923);
const {generateGrandExercise}=loadModule('src/music/grandStaff.ts',923);
const {SCALES,pitchClass}=loadModule('src/music/scales.ts');
const {metricPosition}=loadModule('src/music/meterFeel.ts');
const {melodicVoice}=loadModule('src/music/exerciseQuality.ts');
const {midiFromKey,forMonophonicAssessment,hasPolyphony}=loadModule('src/music/notePitches.ts');
const {createPlaybackEvents}=loadModule('src/audio/PlaybackController.ts');
const {validStudy,readLibrary}=loadModule('src/practice/library.ts');
const plain=x=>JSON.parse(JSON.stringify(x));
const notes=ex=>[...ex.measures,...ex.lowerMeasures??[]].flatMap(bar=>bar.events);
const withoutChords=ex=>JSON.parse(JSON.stringify(ex,(key,value)=>key==='chord'?undefined:value));
const passages=ex=>{
  const result=[];let run=[];
  for(const note of melodicVoice(ex).flatMap(bar=>bar.events)) {
    if(!note.rest&&note.chord)run.push(note);
    else {if(run.length>1)result.push(run);run=[];}
  }
  if(run.length>1)result.push(run);
  return result;
};
const pitch=midi=>({midi,key:`${['c','c#','d','eb','e','f','f#','g','ab','a','bb','b'][midi%12]}/${Math.floor(midi/12)-1}`,octave:Math.floor(midi/12)-1});
const options={instrument:'Sheng',clef:'treble',difficulty:'advanced',keySignature:'C',timeSignature:'4/4',rhythmLevel:'medium',
  measures:8,tempo:100,allowAccidentals:false,mixedMeters:true,meters:['4/4','6/8','7/8'],tonic:'C',scaleId:'major'};

test('each sheng has its own range; lower sheng buttons follow absolute pitch classes, not transposed soprano fingers',()=>{
  assert.deepEqual(Object.keys(SHENG_HARMONY_PROFILES),['Sheng','Alto Sheng','Tenor Sheng','Bass Sheng']);
  for(const [name,profile] of Object.entries(SHENG_HARMONY_PROFILES)){
    assert.equal(isShengInstrument(name),true);
    assert.equal(profile.min,INSTRUMENTS[name].min);assert.equal(profile.max,INSTRUMENTS[name].max);
    for(let midi=profile.min;midi<=profile.max;midi++)assert.equal(canPlayShengChord([midi],name),true);
    for(const chord of [[],[profile.min-1],[profile.max+1],[60.5],[NaN],[60,60],[60,62,64,65,67]])
      assert.equal(canPlayShengChord(chord,name),false);
  }
  for(const name of [undefined,'Piano','Traditional Sheng','Unknown Sheng'])assert.equal(isShengInstrument(name),false);
  assert.equal(canPlayShengChord([60,64],'Unknown Sheng'),false);
  // Transcribed bottom row of figure 2, left to right on each hand.
  for(const [hand,row] of [['left',[36,38,40,42,44,46]],['right',[47,45,43,41,39,37]]])
    for(const [column,midi] of row.entries())for(const delta of [0,12,24]){
      if(midi+delta>67)continue;
      assert.deepEqual(plain(shengKeyboardButton(midi+delta,'Bass Sheng')),{hand,row:3+delta/12,column});
    }
  for(const name of ['Alto Sheng','Tenor Sheng','Bass Sheng'])
    assert.deepEqual(plain(shengKeyboardButton(60,name)),{hand:'left',row:5,column:0});
  assert.equal(shengKeyboardButton(48,'Sheng'),undefined);
  assert.equal(canPlayShengChord([56,67],'Sheng'),false,'original same-thumb nonadjacent prohibition');
  assert.equal(canPlayShengChord([56,67],'Alto Sheng'),true,'these notes belong to separate hands here');
  assert.equal(canPlayShengChord([60,64,67,72],'Sheng'),true);
  assert.equal(canPlayShengChord([60,64,67,72],'Alto Sheng'),false,'three left-hand keys exceed conservative practice policy');
});

test('lower shengs reject wide hand reaches and dense low voicings while allowing compact independent keys',()=>{
  for(const name of ['Alto Sheng','Tenor Sheng','Bass Sheng']){
    for(const chord of [[48,52,55],[55,60,64,67],[48,60]])assert.equal(canPlayShengChord(chord,name),true,`${name}: ${chord}`);
    for(const chord of [[48,54],[48,52,56]])assert.equal(canPlayShengChord(chord,name),false,`${name}: ${chord}`);
  }
  assert.equal(canPlayShengChord([48,72],'Alto Sheng'),false,'nonadjacent octave rows');
  assert.equal(canPlayShengChord([36,40],'Bass Sheng'),true,'reachable does not mean desirable low harmony');
  assert.equal(isShengPracticeVoicing([36,40],'Bass Sheng'),false);
  assert.equal(isShengPracticeVoicing([36,43],'Bass Sheng'),true);
  assert.equal(isShengPracticeVoicing([36,43,48],'Bass Sheng'),false,'low register breath/texture limit');
  assert.equal(isShengPracticeVoicing([48,52,55],'Bass Sheng'),true);
});

test('all four shengs generate sparse model-checked chords in every mode and grade without changing the melody or rhythm',()=>{
  const totals={};
  for(const [instrument,{min,max}] of Object.entries(SHENG_HARMONY_PROFILES)){
    totals[instrument]=0;
    for(const difficulty of ['beginner','intermediate','advanced'])for(const {id:scaleId} of SCALES)for(const grand of [false,true]){
      const range={min,max}, opts={...options,range,difficulty,scaleId};
      const source=grand?generateGrandExercise(opts,'mono'):generatePracticeExercise(opts);
      source.soundProfile=instrument;source.staffMode=grand?'fixed':'mixed';
      const before=plain(source),ex=addInstrumentHarmony(source,range),sounded=notes(ex).filter(n=>!n.rest);
      assert.deepEqual(plain(source),before);assert.deepEqual(withoutChords(ex),before);
      const chords=sounded.filter(n=>n.chord);
      totals[instrument]+=chords.length;
      const maxSize=difficulty==='beginner'?2:difficulty==='intermediate'?3:4;
      const rate={beginner:.1,intermediate:.16,advanced:.3}[difficulty];
      assert.ok(chords.length<=Math.max(1,Math.floor(sounded.length*rate)));
      const line=melodicVoice(ex).flatMap(bar=>bar.events),runs=passages(ex);
      if(difficulty==='advanced') {
        assert.ok(runs.length<=1);
        for(const run of runs) {
          assert.ok(run.length<=3);
          assert.ok(run.every(note=>note.chord.length<=3));
        }
      }
      for(let index=0;index<ex.measures.length;index++){
        const bars=[ex.measures[index],...(ex.lowerMeasures?[ex.lowerMeasures[index]]:[])];
        assert.ok(bars.flatMap(b=>b.events).filter(n=>n.chord).length<=(difficulty==='advanced'?3:1));
        for(const bar of bars)for(const n of bar.events)if(n.chord){
          assert.ok(n.chord.length>=2&&n.chord.length<=maxSize);
          const continued=difficulty==='advanced'&&line[line.indexOf(n)-1]?.chord;
          assert.ok(continued||metricPosition(bar,n.startUnits,ex.timeSignature).onPulse);
          assert.ok(n.durationUnits>=(instrument==='Bass Sheng'||n.chord.length===4?4:2));
          assert.ok(n.chord.some(p=>p.midi===n.midi));
          assert.equal(isShengPracticeVoicing(n.chord.map(p=>p.midi),instrument),true);
          assert.ok(Math.max(...n.chord.map(p=>p.midi))-Math.min(...n.chord.map(p=>p.midi))<=12);
          for(const p of n.chord){
            assert.ok(p.midi>=min&&p.midi<=max);assert.equal(midiFromKey(p.key),p.midi);
            assert.ok(ex.tonality.notes.some(note=>pitchClass(note)===p.midi%12));
          }
        }
      }
    }
    assert.ok(totals[instrument]>100,`${instrument}: ${totals[instrument]}`);
  }
});

test('advanced sheng studies occasionally contain short voiced passages, including mixed meters and monophonic grand staves',()=>{
  const {composeExercise}=loadModule('src/music/composeExercise.ts',923);
  const {addInstrumentHarmony}=loadModule('src/music/instrumentHarmony.ts',177);
  for(const [instrument,{min,max}] of Object.entries(SHENG_HARMONY_PROFILES)) {
    const range={min,max};let shortStudies=0,longWithTwo=0;const lengths=new Set();
    for(let sample=0;sample<60;sample++) {
      const measures=sample<40?8:16;
      const source=composeExercise({...options,instrumentProfile:instrument,range,measures,rhythmLevel:sample%3?'simple':'medium'},sample%2?'mono':undefined);
      source.soundProfile=instrument;source.staffMode=sample%2?'fixed':'mixed';
      const before=plain(source),exercise=addInstrumentHarmony(source,range),runs=passages(exercise);
      assert.deepEqual(plain(source),before);assert.deepEqual(withoutChords(exercise),before);
      assert.ok(runs.length<=(measures===16?2:1));
      if(measures===8&&runs.length)shortStudies++;
      if(measures===16&&runs.length===2)longWithTwo++;
      const line=melodicVoice(exercise).flatMap((bar,b)=>bar.events.map(note=>({note,bar:b})));
      const sounding=line.filter(item=>!item.note.rest),ending=new Set(sounding.slice(-3).map(item=>item.note));
      assert.ok(sounding.filter(item=>item.note.chord).length<=Math.floor(sounding.length*.3));
      for(const run of runs) {
        lengths.add(run.length);
        assert.ok(run.length>=2&&run.length<=3);
        const first=line.find(item=>item.note===run[0]);
        assert.ok(metricPosition(exercise.measures[first.bar],run[0].startUnits,exercise.timeSignature).onPulse);
        for(const note of run) {
          assert.ok(!ending.has(note),'do not replace the final preparation and neighbour with a chord passage');
          assert.ok(note.chord.length>=2&&note.chord.length<=3);
          assert.ok(note.durationUnits>=(instrument==='Bass Sheng'?4:2));
          assert.equal(isShengPracticeVoicing(note.chord.map(p=>p.midi),instrument),true);
        }
      }
    }
    assert.ok(shortStudies>=8&&shortStudies<=35,`${instrument}: passages should be occasional, ${shortStudies}/40`);
    assert.ok(longWithTwo>0,`${instrument}: a long study can have a second separated passage`);
    assert.deepEqual([...lengths].sort(),[2,3],instrument);
  }
});

test('a real rest or a short bass-sheng note prevents a chord passage',()=>{
  for(const instrument of Object.keys(SHENG_HARMONY_PROFILES)) {
    const {min,max}=SHENG_HARMONY_PROFILES[instrument],source=fixture(instrument);
    source.measures=Array.from({length:8},()=>plain(source.measures[0]));
    source.measures.forEach(bar=>bar.events.forEach((note,index)=>{
      if(index%2)Object.assign(note,{rest:true,midi:undefined});
    }));
    const decorated=addInstrumentHarmony(source,{min,max},()=>0);
    assert.equal(passages(decorated).length,0);
    assert.deepEqual(withoutChords(decorated),plain(source));
  }
  const bass=fixture('Bass Sheng',48);
  bass.measures=Array.from({length:8},()=>({...plain(bass.measures[0]),events:Array.from({length:8},(_,i)=>({
    ...pitch(48),duration:'8',durationUnits:2,startUnits:i*2,rest:false,dots:0,
  }))}));
  assert.equal(hasPolyphony(addInstrumentHarmony(bass,{min:36,max:67},()=>0)),false);
});

test('an advanced chord passage can cross a monophonic grand-staff change without treating the silent staff as a rest',()=>{
  for(const instrument of Object.keys(SHENG_HARMONY_PROFILES)) {
    const {min,max}=SHENG_HARMONY_PROFILES[instrument],source=fixture(instrument);
    const melody=Array.from({length:8},()=>({...plain(source.measures[0]),events:[60,59,60,62].map((midi,index)=>({
      ...pitch(midi),duration:'q',durationUnits:4,startUnits:index*4,rest:false,dots:0,
    }))}));
    const staff=upper=>melody.map(bar=>({...bar,events:bar.events.map(note=>(note.midi>=60)===upper?{...note}:{...note,rest:true,midi:undefined})}));
    Object.assign(source,{grandMode:'mono',measures:staff(true),lowerMeasures:staff(false)});
    const exercise=addInstrumentHarmony(source,{min,max},()=>0);
    const first=melodicVoice(exercise)[0].events.slice(0,3);
    assert.ok(first.every(note=>note.chord?.length>=2&&note.chord.length<=3),instrument);
    assert.deepEqual(first.map(note=>note.midi),[60,59,60]);
    assert.deepEqual(withoutChords(exercise),plain(source));
    assert.ok(exercise.lowerMeasures[0].events[1].chord);
  }
});

function fixture(instrument,midi=60){
  const events=[0,4,8,12].map(startUnits=>({...pitch(midi),rest:false,duration:'q',dots:0,startUnits,durationUnits:4}));
  return {instrument:'Sheng',soundProfile:instrument,clef:'treble',difficulty:'advanced',keySignature:'C',timeSignature:'4/4',rhythmLevel:'simple',tempo:60,
    measures:[{timeSignature:'4/4',totalUnits:16,groups:[4,4,4,4],beamGroups:[4,4,4,4],events}]};
}

test('lower shengs can produce four-note chords, restricted ranges stay respected, and unknown models stay monophonic',()=>{
  for(const instrument of ['Alto Sheng','Tenor Sheng','Bass Sheng']){
    const profile=SHENG_HARMONY_PROFILES[instrument], range={min:profile.min,max:profile.max};
    const ex=addInstrumentHarmony(fixture(instrument,55),range,()=>0);
    assert.ok(notes(ex).some(n=>n.chord?.length===4),instrument);
    assert.equal(hasPolyphony(addInstrumentHarmony(fixture(instrument,60),{min:60,max:62},()=>0)),false);
    assert.equal(hasPolyphony(addInstrumentHarmony(fixture(instrument,24),{min:21,max:108},()=>0)),false,'outside the model even if custom range is wider');
  }
  const unknown=fixture('Unknown Sheng');
  assert.equal(addInstrumentHarmony(unknown,{min:48,max:83}),unknown);
});

test('family chords survive saving and sound together; microphone assessment still uses the original melody',()=>{
  for(const instrument of Object.keys(SHENG_HARMONY_PROFILES)){
    const {min,max}=SHENG_HARMONY_PROFILES[instrument],range={min,max};
    const ex=addInstrumentHarmony(fixture(instrument),range,()=>.5);
    assert.equal(hasPolyphony(ex),true,instrument);
    const chord=notes(ex).find(n=>n.chord),playback=createPlaybackEvents(ex,60);
    const attacks=playback.events.filter(n=>n.time===chord.startUnits/4);
    assert.equal(attacks.length,chord.chord.length);
    assert.ok(attacks.every(n=>n.duration===1));assert.equal(playback.duration,4);
    const monophonic=forMonophonicAssessment(ex);
    assert.equal(hasPolyphony(monophonic),false);assert.equal(hasPolyphony(ex),true);
    assert.equal(createPlaybackEvents(monophonic,60).events.length,4);
    const settings={instrument,clef:'treble',difficulty:'Advanced',keySignature:'C',tonic:'C',scaleId:'major',timeSignature:'4/4',
      rhythmLevel:'Simple',measureCount:1,rangeMinMidi:min,rangeMaxMidi:max,allowAccidentals:false,mixedMeters:false,meters:['4/4']};
    const study={id:instrument,created:1,bpm:60,settings,exercise:ex};
    assert.equal(validStudy(study,true),true);
    assert.deepEqual(plain(readLibrary(JSON.stringify({version:1,scores:[study],presets:[]})).scores[0]),plain(study));
    const bad=plain(study),badNote=bad.exercise.measures[0].events[0];
    const impossible=(instrument==='Sheng'?[56,67]:[60,64,68]).map(pitch);
    Object.assign(badNote,impossible[0],{chord:impossible});
    // Widening the custom range cannot bypass the instrument's physical rules.
    bad.settings.rangeMinMidi=21;bad.settings.rangeMaxMidi=108;
    assert.equal(validStudy(bad,true),false,instrument);
  }
});
