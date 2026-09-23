import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

const {addModalPhrasing,modalProfile} = loadModule('src/music/modalPhrasing.ts');
const {planMelodicContours}=loadModule('src/music/melodicContours.ts');
const {generatePracticeExercise,TIME_SIGNATURES} = loadModule('src/music.ts',926);
const {generateGrandExercise} = loadModule('src/music/grandStaff.ts',763);
const {SCALES,buildPitchMaterial,pitchClass} = loadModule('src/music/scales.ts');
const {midiFromKey,notePitches} = loadModule('src/music/notePitches.ts');
const {addInstrumentHarmony} = loadModule('src/music/instrumentHarmony.ts',167);
const {canPlayShengChord} = loadModule('src/music/shengFingering.ts');
const {pipaDoubleStopFingering} = loadModule('src/music/pipaFingering.ts');
const {createPlaybackEvents} = loadModule('src/audio/PlaybackController.ts');
const {practiceTempoRange} = loadModule('src/practice/tempo.ts');
const base={instrument:'Sheng',clef:'treble',difficulty:'beginner',keySignature:'C',timeSignature:'4/4',
  rhythmLevel:'complex',measures:8,tempo:80,range:{min:48,max:84},allowAccidentals:false,
  mixedMeters:true,meters:['4/4','6/8','7/8'],tonic:'C',scaleId:'major'};
const plain=value=>JSON.parse(JSON.stringify(value));
const sounding=measures=>measures.flatMap(bar=>bar.events).filter(note=>!note.rest);
const skeleton=measures=>plain(measures.map(bar=>({...bar,events:bar.events.map(({key:_key,midi:_midi,octave:_octave,chord:_chord,...timing})=>timing)})));
function frozen(value) {if(value&&typeof value==='object'){Object.values(value).forEach(frozen);Object.freeze(value);} return value;}
function validate(measures,tonality,range,difficulty) {
  const material=buildPitchMaterial(tonality,range), notes=sounding(measures);
  for(let n=0;n<notes.length;n++) {
    assert.ok(material.pitchClasses.includes(notes[n].midi%12));
    assert.ok(notes[n].midi>=range.min&&notes[n].midi<=range.max);
    assert.equal(midiFromKey(notes[n].key),notes[n].midi);
    if(n) assert.ok(Math.abs(notes[n].midi-notes[n-1].midi)<={beginner:7,intermediate:12,advanced:24}[difficulty]);
  }
  const root=pitchClass(tonality.tonic);
  if(material.pitches.some(p=>p.midi%12===root)) {
    assert.equal(notes[0].midi%12,root);
    assert.equal(notes.at(-1).midi%12,root);
  }
}

function plansFor(ex) {
  return planMelodicContours(ex.measures,buildPitchMaterial(ex.tonality,base.range).pitches,pitchClass(ex.tonality.tonic),ex.difficulty);
}
function assertContour(measures,plan) {
  const first=sounding([measures[plan.startBar]]).map(n=>n.midi),second=sounding([measures[plan.endBar]]).map(n=>n.midi);
  assert.notDeepEqual(first,second,'the second bar develops the whole line instead of copying the first');
  const all=sounding(measures),line=[...first,...second];
  for(const target of plan.targets) {
    const actual=all[target.index].midi;
    assert.ok(actual>=target.minMidi && actual<=target.maxMidi,'the actual score keeps the phrase register');
    if(target.fixed)assert.equal(actual,target.midi,'planned endpoints and turning points reach the score');
  }
  if(['arch','valley'].includes(plan.rule)) {
    assert.equal(second.at(-1),first[0]);
    const up=plan.rule==='arch',extreme=up?Math.max(...line):Math.min(...line),peak=line.indexOf(extreme);
    assert.ok(peak>=first.length && peak<line.length-1,'one long arc turns during the second bar');
    assert.equal(line.filter(m=>m===extreme).length,1);
    const direction=up?1:-1;
    for(let i=1;i<line.length;i++)assert.ok((line[i]-line[i-1])*direction*(i<=peak?1:-1)>=0);
  } else if(['rising','falling'].includes(plan.rule)) {
    const direction=plan.rule==='rising'?1:-1;
    assert.ok((line.at(-1)-line[0])*direction>0);
    for(let i=1;i<line.length;i++)assert.ok((line[i]-line[i-1])*direction>=0);
  } else {
    assert.ok(Math.max(...second)>Math.max(...first),'the wave/chord line reaches new register in bar two');
    assert.equal(second.at(-1),first[0]);
  }
}

