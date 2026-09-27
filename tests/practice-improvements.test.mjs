import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';
const plain=x=>JSON.parse(JSON.stringify(x));
const opts={instrument:'Sheng',instrumentProfile:'Sheng',clef:'treble',difficulty:'intermediate',keySignature:'C',timeSignature:'4/4',rhythmLevel:'medium',measures:8,tempo:80,range:{min:55,max:88},allowAccidentals:false,mixedMeters:false,meters:['4/4','6/8'],tonic:'C',scaleId:'major'};
const settings={instrument:'Sheng',clef:'treble',difficulty:'Intermediate',keySignature:'C',timeSignature:'4/4',rhythmLevel:'Moderate',measureCount:8,rangeMinMidi:55,rangeMaxMidi:88,allowAccidentals:false,mixedMeters:false,meters:['4/4','6/8'],tonic:'C',scaleId:'major'};
const {composeExercise}=loadModule('src/music/composeExercise.ts',783);
const {validateGeneratedExercise,melodicVoice}=loadModule('src/music/exerciseQuality.ts');
const {describeTonality,SCALES,pitchClass}=loadModule('src/music/scales.ts');
const {planPhraseHarmony}=loadModule('src/music/phraseHarmony.ts');
const library=loadModule('src/practice/library.ts');
const {RHYTHM_FOCUSES,focusSettings}=loadModule('src/practice/focus.ts');
const {TIME_SIGNATURES}=loadModule('src/music.ts');
const {assertMeasureRhythm}=loadModule('src/music/rhythmTiming.ts');
const {planBreathing,needsBreath,instrumentMotionPenalty,harmonyMotionCost}=loadModule('src/music/instrumentPlayability.ts');
const {addLeapPractice}=loadModule('src/music/leapPractice.ts');
const {recordTraining,recommendTraining,readTraining}=loadModule('src/practice/training.ts');

test('40–400 BPM scores and presets survive saving and reopening; invalid saves fail before writing',()=>{
  const exercise={...composeExercise(opts),soundProfile:'Sheng'};
  for(const bpm of [40,180,181,240,320,400])for(const kind of ['scores','presets']){
    const study={id:'tempo-'+bpm,created:1,bpm,settings,...(kind==='scores'?{exercise:{...exercise,tempo:bpm}}:{})};
    const saved=library.addStudy(library.emptyLibrary(),study,kind);
    assert.deepEqual(plain(library.readLibrary(JSON.stringify(saved))),plain(saved));
  }
  for(const bpm of [39,401,NaN,Infinity,80.5])assert.throws(()=>library.addStudy(library.emptyLibrary(),{id:'bad',created:1,bpm,settings},'presets'),/libraryError/);
  const bad={...exercise,harmonyPlan:[{root:999,pitches:[0],role:'home'}]};
  assert.equal(library.validStudy({id:'bad',created:1,bpm:80,settings,exercise:bad},true),false);
});

test('whole-piece harmonic plans begin and end at the modal center and never invent foreign tones',()=>{
  for(const {id} of SCALES)for(const tonic of ['C','F#','Bb'])for(const count of [1,2,4,8,12]){
    const tonality=describeTonality(tonic,id),plan=planPhraseHarmony(tonality,Array(count).fill('6/8'),count);
    if(id==='atonal'){assert.equal(plan.length,0);continue;}
    const pitches=tonality.notes.map(pitchClass),root=pitchClass(tonality.tonic);
    assert.equal(plan.length,count);assert.equal(plan[0].root,root);assert.equal(plan.at(-1).root,root);
    for(const bar of plan){assert.ok(pitches.includes(bar.root));assert.ok(bar.pitches.every(pc=>pitches.includes(pc)));}
  }
  const piano=composeExercise({...opts,instrument:'Piano',instrumentProfile:'Piano',range:{min:36,max:84}},'two-hand');
  assert.equal(piano.harmonyPlan.length,8);assert.equal(piano.lowerMeasures.length,8);
  validateGeneratedExercise(piano,{min:36,max:84},false);
  assert.equal(composeExercise({...opts,allowAccidentals:true}).harmonyPlan,undefined);
  assert.equal(composeExercise({...opts,scaleId:'atonal'}).harmonyPlan,undefined);
});

