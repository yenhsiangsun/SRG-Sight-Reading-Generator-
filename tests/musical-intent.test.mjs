import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

const base={compositionStyle:'classical',instrument:'Sheng',instrumentProfile:'Sheng',clef:'treble',difficulty:'beginner',keySignature:'C',tonic:'C',scaleId:'major',timeSignature:'4/4',rhythmLevel:'simple',measures:8,tempo:80,range:{min:60,max:84},allowAccidentals:false,mixedMeters:false,meters:['4/4']};
const rhythm=ex=>JSON.stringify(ex.measures.map(b=>b.events.map(n=>[n.startUnits,n.durationUnits,n.rest,n.tuplet])));
const plain=value=>JSON.parse(JSON.stringify(value));
const bridge=`export {composeExercise} from './composeExercise';export {validateGeneratedExercise} from './exerciseQuality';export {addPerformanceMarks} from './performanceMarks';export {addInstrumentHarmony} from './instrumentHarmony';export {validMusicalIntent} from './musicalIntent';export {createPlaybackEvents} from '../audio/PlaybackController';export {notePitches} from './notePitches';export {isShengPracticeVoicing} from './shengFingering';`;

test('three grammars preplan distinct forms, harmonic routes and rhythms before pitch generation',()=>{
  const api=loadModule('src/music/musicalIntent.ts',48013),plans=[];
  for(const compositionStyle of ['classical','lyrical','pentatonic']){
    const o={...base,compositionStyle,scaleId:compositionStyle==='pentatonic'?'major-pentatonic':'major'};
    const p=api.planMusicalIntent(o,()=>.3);assert.equal(p.grammar,compositionStyle);
    assert.ok(api.validMusicalIntent(p,8));assert.equal(p.harmony.length,8);plans.push(plain(p));
    assert.equal(p.phrases.at(-1).cadence,'home');
    for(const bar of p.rhythm)assert.equal(bar.notes.reduce((s,n)=>s+n.units,0),16);
    if(compositionStyle==='pentatonic')assert.ok(p.harmony.every(b=>b.pitches.length<=2));
  }
  assert.equal(new Set(plans.map(p=>JSON.stringify(p.phrases))).size,3);
  assert.equal(new Set(plans.map(p=>JSON.stringify(p.rhythm))).size,3);
  assert.equal(new Set(plans.map(p=>JSON.stringify(p.harmony))).size,3);
});

for(const compositionStyle of ['classical','lyrical','pentatonic'])test(`${compositionStyle}: grade-independent timing, legal final chords and playable events`,()=>{
  let previousRhythm;
  for(const difficulty of ['beginner','intermediate','advanced']){
    const api=loadModule('src/music/__intentBridge.ts',49009,bridge);
    const options={...base,compositionStyle,difficulty,scaleId:compositionStyle==='pentatonic'?'major-pentatonic':'major',rhythmLevel:'medium'};
    let ex=api.composeExercise(options);
    assert.equal(ex.musicalIntent.grammar,compositionStyle);api.validateGeneratedExercise(ex,options.range,false);
    previousRhythm??=rhythm(ex);assert.equal(rhythm(ex),previousRhythm);
    const last=ex.measures.flatMap(b=>b.events).filter(n=>!n.rest).at(-1);assert.equal(last.midi%12,0);
    if(compositionStyle==='classical'){
      const ending=ex.measures.slice(0,4).flatMap(b=>b.events).filter(n=>!n.rest).at(-1);assert.equal(ending.midi%12,7,'antecedent half cadence');
    }
    const line=JSON.stringify(ex.measures);
    ex=api.addPerformanceMarks(ex);assert.deepEqual(plain(ex.measures.map(b=>b.events.map(n=>[n.midi,n.durationUnits,n.rest]))),plain(JSON.parse(line).map(b=>b.events.map(n=>[n.midi,n.durationUnits,n.rest]))));
    ex=api.addInstrumentHarmony({...ex,soundProfile:'Sheng'},options.range);api.validateGeneratedExercise(ex,options.range,false);
    for(const n of ex.measures.flatMap(b=>b.events).filter(n=>n.chord))assert.ok(api.isShengPracticeVoicing(api.notePitches(n).map(p=>p.midi),'Sheng'));
    const playback=api.createPlaybackEvents(ex,80,true);assert.ok(playback.events.length);assert.ok(playback.events.every(e=>e.duration>0&&Number.isFinite(e.time)));
    assert.ok(api.validMusicalIntent(ex.musicalIntent,8));
  }
});

test('all fixed meters retain actual pulse lengths and support a full four-bar beginner song',()=>{
  const api=loadModule('src/music/__intentBridge.ts',51001,bridge);
  for(const timeSignature of ['2/4','3/4','4/4','5/4','3/8','6/8','7/8','9/8','12/8']){
    const o={...base,compositionStyle:'lyrical',timeSignature,measures:4};
    const ex=api.composeExercise(o);api.validateGeneratedExercise(ex,o.range,false);
    const [a,b]=timeSignature.split('/').map(Number);
    for(const bar of ex.measures)assert.equal(bar.events.reduce((s,n)=>s+n.durationUnits,0),a*16/b);
  }
});

