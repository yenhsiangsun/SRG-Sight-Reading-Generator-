import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

const {fingerprintExercise, scoreRecentSimilarity, rememberRecentExercise, readRecentExercises,
  RECENT_VARIETY_KEY, RECENT_VARIETY_LIMIT} = loadModule('src/practice/recentVariety.ts');
const settings = {instrument:'Piano', clef:'treble', difficulty:'Intermediate', rhythmLevel:'Medium',
  pitchFocus:'balanced', rhythmFocus:'balanced', mixedMeters:false, timeSignature:'4/4', meters:['4/4','6/8'],
  rangeMinMidi:48, rangeMaxMidi:84, allowAccidentals:false, allowedKeySignatures:['C','G'], measureCount:4};
const melody = [[60,62,64,67],[69,67,65,64],[62,64,65,67],[65,64,62,60]];
const contrast = [[60,67,64,72],[65,60,69,62],[72,67,59,65],[67,60,64,60]];
function exercise(bars = melody, durations = [4,4,4,4], transpose = 0) {
  return {instrument:'Piano', soundProfile:'Piano', clef:'treble', difficulty:'intermediate', rhythmLevel:'medium',
    keySignature:'C', timeSignature:'4/4', tempo:80,
    phrasePlan:[{startBar:0,endBar:1,role:'opening'},{startBar:2,endBar:3,role:'closing'}],
    harmonyPlan:[0,5,7,0].map(root=>({root:(root+transpose)%12,pitches:[0,4,7].map(pitch=>(root+transpose+pitch)%12),role:'depart'})),
    measures:bars.map(pitches=>({timeSignature:'4/4',totalUnits:16,groups:[4,4,4,4],beamGroups:[4,4,4,4],
      events:pitches.map((midi,index)=>({midi:midi+transpose,key:'c',octave:4,rest:false,duration:'q',dots:0,
        startUnits:durations.slice(0,index).reduce((sum,units)=>sum+units,0),durationUnits:durations[index]}))}))};
}
function memoryStorage(raw = null) {
  return {getItem:()=>raw,setItem:(key,value)=>{assert.equal(key,RECENT_VARIETY_KEY);raw=value;},raw:()=>raw};
}

test('recent tune comparison recognizes transposition and ignores tempo or note spelling',()=>{
  const original=exercise(),history=[fingerprintExercise(original,settings)];
  const transposed=exercise(melody,[4,4,4,4],5);
  transposed.tempo=143;transposed.keySignature='F';
  assert.equal(scoreRecentSimilarity(original,history,settings),1);
  assert.equal(scoreRecentSimilarity(transposed,history,settings),1);
  assert.equal(scoreRecentSimilarity({...original,tonality:{tonic:null,scaleId:'atonal'}},history,{...settings,allowAccidentals:true}),0,
    'an accidental/atonal training context is not penalized for its previous tonal context');
});

test('changed contour and rhythm are substantially different even with the same key and final tonic',()=>{
  const history=[fingerprintExercise(exercise(),settings)];
  const changedContour=scoreRecentSimilarity(exercise(contrast),history,settings);
  const changedRhythm=scoreRecentSimilarity(exercise(melody,[2,6,2,6]),history,settings);
  const both=scoreRecentSimilarity(exercise(contrast,[2,6,2,6]),history,settings);
  assert.ok(changedContour<.72,`different contour should be useful contrast: ${changedContour}`);
  assert.ok(changedRhythm<.8,`different rhythm should be useful contrast: ${changedRhythm}`);
  assert.ok(both<.65,`both musical dimensions differ: ${both}`);
  assert.ok(both<changedContour&&both<changedRhythm);
});

test('small ornamental pitch changes do not disguise the same longer melodic line',()=>{
  const history=[fingerprintExercise(exercise(),settings)];
  const adjusted=melody.map(bar=>bar.map((pitch,index)=>pitch+(index===1?1:0)));
  const similarity=scoreRecentSimilarity(exercise(adjusted),history,settings);
  assert.ok(similarity>.75,`one-semitone inner-note variants are still a related study: ${similarity}`);
});

test('training contexts are isolated and equivalent focus/key/meter choices share history',()=>{
  const current=exercise(),combined={...settings,mixedMeters:true,rhythmFocus:['dotted','sixteenths']};
  const history=[fingerprintExercise(current,combined)];
  assert.equal(scoreRecentSimilarity(current,history,{...combined,rhythmFocus:['sixteenths','dotted'],
    allowedKeySignatures:['G','C'],meters:['6/8','4/4']}),1);
  for(const override of [{instrument:'Sheng'},{difficulty:'Beginner'},{rhythmLevel:'Complex'},{pitchFocus:'scales'},
    {rhythmFocus:'triplets'},{rangeMinMidi:60},{allowedKeySignatures:['F']},{meters:['3/4','6/8']}]) {
    assert.equal(scoreRecentSimilarity(current,history,{...combined,...override}),0,JSON.stringify(override));
  }
  assert.equal(scoreRecentSimilarity(current,history,settings),0);
});