test('shared harmony aligns strong beats without collapsing pitch-grade differences',()=>{
  const {composeExercise}=loadModule('src/music/composeExercise.ts',446);
  const {metricPosition}=loadModule('src/music/meterFeel.ts');const averages=[];
  for(const difficulty of ['beginner','intermediate','advanced']){
    let leaps=[],aligned=0,total=0;
    for(let i=0;i<24;i++){
      const ex=composeExercise({...opts,difficulty,range:{min:55,max:90}});
      const notes=ex.measures.flatMap(b=>b.events).filter(n=>!n.rest);
      leaps.push(...notes.slice(1).map((n,j)=>Math.abs(n.midi-notes[j].midi)));
      ex.measures.forEach((bar,index)=>bar.events.filter(n=>!n.rest&&metricPosition(bar,n.startUnits).onPulse).forEach(n=>{
        aligned+=ex.harmonyPlan[index].pitches.includes(n.midi%12);total++;
      }));
    }
    averages.push(leaps.reduce((sum,n)=>sum+n,0)/leaps.length);
    assert.ok(aligned/total>.7,'most strong-beat notes reinforce the preplanned harmony');
  }
  assert.ok(averages[1]>averages[0]*1.5);assert.ok(averages[2]>averages[1]*1.4,JSON.stringify(averages));
});

test('breathing opportunities preserve exact bars, tuplets and the final cadence; instruments differ',()=>{
  const quarter={meter:'4/4',notes:Array.from({length:4},(_,i)=>({units:4,duration:'q',dots:0,rest:false,startUnits:i*4}))};
  const plan=Array.from({length:8},()=>plain(quarter)),before=JSON.stringify(plan),wind=planBreathing(plan,'Flute');
  assert.equal(JSON.stringify(plan),before);assert.equal(wind[3].notes.at(-1).rest,true);assert.equal(wind[3].notes.at(-1).units,2);
  assert.equal(wind[7].notes.at(-1).rest,false);assert.equal(planBreathing(plan,'Piano'),plan);
  for(const bar of wind)assert.equal(bar.notes.reduce((s,n)=>s+n.units,0),16);
  assert.equal(needsBreath('Sheng'),true);assert.equal(needsBreath('Voice'),true);assert.equal(needsBreath('Violin'),false);
  for(const meter of Object.keys(TIME_SIGNATURES))for(const focus of ['balanced','triplets']){
    const ex=composeExercise({...opts,timeSignature:meter,rhythmFocus:focus});
    for(const bar of ex.measures)assertMeasureRhythm(bar,meter);
    assert.equal(ex.measures.at(-1).events.at(-1).rest,false);
  }
  const run=pitches=>({...composeExercise(opts),measures:[{events:pitches.map(midi=>({midi,rest:false,durationUnits:1}))}]});
  assert.ok(instrumentMotionPenalty(run([60,72,60,72]),'Flute')>instrumentMotionPenalty(run([60,62,64,65]),'Flute'));
  const pitch=midi=>({midi,key:'c/4',octave:4});
  assert.ok(harmonyMotionCost([pitch(60)],[pitch(72)],'Piano')>harmonyMotionCost([pitch(60)],[pitch(62)],'Piano'));
});

test('new targeted rhythms keep exact durations in every meter and target the named skill',()=>{
  for(const meter of Object.keys(TIME_SIGNATURES))for(const focus of RHYTHM_FOCUSES){
    const ex=composeExercise({...opts,timeSignature:meter,rhythmFocus:focus});
    for(const bar of ex.measures)assertMeasureRhythm(bar,meter);
    const notes=ex.measures.flatMap(b=>b.events).filter(n=>!n.rest);
    if(focus==='triplets'&&meter.endsWith('/4'))assert.ok(notes.some(n=>n.tuplet===3));
    if(focus==='triplets'&&meter.endsWith('/8'))assert.ok(notes.every(n=>!n.tuplet));
    if(focus==='offbeats'&&meter.endsWith('/4'))assert.ok(notes.some(n=>n.startUnits%2===1&&n.durationUnits===2));
  }
  assert.equal(focusSettings('triplets').timeSignature,'4/4');assert.equal(focusSettings('triplets').mixedMeters,false);
  const mixed=focusSettings('mixed'),ex=composeExercise({...opts,...mixed});
  assert.ok(new Set(ex.measures.map(m=>m.timeSignature)).size>=2);
});

test('interval practice adds jumps without moving rhythms, mode, endpoints or difficulty limits',()=>{
  const source=composeExercise({...opts,difficulty:'beginner'}),before=JSON.stringify(source),focused=addLeapPractice(source,opts.range);
  assert.equal(JSON.stringify(source),before);validateGeneratedExercise(focused,opts.range,false);
  const sourceNotes=source.measures.flatMap(b=>b.events).filter(n=>!n.rest),notes=focused.measures.flatMap(b=>b.events).filter(n=>!n.rest);
  assert.equal(notes[0].midi,sourceNotes[0].midi);assert.equal(notes.at(-1).midi,sourceNotes.at(-1).midi);
  assert.ok(notes.some((n,i)=>i&&Math.abs(n.midi-notes[i-1].midi)>=4));
  const rhythm=ex=>JSON.stringify(ex.measures.map(b=>b.events.map(n=>[n.startUnits,n.durationUnits,n.rest])));
  assert.equal(rhythm(source),rhythm(focused));
  for(const mode of ['mono','two-hand']){
    const ex=composeExercise({...opts,range:{min:48,max:84},pitchFocus:'leaps'},mode);
    validateGeneratedExercise(ex,{min:48,max:84},false);assert.equal(melodicVoice(ex).length,8);
  }
});

