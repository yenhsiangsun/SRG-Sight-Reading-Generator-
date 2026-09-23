import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

const engine=loadModule('src/music.ts');
const library=loadModule('src/practice/library.ts');
const {SCALES}=loadModule('src/music/scales.ts');
const {loopWindow,loopPosition}=loadModule('src/practice/loop.ts');
const {feedbackNotes,suggestedPractice,scoreEvents}=loadModule('src/practice/feedback.ts');
const {createPlaybackEvents}=loadModule('src/audio/PlaybackController.ts');
const opts={instrument:'Sheng',clef:'treble',difficulty:'beginner',keySignature:'C',timeSignature:'4/4',rhythmLevel:'simple',measures:4,tempo:72,range:{min:48,max:84},allowAccidentals:false,mixedMeters:false,meters:['3/8','7/8'],tonic:'C',scaleId:'major'};
const settings={instrument:'Sheng',clef:'treble',difficulty:'Beginner',keySignature:'C',tonic:'C',scaleId:'major',timeSignature:'4/4',rhythmLevel:'Simple',measureCount:4,rangeMinMidi:48,rangeMaxMidi:84,allowAccidentals:false,mixedMeters:false,meters:['3/8','7/8']};
const plain=x=>JSON.parse(JSON.stringify(x));

test('focused rhythms preserve bar totals, notation durations, pitch ranges and beat boundaries in every meter',()=>{
  for(const meter of Object.keys(engine.TIME_SIGNATURES))for(const focus of ['sixteenths','dotted'])for(const difficulty of ['beginner','intermediate','advanced']){
    const ex=engine.generatePracticeExercise({...opts,timeSignature:meter,rhythmFocus:focus,difficulty});
    let short=0,dotted=0;
    for(const measure of ex.measures){
      assert.equal(measure.events.reduce((sum,n)=>sum+n.durationUnits,0),measure.totalUnits);
      let cursor=0;
      for(const note of measure.events){
        assert.equal(note.startUnits,cursor);cursor+=note.durationUnits;
        assert.equal(({w:16,h:8,q:4,'8':2,'16':1}[note.duration])*(note.dots?1.5:1),note.durationUnits);
        if(!note.rest){assert.ok(note.midi>=48&&note.midi<=84);short+=note.duration==='16';dotted+=note.dots>0;}
      }
    }
    assert.ok(focus==='sixteenths'?short>0:dotted>0,`${meter} ${focus}`);
  }
});

test('balanced focus leaves the established random generator sequence unchanged',()=>{
  const a=loadModule('src/music.ts',442),b=loadModule('src/music.ts',442);
  assert.deepEqual(plain(a.generatePracticeExercise(opts)),plain(b.generatePracticeExercise({...opts,rhythmFocus:'balanced'})));
});

test('library round-trips complete scores in every scale including atonal and theoretical spellings',()=>{
  for(const scale of SCALES){
    const exercise=engine.generatePracticeExercise({...opts,scaleId:scale.id});exercise.soundProfile='Sheng';
    const entry={id:scale.id,created:1,bpm:72,settings:{...settings,scaleId:scale.id},exercise};
    assert.equal(library.validStudy(entry,true),true,scale.id);
    const saved=library.addStudy(library.emptyLibrary(),entry,'scores');
    assert.deepEqual(plain(library.readLibrary(JSON.stringify(saved))),plain(saved));
    exercise.measures[0].events[0].key='b/8';
    assert.notEqual(saved.scores[0].exercise.measures[0].events[0].key,'b/8');
  }
});

test('corrupt library entries do not hide valid scores; duplicates and capacity preserve existing saves',()=>{
  const ex=engine.generatePracticeExercise(opts);ex.soundProfile='Sheng';
  const study={id:'a',created:1,bpm:72,settings,exercise:ex};
  const valid=library.addStudy(library.emptyLibrary(),study,'scores');
  assert.equal(library.addStudy(valid,{...study,id:'b'},'scores'),valid);
  const corrupt=plain(study);corrupt.exercise.measures[0].events[0].durationUnits=999;
  assert.equal(library.readLibrary(JSON.stringify({...valid,scores:[corrupt,study]})).scores.length,1);
  assert.equal(library.readLibrary('{broken').scores.length,0);
  assert.equal(library.validSettings({...settings,instrument:'__proto__'}),false);
  const full={...valid,scores:Array.from({length:50},(_,i)=>({...study,bpm:i+40}))};
  assert.throws(()=>library.addStudy(full,{...study,bpm:150},'scores'),/libraryFull/);
  const preset={id:'preset',created:1,bpm:72,settings};
  assert.equal(library.readLibrary(JSON.stringify({version:1,scores:[],presets:[preset]})).presets.length,1);
});

test('loop timing follows eighth-note BPM and mixed-meter bar boundaries',()=>{
  const ex=engine.generatePracticeExercise({...opts,timeSignature:'3/8',mixedMeters:true});
  const window=loopWindow(ex,60,2,3);
  assert.deepEqual(plain(window),{start:3,end:13,lead:4,cycle:14});
  assert.equal(loopPosition(window,0),3);
  assert.equal(loopPosition(window,3.99),3);
  assert.equal(loopPosition(window,5),4);
  assert.equal(loopPosition(window,14),3);
  assert.equal(loopPosition(window,19),4);
  assert.throws(()=>loopWindow(ex,60,0,2));assert.throws(()=>loopWindow(ex,60,3,2));
});

test('feedback indexes follow playback across grand staves and hide unreliable judgments',()=>{
  const {generateGrandExercise}=loadModule('src/music/grandStaff.ts');
  const ex=generateGrandExercise(opts,'mono');
  const events=scoreEvents(ex,72),audio=createPlaybackEvents(ex,72).events;
  assert.deepEqual(plain(events.map(e=>e.time)),plain(audio.map(e=>e.time)));
  const result={pitch:80,rhythm:60,completion:90,confidence:90,reliable:true,notes:[
    {index:0,expected:audio[0].note,heard:false,pitch:false,rhythm:false,cents:null,offsetMs:null},
    {index:1,expected:audio[1].note,heard:true,pitch:true,rhythm:false,cents:0,offsetMs:250},
  ]};
  const feedback=feedbackNotes(ex,72,result);
  assert.equal(feedback[0].kind,'unclear');assert.equal(feedback[1].kind,'rhythm');
  assert.equal(feedback[1].staff,events[1].staff);
  assert.equal(feedbackNotes(ex,72,{...result,reliable:false}).length,0);
  assert.equal(suggestedPractice(ex,72,{...result,completion:20}),null);
  assert.equal(suggestedPractice(ex,72,result).target,'rhythm');
});