test('every tonal scale retains its own notes, written octaves, rhythm and graded leaps with tonic endpoints',()=>{
  for(const scale of SCALES.filter(s=>s.id!=='atonal')) for(const tonic of ['C','F#','Cb']) for(const difficulty of ['beginner','intermediate','advanced']) {
    const options={...base,scaleId:scale.id,tonic,difficulty,measures:4};
    const raw=frozen(generatePracticeExercise(options)), before=JSON.stringify(raw);
    const shaped=addModalPhrasing(raw,base.range,false);
    validate(shaped.measures,shaped.tonality,base.range,difficulty);
    assert.deepEqual(skeleton(shaped.measures),skeleton(raw.measures));
    assert.deepEqual(plain(practiceTempoRange(shaped)),plain(practiceTempoRange(raw)));
    assert.equal(JSON.stringify(raw),before);
    const profile=modalProfile(shaped.tonality), intervals=buildPitchMaterial(shaped.tonality,base.range).pitchClasses.map(pc=>(pc-profile.root+12)%12);
    assert.ok([...profile.anchors,...profile.colors,...profile.approaches].every(n=>intervals.includes(n)));
  }
});

test('minor and church-mode endings use legal modal steps compatible with their final contour',()=>{
  for(const [scaleId,approaches] of [['major',[2]],['natural-minor',[2]],['harmonic-minor',[11,2]],['melodic-minor',[11,2]],
    ['dorian',[2]],['phrygian',[1]],['lydian',[11,2]],['mixolydian',[10,2]],['locrian',[1]],['pelog-pentatonic',[1]],['whole-tone',[2]]]) {
    const ex=addModalPhrasing(generatePracticeExercise({...base,scaleId}),base.range,false);
    const notes=sounding(ex.measures);
    assert.ok(approaches.includes(notes.at(-2).midi%12),`${scaleId}: ${notes.at(-2).midi%12}`);
    assert.equal(notes.at(-1).midi%12,0,scaleId);
    assert.ok(Math.abs(notes.at(-1).midi-notes.at(-2).midi)<=3,scaleId);
  }
});

test('continuous two-bar contours develop at varied locations without copying rhythms',()=>{
  for(const meter of Object.keys(TIME_SIGNATURES)) for(const rhythmLevel of ['simple','medium','complex']) {
    const raw=frozen(generatePracticeExercise({...base,timeSignature:meter,measures:16,rhythmLevel,mixedMeters:false}));
    const shaped=addModalPhrasing(raw,base.range,false);
    validate(shaped.measures,shaped.tonality,base.range,'beginner');
    const plans=plansFor(raw);
    assert.equal(plans.length,2);
    for(const plan of plans)assertContour(shaped.measures,plan);
    assert.deepEqual(skeleton(shaped.measures),skeleton(raw.measures));
    const timing=ex=>plain(createPlaybackEvents(ex,80).events.map(({time,duration})=>({time,duration})));
    assert.deepEqual(timing(shaped),timing(raw));
    assert.deepEqual(plain(practiceTempoRange(shaped)),plain(practiceTempoRange(raw)));
  }
});

test('even identical input bars form one longer contour instead of two repeated phrases',()=>{
  const raw=generatePracticeExercise({...base,mixedMeters:false});
  const template={...raw.measures[0],events:[60,62,64,65].map((midi,i)=>({key:['c/4','d/4','e/4','f/4'][i],midi,octave:4,rest:false,duration:'q',dots:0,startUnits:i*4,durationUnits:4}))};
  raw.measures=Array.from({length:8},()=>plain(template));
  const shaped=addModalPhrasing(raw,base.range,false);
  for(const plan of plansFor(raw))assertContour(shaped.measures,plan);
  assert.deepEqual(skeleton(shaped.measures),skeleton(raw.measures));
});

test('two- and four-bar studies also get a continuous line that moves through the barline',()=>{
  for(const measures of [2,4,8]) for(const seed of [211,419,671,932]) {
    const engine=loadModule('src/music.ts',seed);
    const raw=engine.generatePracticeExercise({...base,measures,mixedMeters:false});
    const shaped=addModalPhrasing(raw,base.range,false);
    const plans=plansFor(raw);assert.equal(plans.length,1);
    for(const plan of plans)assertContour(shaped.measures,plan);
    assert.deepEqual(skeleton(shaped.measures),skeleton(raw.measures));
  }
});

test('two-bar lines keep mixed-meter groups and the independent lower-hand rhythm intact',()=>{
  for(const scaleId of ['major','dorian','pelog-pentatonic','diminished-hw']) for(const mode of ['mono','two-hand']) {
    const raw=generateGrandExercise({...base,scaleId,measures:8},mode);
    const shaped=addModalPhrasing(raw,base.range,false);
    assert.deepEqual(shaped.measures.map(m=>m.timeSignature),raw.measures.map(m=>m.timeSignature));
    if(mode==='two-hand')assert.deepEqual(skeleton(shaped.lowerMeasures),skeleton(raw.lowerMeasures));
    for(let b=0;b<8;b++)for(const measures of [shaped.measures,shaped.lowerMeasures]) {
      let ticks=0;
      for(const note of measures[b].events){assert.equal(note.startUnits,ticks/12);ticks+=Math.round(note.durationUnits*12);}
      assert.equal(ticks,measures[b].totalUnits*12);
    }
    const events=createPlaybackEvents(shaped,80).events;
    assert.ok(events.every(e=>Number.isFinite(e.time)&&e.duration>0));
    if(mode==='mono')assert.equal(new Set(events.map(e=>e.time)).size,events.length);
  }
});