test('interval practice protects preparation, approach and tonic across every ending position and staff mode',()=>{
  const {composeExercise}=loadModule('src/music/composeExercise.ts',783);
  const range={min:48,max:84},endings=new Set();
  for(const grandMode of [undefined,'mono','two-hand'])for(const measures of [1,2,8])for(let sample=0;sample<4;sample++) {
    const source=composeExercise({...opts,range,measures},grandMode);
    const before=JSON.stringify(source),focused=addLeapPractice(source,grandMode==='two-hand'?{min:60,max:range.max}:range);
    const original=melodicVoice(source).flatMap(b=>b.events).filter(n=>!n.rest);
    const notes=melodicVoice(focused).flatMap(b=>b.events).filter(n=>!n.rest);
    endings.add(original.length%4);
    assert.deepEqual(notes.slice(-3).map(n=>n.midi),original.slice(-3).map(n=>n.midi));
    assert.equal(JSON.stringify(source),before);
    validateGeneratedExercise(focused,range,false);
  }
  assert.equal(endings.size,4,'exercise every position relative to the four-note interval pattern');
});

const result={pitch:96,rhythm:94,completion:100,confidence:98,reliable:true,notes:[]};
test('adaptive suggestions require three distinct reliable comparable scores and change only one axis',()=>{
  const ex=composeExercise(opts);let history=[];
  for(let i=0;i<3;i++){
    if(i<3)assert.equal(recommendTraining(history,ex,settings,80),null);
    history=recordTraining(history,String(i),ex,settings,80,result,100+i);
  }
  const advice=recommendTraining(history,ex,settings,80);
  assert.equal(advice.axis,'pitch');assert.deepEqual(plain(advice.settings),{difficulty:'Advanced'});
  assert.equal(recordTraining(history,'2',ex,settings,80,result),history);
  for(const bad of [{reliable:false},{completion:50},{confidence:20},{clipped:true}])assert.equal(recordTraining(history,'bad',ex,settings,80,{...result,...bad}),history);
  assert.equal(recommendTraining(history,ex,{...settings,instrument:'Flute'},80),null);
  assert.equal(recommendTraining(history,ex,settings,150),null);
  assert.equal(recommendTraining(history,ex,{...settings,rangeMinMidi:65},80),null);
  assert.equal(recommendTraining(history,ex,{...settings,clef:'bass'},80),null);
  assert.deepEqual(plain(readTraining(JSON.stringify(history))),plain(history));assert.equal(readTraining('bad').length,0);
  const weak=history.map(a=>({...a,pitch:60}));assert.deepEqual(plain(recommendTraining(weak,ex,settings,80).settings),{difficulty:'Beginner'});
});

test('saved preset and accepted suggestions preserve explicit BPM through the actual generation hook',()=>{
  let state=[],cursor=0;const react={useState(initial){const i=cursor++;if(!(i in state))state[i]=initial;return [state[i],next=>{state[i]=typeof next==='function'?next(state[i]):next;}];}};
  const hook=loadModule('src/hooks/useExercise.ts',71,undefined,{react},{window:{matchMedia:()=>({matches:false})}});
  const render=()=>{cursor=0;return hook.useExercise();};
  for(const bpm of [240,320,400]){
    assert.equal(render().generateFrom({...settings,timeSignature:'6/8'},bpm,bpm),bpm);
    assert.equal(render().current.exercise.tempo,bpm);
  }
  assert.equal(render().generateNew(80,{difficulty:'Advanced'},80),80);
  assert.equal(render().current.settings.difficulty,'Advanced');
});

test('portrait and landscape score sizes round-trip independently with finite safe bounds',()=>{
  const {readScoreSizes}=loadModule('src/practice/scoreLayout.ts');
  assert.deepEqual(plain(readScoreSizes('{"portrait":1.3,"landscape":0.85}')),{portrait:1.3,landscape:.85});
  assert.deepEqual(plain(readScoreSizes('{"portrait":99,"landscape":-10}')),{portrait:1.5,landscape:.8});
  for(const raw of ['null','bad','{"portrait":"large"}',null])assert.deepEqual(plain(readScoreSizes(raw)),{portrait:1,landscape:1});
});
