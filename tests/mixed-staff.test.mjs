import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

const {planMixedStaff,planSingleStaff,usesMixedStaff}=loadModule('src/notation/mixedStaff.ts');
const {ledgerCount}=loadModule('src/notation/octaveLines.ts');
const {generatePracticeExercise,TIME_SIGNATURES}=loadModule('src/music.ts',717);
const {addInstrumentHarmony}=loadModule('src/music/instrumentHarmony.ts',218);
const {midiFromKey,notePitches}=loadModule('src/music/notePitches.ts');
const {createPlaybackEvents}=loadModule('src/audio/PlaybackController.ts');
const {INSTRUMENTS,CLEFS}=loadModule('src/exerciseConfig.ts');
const {mixedRangeClef,rangeMidiAtY,rangeNotePosition,rangeStaffBottom}=loadModule('src/notation/rangeSelection.ts');
const {validStudy,readLibrary}=loadModule('src/practice/library.ts');
const plain=x=>JSON.parse(JSON.stringify(x));
function bar(keys,duration='q'){
  const units={q:4,'8':2,'16':1}[duration];
  return {timeSignature:'4/4',events:keys.map((key,index)=>({key,octave:+key.split('/')[1],midi:midiFromKey(key),rest:false,duration,dots:0,startUnits:index*units,durationUnits:units})),totalUnits:keys.length*units,groups:[4,4,4,4],beamGroups:[4,4,4,4]};
}
const opts={instrument:'Piano',clef:'treble',difficulty:'advanced',keySignature:'C',timeSignature:'4/4',rhythmLevel:'complex',measures:8,tempo:72,range:{min:45,max:88},allowAccidentals:true,mixedMeters:false,meters:['4/4'],tonic:'C',scaleId:'major'};

test('low/high phrases choose bass/treble on one staff, without compensating with opposite octave lines',()=>{
  const measures=[bar(['a/2','c/3','e/3','a/3']),bar(['a/4','c/5','e/5','a/5'])];
  const before=plain(measures),plan=planMixedStaff(measures);
  assert.deepEqual(plain(plan.clefs),[Array(4).fill('bass'),Array(4).fill('treble')]);
  assert.ok(plan.shifts.flat().every(s=>s===0));
  assert.deepEqual(plain(measures),before);
});

test('notes around middle C do not flicker between clefs; high and low extremes use only single-octave signs',()=>{
  const middle=[bar(['b/3','d/4','c/4','d/4']),bar(['b/3','d/4','c/4','b/3'])];
  const plan=planMixedStaff(middle), clefs=plan.clefs.flat();
  assert.equal(new Set(clefs).size,1);
  assert.ok(plan.shifts.flat().every(s=>s===0));
  const high=planMixedStaff([bar(['e/6','g/6','a/6','g/6'])]);
  assert.ok(high.clefs.flat().every(c=>c==='treble'));assert.ok(high.shifts.flat().every(s=>s===1));
  const low=planMixedStaff([bar(['c/1','d/1','e/1','d/1'])]);
  assert.ok(low.clefs.flat().every(c=>c==='bass'));assert.ok(low.shifts.flat().every(s=>s===-1));
});

test('large offbeat leaps no longer force unreadable ledger lines through a whole beat',()=>{
  const measure=bar(['a/2','c/3','e/5','g/5','a/2','c/3','g/4','c/5'],'8');
  const plan=planMixedStaff([measure]);
  assert.equal(plan.clefs[0][0],'bass');assert.equal(plan.clefs[0][2],'treble');
  // A leap inside a quarter beat must also be readable, rather than using 8vb in treble.
  const within=bar(['a/2','e/5','e/5','g/5','g/5','g/5','g/4','c/5'],'8');
  const inside=planMixedStaff([within]);
  assert.equal(inside.clefs[0][0],'bass');assert.equal(inside.clefs[0][1],'treble');
  assert.ok(inside.shifts.flat().every(s=>s===0));
});