test('two-bar contours stay modal and within graded leaps in every tonal scale',()=>{
  for(const scale of SCALES.filter(s=>s.id!=='atonal'))for(const difficulty of ['beginner','intermediate','advanced']) {
    const raw=generatePracticeExercise({...base,scaleId:scale.id,tonic:'Bb',difficulty});
    const shaped=addModalPhrasing(raw,base.range,false);
    validate(shaped.measures,shaped.tonality,base.range,difficulty);
    const plans=plansFor(raw);assert.equal(plans.length,1);
    for(const plan of plans)assertContour(shaped.measures,plan);
    assert.deepEqual(skeleton(shaped.measures),skeleton(raw.measures));
  }
});

test('atonal, extra-chromatic and already-harmonized scores bypass modal shaping unchanged',()=>{
  for(const scaleId of ['atonal','major','dorian']) {
    const ex=generatePracticeExercise({...base,scaleId,allowAccidentals:true});
    assert.equal(addModalPhrasing(ex,base.range,true),ex);
    if(scaleId==='atonal') assert.equal(addModalPhrasing(ex,base.range,false),ex);
  }
  const ex=generatePracticeExercise(base);ex.soundProfile='Sheng';
  const harmony=addInstrumentHarmony(ex,base.range);
  assert.ok(sounding(harmony.measures).some(n=>n.chord));
  assert.equal(addModalPhrasing(harmony,base.range,false),harmony);
});

test('narrow ranges without the tonic stay in range and never manufacture a cadence note',()=>{
  for(const range of [{min:61,max:62},{min:63,max:65},{min:70,max:71}]) {
    const ex=addModalPhrasing(generatePracticeExercise({...base,range,scaleId:'major'}),range,false);
    validate(ex.measures,ex.tonality,range,'beginner');
  }
});

test('both grand-staff modes preserve sounding timing and instrument harmony remains playable',()=>{
  for(const meter of Object.keys(TIME_SIGNATURES)) for(const mode of ['mono','two-hand']) {
    const raw=generateGrandExercise({...base,timeSignature:meter,mixedMeters:false,measures:4},mode);
    raw.soundProfile=mode==='two-hand'?'Piano':'Sheng';
    const shaped=addModalPhrasing(raw,base.range,false);
    if(mode==='two-hand') {
      assert.deepEqual(skeleton(shaped.measures),skeleton(raw.measures));
      assert.deepEqual(skeleton(shaped.lowerMeasures),skeleton(raw.lowerMeasures));
      validate(shaped.measures,shaped.tonality,{min:60,max:84},'beginner');
      validate(shaped.lowerMeasures,shaped.tonality,{min:48,max:59},'beginner');
    } else {
      const combined=shaped.measures.map((bar,i)=>({...bar,events:bar.events.map((note,j)=>note.rest?shaped.lowerMeasures[i].events[j]:note)}));
      validate(combined,shaped.tonality,base.range,'beginner');
      for(let b=0;b<combined.length;b++) for(let n=0;n<combined[b].events.length;n++) {
        assert.ok(shaped.measures[b].events[n].rest||shaped.lowerMeasures[b].events[n].rest);
      }
    }
    const timing=ex=>{
      const {events,duration}=createPlaybackEvents(ex,80);
      return plain({duration,events:events.map(({time,duration})=>({time,duration}))});
    };
    assert.deepEqual(timing(shaped),timing(raw));
    const harmony=addInstrumentHarmony(shaped,base.range);
    for(const note of [...harmony.measures,...harmony.lowerMeasures??[]].flatMap(bar=>bar.events)) {
      for(const pitch of notePitches(note)) assert.equal(midiFromKey(pitch.key),pitch.midi);
      if(note.chord&&harmony.soundProfile==='Sheng') assert.ok(canPlayShengChord(note.chord.map(p=>p.midi)));
    }
  }
  const pipa=generatePracticeExercise({...base,range:{min:45,max:88}});pipa.soundProfile='Pipa';
  const shaped=addInstrumentHarmony(addModalPhrasing(pipa,{min:45,max:88},false),{min:45,max:88});
  for(const note of sounding(shaped.measures))if(note.chord)assert.ok(pipaDoubleStopFingering(note.chord));
});
