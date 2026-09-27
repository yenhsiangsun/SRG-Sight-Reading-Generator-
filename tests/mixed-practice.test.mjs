import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

const plain=value=>JSON.parse(JSON.stringify(value));
const focus=loadModule('src/practice/focus.ts');
const library=loadModule('src/practice/library.ts');
const {trainingContext}=loadModule('src/practice/training.ts');
const {composeExercise}=loadModule('src/music/composeExercise.ts',9142);
const {TIME_SIGNATURES}=loadModule('src/music.ts');
const {assertMeasureRhythm}=loadModule('src/music/rhythmTiming.ts');
const {validateGeneratedExercise}=loadModule('src/music/exerciseQuality.ts');
const settings={instrument:'Flute',clef:'treble',difficulty:'Beginner',keySignature:'C',tonic:'C',scaleId:'major',timeSignature:'4/4',rhythmLevel:'Simple',measureCount:8,rangeMinMidi:60,rangeMaxMidi:84,allowAccidentals:false,mixedMeters:false,meters:['4/4','6/8']};
const options={instrument:'Flute',instrumentProfile:'Flute',clef:'treble',difficulty:'beginner',keySignature:'C',tonic:'C',scaleId:'major',timeSignature:'4/4',rhythmLevel:'simple',measures:8,tempo:80,range:{min:60,max:84},allowAccidentals:false,mixedMeters:false,meters:['4/4','6/8']};
const notes=exercise=>exercise.measures.flatMap(bar=>bar.events).filter(note=>!note.rest);

test('practice selection toggles multiple skills and balanced clears all targeted choices',()=>{
  let selected=focus.togglePracticeFocus(['balanced'],'sixteenths');
  selected=focus.togglePracticeFocus(selected,'dotted');
  assert.deepEqual(plain(selected),['sixteenths','dotted']);
  assert.deepEqual(plain(focus.togglePracticeFocus(selected,'sixteenths')),['dotted']);
  assert.deepEqual(plain(focus.togglePracticeFocus(['dotted'],'dotted')),['balanced']);
  assert.deepEqual(plain(focus.togglePracticeFocus(selected,'balanced')),['balanced']);
  const mix=focus.focusSettings(['dotted','leaps','sixteenths','mixed','triplets'],4);
  assert.deepEqual(plain(mix.rhythmFocus),['sixteenths','dotted','triplets']);
  assert.equal(mix.pitchFocus,'leaps');assert.equal(mix.rhythmLevel,undefined);
  assert.equal(mix.mixedMeters,true);assert.equal(mix.timeSignature,'4/4');
  assert.deepEqual(plain(focus.selectedPracticeFocus({...settings,...mix})),['sixteenths','dotted','triplets','leaps','mixed']);
  for(const rhythmLevel of ['Simple','Moderate','Complex']) {
    assert.equal({...settings,rhythmLevel,...focus.focusSettings('leaps')}.rhythmLevel,rhythmLevel);
  }
  assert.deepEqual(plain(focus.selectedPracticeFocus({...settings,...focus.focusSettings('balanced')})),['balanced']);
});

test('sixteenth plus dotted practice actually includes both sounded rhythms across every meter and rhythm tier',()=>{
  for(const meter of Object.keys(TIME_SIGNATURES))for(const rhythmLevel of ['simple','medium','complex'])for(const measures of [4,8]){
    const exercise=composeExercise({...options,timeSignature:meter,rhythmLevel,measures,rhythmFocus:['sixteenths','dotted']});
    for(const bar of exercise.measures)assertMeasureRhythm(bar,meter);
    validateGeneratedExercise(exercise,options.range,false);
    const sounding=notes(exercise);
    assert.ok(sounding.some(note=>note.duration==='16'&&!note.tuplet),`${meter} ${rhythmLevel}: sixteenths`);
    assert.ok(sounding.some(note=>note.duration==='8'&&note.dots===1),`${meter} ${rhythmLevel}: dotted eighths`);
    assert.equal(exercise.measures.at(-1).events.at(-1).rest,false);
  }
});

test('all skill combinations keep complete mixed-meter bars and put triplets only in quarter meters',()=>{
  const skills=['sixteenths','dotted','triplets','offbeats'];
  for(let mask=1;mask<16;mask++){
    const selected=skills.filter((_,i)=>mask&(1<<i));if(selected.length<2)continue;
    const exercise=composeExercise({...options,mixedMeters:true,rhythmFocus:selected});
    for(const bar of exercise.measures){
      assertMeasureRhythm(bar,bar.timeSignature);
      if(bar.timeSignature.endsWith('/8'))assert.ok(bar.events.every(note=>!note.tuplet));
    }
    const sounding=notes(exercise);
    if(selected.includes('triplets'))assert.ok(sounding.some(note=>note.tuplet===3));
    if(selected.includes('dotted'))assert.ok(sounding.some(note=>note.duration==='8'&&note.dots===1));
    if(selected.includes('sixteenths'))assert.ok(sounding.some(note=>note.duration==='16'));
    if(selected.includes('offbeats'))assert.ok(sounding.some(note=>note.startUnits%2===1&&note.durationUnits===2));
  }
});