test('mixed layout bounds ledger lines for every pipa chord in every meter without changing sound or rhythm',()=>{
  for(const meter of Object.keys(TIME_SIGNATURES))for(const scaleId of ['major','harmonic-minor','egyptian-pentatonic','atonal']){
    const source={...generatePracticeExercise({...opts,timeSignature:meter,scaleId}),soundProfile:'Pipa',staffMode:'mixed'};
    const ex=addInstrumentHarmony(source,opts.range),before=plain(ex), audio=plain(createPlaybackEvents(ex,72));
    const plan=planSingleStaff(ex,ex.measures);
    ex.measures.forEach((measure,bar)=>measure.events.forEach((note,i)=>{
      for(const pitch of notePitches(note))assert.ok(ledgerCount(pitch.key,plan.clefs[bar][i],plan.shifts[bar][i])<=2,`${pitch.key}, ${plan.clefs[bar][i]}, ${plan.shifts[bar][i]}`);
      assert.ok([-1,0,1].includes(plan.shifts[bar][i]));
    }));
    assert.deepEqual(plain(ex),before);assert.deepEqual(plain(createPlaybackEvents(ex,72)),audio);
  }
});

test('explicit fixed staves override automatic pipa behavior; legacy scores and grand staves remain supported',()=>{
  const source={...generatePracticeExercise(opts),soundProfile:'Pipa'};
  assert.equal(usesMixedStaff(source),true,'legacy pipa rendering');
  for(const clef of ['treble','bass','alto','tenor']){
    const ex={...source,clef,staffMode:'fixed'};
    assert.equal(usesMixedStaff(ex),false);
    assert.ok(planSingleStaff(ex,ex.measures).clefs.flat().every(c=>c===clef));
  }
  assert.equal(usesMixedStaff({...source,staffMode:'mixed',soundProfile:'Cello'}),true);
  assert.equal(usesMixedStaff({...source,staffMode:'mixed',lowerMeasures:source.measures}),false);
});

test('selecting pipa defaults to mixed staff, generates one staff with harmony, and saves/restores the choice',()=>{
  assert.ok(CLEFS.includes('mixedStaff'));assert.equal(INSTRUMENTS.Pipa.clef,'mixedStaff');
  const state=[];let cursor=0;
  const react={useState(initial){const index=cursor++;if(!(index in state))state[index]=initial;return [state[index],next=>{state[index]=typeof next==='function'?next(state[index]):next;}];}};
  const hook=loadModule('src/hooks/useExercise.ts',829,undefined,{react},{window:{matchMedia:()=>({matches:false})}});
  const render=()=>{cursor=0;return hook.useExercise({tonic:'C',scaleId:'major'});};
  render().change('instrument','Pipa');render().change('difficulty','Advanced');
  assert.equal(render().settings.clef,'mixedStaff');
  assert.equal(typeof render().generateNew(72),'number');
  const {exercise,settings}=render().current;
  assert.equal(exercise.staffMode,'mixed');assert.equal(exercise.clef,'treble');assert.equal(exercise.lowerMeasures,undefined);
  assert.ok(exercise.measures.some(m=>m.events.some(n=>n.chord)));
  const study={id:'mixed',created:1,bpm:72,settings,exercise:{...exercise,tempo:72}};
  assert.equal(validStudy(study,true),true);
  const restored=readLibrary(JSON.stringify({version:1,scores:[study],presets:[]}));
  assert.deepEqual(plain(restored.scores[0]),plain(study));
  assert.deepEqual(plain(planSingleStaff(restored.scores[0].exercise,exercise.measures)),plain(planSingleStaff(exercise,exercise.measures)));
  render().change('clef','bass');render().generateNew(72);
  assert.equal(render().current.exercise.staffMode,'fixed');
  assert.equal(render().current.exercise.clef,'bass');
  assert.equal(validStudy({...study,exercise:{...study.exercise,staffMode:'unknown'}},true),false);
});

test('mixed range selection uses the correct staff and still round-trips the same MIDI values',()=>{
  for(const midi of [45,48,55,59,60,64,72,88]){
    const clef=mixedRangeClef(midi),pitch=rangeNotePosition(midi);
    const y=150-5*(pitch.octave*7+pitch.degree-rangeStaffBottom[clef]);
    const selected=rangeMidiAtY(y,150,clef,0,21,108);
    assert.equal(selected,midi-(pitch.sharp?1:0));
    assert.equal(clef,midi<60?'bass':'treble');
  }
});