test('returning motifs inside a score are allowed and legacy scores get whole-study contour summaries',()=>{
  const repeated=exercise([melody[0],melody[0],melody[2],melody[3]]);
  delete repeated.phrasePlan;
  const fingerprint=fingerprintExercise(repeated,settings);
  assert.equal(fingerprint.phrases.length,0);
  assert.equal(fingerprint.arc.length,16);
  assert.equal(scoreRecentSimilarity(repeated,[],settings),0,'no recent score means no penalty, regardless of internal repetition');
  assert.ok(scoreRecentSimilarity(exercise(contrast),[fingerprint],settings)<.75);
});

test('grand monophonic scores compare their complete melody through both staves',()=>{
  const source=exercise([[55,60,57,62],[64,59,62,57],[55,60,57,62],[64,59,57,55]]);
  const split={...source,grandMode:'mono',
    measures:source.measures.map(bar=>({...bar,events:bar.events.map(note=>note.midi>=60?note:{...note,rest:true,midi:undefined})})),
    lowerMeasures:source.measures.map(bar=>({...bar,events:bar.events.map(note=>note.midi<60?note:{...note,rest:true,midi:undefined})}))};
  const original=fingerprintExercise(source,settings),grand=fingerprintExercise(split,{...settings,clef:'grand'});
  for(const key of ['melody','rhythm','arc'])assert.equal(JSON.stringify(grand[key]),JSON.stringify(original[key]),key);
  const differentBass=structuredClone(split);differentBass.lowerMeasures[0].events[0].midi=52;
  assert.notEqual(JSON.stringify(fingerprintExercise(differentBass,{...settings,clef:'grand'}).melody),JSON.stringify(grand.melody));
});

test('piano accompaniment and left-hand voicings contribute to harmonic variety',()=>{
  const piano={...exercise(),grandMode:'two-hand',lowerMeasures:exercise(melody.map(bar=>bar.map(pitch=>pitch-24))).measures};
  const note=piano.lowerMeasures[0].events[0];note.chord=[{midi:note.midi},{midi:note.midi+4},{midi:note.midi+7}];
  const context={...settings,clef:'grand'},original=fingerprintExercise(piano,context),changed=structuredClone(piano);
  changed.lowerMeasures[0].events[0].chord[1].midi=note.midi+7;
  changed.lowerMeasures[0].events[0].chord[2].midi=note.midi+12;
  changed.lowerMeasures[1].events[1].midi-=2;
  const altered=fingerprintExercise(changed,context);
  assert.equal(JSON.stringify(altered.melody),JSON.stringify(original.melody));
  assert.notEqual(JSON.stringify(altered.harmony),JSON.stringify(original.harmony));
  assert.ok(scoreRecentSimilarity(changed,[original],context)<1);
});

test('bounded recent history keeps only compact musical features and survives blocked storage',()=>{
  const storage=memoryStorage();let history=[];
  for(let index=0;index<12;index++)history=rememberRecentExercise(exercise(melody,[4,4,4,4],index),settings,history,storage);
  assert.equal(history.length,RECENT_VARIETY_LIMIT);
  assert.equal(readRecentExercises(storage).length,RECENT_VARIETY_LIMIT);
  const raw=storage.raw();assert.ok(raw.length<32000);
  assert.ok(!raw.includes('measures')&&!raw.includes('events')&&!raw.includes('tempo'));
  const long=exercise(Array.from({length:32},()=>Array.from({length:48},(_,index)=>60+index%12)),Array(48).fill(1/3));
  const fingerprint=fingerprintExercise(long,settings);
  assert.ok(fingerprint.melody.length<=160&&fingerprint.rhythm.length<=160&&fingerprint.arc.length<=128);
  const blocked={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
  assert.equal(readRecentExercises(blocked).length,0);
  assert.equal(rememberRecentExercise(exercise(),settings,[],blocked).length,1);
  assert.equal(readRecentExercises().length,0,'server and test environments need no browser storage');
});

test('corrupt, oversized and invalid histories cannot break generation or pollute comparison',()=>{
  for(const raw of ['broken','null','{}',JSON.stringify({version:9,entries:[]}),
    JSON.stringify({version:1,entries:[{}]}),' '.repeat(32001),
    JSON.stringify({version:1,entries:[{...fingerprintExercise(exercise(),settings),measures:exercise().measures}]}),
    JSON.stringify({version:1,entries:Array.from({length:6},()=>fingerprintExercise(exercise(),settings))})]) {
    assert.equal(readRecentExercises(memoryStorage(raw)).length,0);
  }
  const invalid={...fingerprintExercise(exercise(),settings),melody:[NaN]};
  assert.equal(rememberRecentExercise(exercise(),settings,[invalid],memoryStorage()).length,1);
});