test('mixed rhythm choices are independent of pitch difficulty and selection order',()=>{
  const rhythm=exercise=>plain(exercise.measures.map(bar=>bar.events.map(note=>[note.startUnits,note.durationUnits,note.rest,note.tuplet])));
  const generate=(difficulty,rhythmFocus)=>loadModule('src/music/composeExercise.ts',473).composeExercise({...options,difficulty,rhythmFocus});
  const expected=rhythm(generate('beginner',['sixteenths','dotted']));
  assert.deepEqual(rhythm(generate('advanced',['dotted','sixteenths'])),expected);
  assert.deepEqual(rhythm(generate('intermediate',['sixteenths','dotted'])),expected);
  assert.equal(trainingContext({...settings,rhythmFocus:['dotted','sixteenths']}),trainingContext({...settings,rhythmFocus:['sixteenths','dotted']}));
  assert.equal(trainingContext({...settings,rhythmFocus:'dotted'}),trainingContext({...settings,rhythmFocus:['dotted']}));
});

test('saved studies and presets preserve mixed selections while accepting legacy scalar focuses',()=>{
  const exercise={...composeExercise({...options,rhythmFocus:['sixteenths','dotted']}),soundProfile:'Flute'};
  for(const rhythmFocus of [undefined,'balanced','dotted',['sixteenths','dotted'],['sixteenths','dotted','triplets','offbeats']])for(const kind of ['scores','presets']){
    const entry={id:'mix',created:1,bpm:80,settings:{...settings,rhythmFocus},...(kind==='scores'?{exercise}:{})};
    const saved=library.addStudy(library.emptyLibrary(),entry,kind);
    assert.deepEqual(plain(library.readLibrary(JSON.stringify(saved))),plain(saved));
  }
  for(const rhythmFocus of [[],['dotted','dotted'],['balanced','dotted'],['unknown'],null,{},['sixteenths',1]]){
    assert.equal(library.validSettings({...settings,rhythmFocus}),false,JSON.stringify(rhythmFocus));
  }
});

test('in-place range and difficulty changes generate safely and carry forward mixed practice selections',()=>{
  let state=[],cursor=0;
  const react={useState(initial){const i=cursor++;if(!(i in state))state[i]=initial;return [state[i],next=>{state[i]=typeof next==='function'?next(state[i]):next;}];}};
  const hook=loadModule('src/hooks/useExercise.ts',326,undefined,{react},{window:{matchMedia:()=>({matches:false})}});
  const render=()=>{cursor=0;return hook.useExercise();};
  assert.notEqual(render().generateFrom({...settings,rhythmFocus:['sixteenths','dotted']},80),false);
  const before=JSON.stringify(render().current);
  const draft={...render().current.settings,rangeMinMidi:65,rangeMaxMidi:77,difficulty:'Advanced',rhythmLevel:'Complex',clef:'mixedStaff'};
  assert.equal(JSON.stringify(render().current),before,'editing a draft does not replace the score');
  assert.notEqual(render().generateFrom(draft,80),false);
  let current=render().current;
  assert.equal(current.settings.difficulty,'Advanced');assert.equal(current.settings.rhythmLevel,'Complex');
  assert.equal(current.exercise.staffMode,'mixed');
  assert.ok(notes(current.exercise).every(note=>note.midi>=65&&note.midi<=77));
  assert.deepEqual(plain(current.settings.rhythmFocus),['sixteenths','dotted']);
  render().change('rhythmLevel','Moderate');
  assert.deepEqual(plain(render().settings.rhythmFocus),['sixteenths','dotted']);
  assert.notEqual(render().generateNew(80),false);
  current=render().current;
  assert.equal(current.settings.rangeMinMidi,65);assert.equal(current.settings.difficulty,'Advanced');
  assert.ok(notes(current.exercise).some(note=>note.dots===1));
  const snapshot=JSON.stringify(current),saved=JSON.stringify(render().settings);
  assert.equal(render().generateFrom({...draft,rangeMinMidi:77,rangeMaxMidi:65},80),false);
  assert.equal(JSON.stringify(render().current),snapshot);assert.equal(JSON.stringify(render().settings),saved);
});