test('piano and yangqin coordinate both hands against the intention harmony',()=>{
  const api=loadModule('src/music/__intentBridge.ts',53003,bridge);
  for(const instrumentProfile of ['Piano','Yangqin']){
    const o={...base,instrument:'Piano',instrumentProfile,range:{min:48,max:84},difficulty:'intermediate',rhythmLevel:'medium'};
    const ex=api.composeExercise(o,'two-hand');api.validateGeneratedExercise(ex,o.range,false);
    assert.equal(ex.lowerMeasures.length,8);assert.deepEqual(plain(ex.harmonyPlan),plain(ex.musicalIntent.harmony));
    for(const bar of ex.lowerMeasures)for(const n of bar.events)if(!n.rest)assert.ok(n.midi<60);
  }
});

test('specialist settings bypass intentions without consuming a new random stream',()=>{
  for(const patch of [{allowAccidentals:true},{mixedMeters:true,meters:['3/4','4/4']},{pitchFocus:'scales'},{rhythmFocus:'dotted'}]){
    const newOptions={...base,...patch},oldOptions={...newOptions};delete oldOptions.compositionStyle;
    const a=loadModule('src/music/composeExercise.ts',55001).composeExercise(newOptions);
    const b=loadModule('src/music/composeExercise.ts',55001).composeExercise(oldOptions);
    assert.deepEqual(plain(a),plain(b));assert.equal(a.musicalIntent,undefined);
  }
  const {validMusicalIntent}=loadModule('src/music/musicalIntent.ts');
  assert.ok(validMusicalIntent(undefined,8));assert.equal(validMusicalIntent({version:1,grammar:'bad'},8),false);
});

test('every grammar keeps distinct rhythm tiers, long beginner notes and complete longer forms',()=>{
  for(const compositionStyle of ['classical','lyrical','pentatonic']){
    const signatures=[];
    for(const rhythmLevel of ['simple','medium','complex']){
      const api=loadModule('src/music/composeExercise.ts',57001);
      const o={...base,compositionStyle,rhythmLevel,scaleId:compositionStyle==='pentatonic'?'major-pentatonic':'major'};
      const ex=api.composeExercise(o);signatures.push(rhythm(ex));
      if(rhythmLevel==='simple')assert.ok(ex.measures.some(b=>b.events.some(n=>!n.rest&&n.durationUnits>=8)));
    }
    assert.equal(new Set(signatures).size,3);
    for(const measures of [12,16]){
      const api=loadModule('src/music/composeExercise.ts',59009);
      const ex=api.composeExercise({...base,compositionStyle,measures,scaleId:compositionStyle==='pentatonic'?'major-pentatonic':'major'});
      assert.equal(ex.musicalIntent.phrases[0].startBar,0);assert.equal(ex.musicalIntent.phrases.at(-1).endBar,measures-1);
      const last=ex.measures.flatMap(b=>b.events).filter(n=>!n.rest).at(-1);assert.equal(last.midi%12,0);
    }
  }
});

test('chosen character filters compatible modes while retaining the user’s explicit key signatures',()=>{
  const api=loadModule('src/music/randomTonality.ts');
  for(const compositionStyle of ['classical','lyrical','pentatonic']){
    const choices=api.getTonalityDistribution([base.range],{compositionStyle,allowedKeySignatures:['C','G'],allowAccidentals:false});
    assert.ok(choices.length);
    const scales=loadModule('src/music/scales.ts');
    for(const c of choices){
      const t=scales.describeTonality(c.tonic,c.scaleId);assert.ok(['C','G'].includes(t.signature));
      assert.ok(compositionStyle==='pentatonic'?t.notes.length===5:t.notes.length===7);
    }
  }
  assert.throws(()=>api.getTonalityDistribution([base.range],{compositionStyle:'classical',allowedKeySignatures:['open']}),/樂曲性格/);
});

test('new plans round-trip through saved-study validation and reject corrupt metadata without migrating old scores',()=>{
  const {validStudy}=loadModule('src/practice/library.ts');
  const api=loadModule('src/music/composeExercise.ts',61001);
  const exercise={...plain(api.composeExercise({...base,compositionStyle:'lyrical'})),soundProfile:'Sheng'};
  const settings={...base,instrument:'Sheng',difficulty:'Beginner',rhythmLevel:'Simple',measureCount:8,rangeMinMidi:60,rangeMaxMidi:84,compositionStyle:'lyrical'};
  const study={id:'synthetic-intent',created:0,bpm:80,settings,exercise};
  assert.ok(validStudy(plain(study),true));
  const corrupt=plain(study);corrupt.exercise.musicalIntent.phrases[0].endBar=99;
  assert.equal(validStudy(corrupt,true),false);
  const legacy=plain(study);delete legacy.exercise.musicalIntent;delete legacy.settings.compositionStyle;
  assert.ok(validStudy(legacy,true));
  const unknown=plain(study);unknown.settings.compositionStyle='unknown';assert.equal(validStudy(unknown,true),false);
});
