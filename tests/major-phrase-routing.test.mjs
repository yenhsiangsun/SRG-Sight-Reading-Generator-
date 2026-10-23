import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {loadModule} from './helpers.mjs';

const fixtures=JSON.parse(fs.readFileSync('tests/fixtures/major-phrase-routing.json','utf8'));
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const plain=value=>JSON.parse(JSON.stringify(value));
const rhythm=ex=>ex.measures.map(b=>b.events.map(n=>[n.startUnits,n.durationUnits,n.rest,n.tuplet]));
const bridge=`export {refineFastPassages} from '../music/tempoFlow';
export {coordinateGrandStaff} from '../music/grandAccompaniment';
export {validateGeneratedExercise} from '../music/exerciseQuality';
export {addInstrumentHarmony} from '../music/instrumentHarmony';
export {addPerformanceMarks} from '../music/performanceMarks';
export {addPipaTechniques} from '../music/pipaTechniques';
export {createPlaybackEvents} from '../audio/PlaybackController';
export {notePitches} from '../music/notePitches';
export {isShengInstrument,isShengPracticeVoicing} from '../music/shengFingering';`;

function finish(composed,options,seed){
  // Match the saved listening review's fresh final-stage stream at BPM80.
  const api=loadModule('src/hooks/useExercise.ts',seed,bridge);
  let ex={...plain(composed),soundProfile:options.instrumentProfile,tempo:80};
  ex=api.refineFastPassages(ex,options.range,options.instrumentProfile,false);
  ex=api.coordinateGrandStaff(ex,options.range,false,false);
  api.validateGeneratedExercise(ex,options.range,false);
  ex=api.addInstrumentHarmony(ex,options.range);
  ex=api.addPerformanceMarks(ex);
  ex=api.addPipaTechniques(ex,options.range);
  api.validateGeneratedExercise(ex,options.range,false);
  return {api,ex};
}

for(const fixture of fixtures.listened){
  test(`human listening group${fixture.group} keeps the exact selected ${fixture.selected} composition and final score`,()=>{
    const composed=loadModule('src/music/composeExercise.ts',fixture.seed).composeExercise(fixture.options);
    assert.equal(hash(composed),fixture.composedSHA256);
    const {api,ex}=finish(composed,fixture.options,fixture.seed);
    assert.equal(hash(ex),fixture.finalSHA256);
    const playback=api.createPlaybackEvents(ex,80,true);
    assert.equal(playback.duration,fixture.options.timeSignature==='4/4'?24:36);
    assert.ok(playback.events.length>0);
    assert.ok(playback.events.every(e=>Number.isFinite(e.time)&&Number.isFinite(e.duration)&&e.duration>0));
  });
}

for(const fixture of fixtures.untouched){
  test(`major phrase routing preserves ${fixture.counterpointB86?'the original melody and rhythm with the authorized B86 bass correction':'the previous seeded output'} for ${fixture.name}`,()=>{
    const ex=loadModule('src/music/composeExercise.ts',fixture.seed).composeExercise(fixture.options,fixture.grandMode,fixture.strategy);
    const correction=fixture.counterpointB86;
    if(correction){
      assert.equal(hash(ex),correction.composedSHA256);
      assert.notEqual(hash(ex),fixture.composedSHA256);
      assert.equal(hash(ex.measures),correction.upperSHA256);
      const timing=[ex.measures,ex.lowerMeasures].map(staff=>staff.map(bar=>({...bar,events:bar.events.map(({midi:_midi,key:_key,octave:_octave,chord:_chord,...n})=>n)})));
      assert.equal(hash(timing),correction.timingSHA256);
      const {lowerMeasures,...unchanged}=ex;
      assert.ok(lowerMeasures?.length);
      assert.equal(hash(unchanged),correction.unchangedOutsideLowerSHA256);
    }else assert.equal(hash(ex),fixture.composedSHA256);
  });
}

test('approved major phrasing keeps pitch grades independent of rhythm and preserves all three rhythm tiers',()=>{
  const base=fixtures.listened[0].options,signatures=[];
  for(const rhythmLevel of ['simple','medium','complex']){
    let timing,phrases;
    for(const difficulty of ['beginner','intermediate','advanced']){
      const options={...base,difficulty,rhythmLevel};
      const composed=loadModule('src/music/composeExercise.ts',57037).composeExercise(options);
      const {api,ex}=finish(composed,options,57037);
      const current=JSON.stringify(rhythm(ex));timing??=current;assert.equal(current,timing);
      const plan=JSON.stringify(ex.phrasePlan);phrases??=plan;assert.equal(plan,phrases);
      const material=loadModule('src/music/scales.ts').buildPitchMaterial(ex.tonality,options.range);
      for(const n of ex.measures.flatMap(b=>b.events).filter(n=>!n.rest)){
        for(const p of api.notePitches(n)){
          assert.ok(p.midi>=options.range.min&&p.midi<=options.range.max);
          assert.ok(material.pitchClasses.includes(p.midi%12));
        }
        if(n.chord)assert.ok(api.isShengPracticeVoicing(api.notePitches(n).map(p=>p.midi),options.instrumentProfile));
      }
      assert.equal(ex.measures.flatMap(b=>b.events).filter(n=>!n.rest).at(-1).midi%12,0);
    }
    signatures.push(timing);
  }
  assert.equal(new Set(signatures).size,3);
});

test('the approved major route respects selected keys and instrument ranges through the final pipeline',()=>{
  const base=fixtures.listened[0].options;
  const {pitchClass}=loadModule('src/music/scales.ts');
  for(const tonic of ['D','Bb'])for(const instrumentProfile of ['Sheng','AltoSheng','Erhu','Pipa']){
    const options={...base,tonic,keySignature:tonic,instrumentProfile,difficulty:'advanced',rhythmLevel:'complex'};
    const composed=loadModule('src/music/composeExercise.ts',57037).composeExercise(options);
    const {api,ex}=finish(composed,options,57037);
    const material=loadModule('src/music/scales.ts').buildPitchMaterial(ex.tonality,options.range);
    const notes=ex.measures.flatMap(b=>b.events).filter(n=>!n.rest);
    for(const n of notes)for(const p of api.notePitches(n)){
      assert.ok(p.midi>=options.range.min&&p.midi<=options.range.max);
      assert.ok(material.pitchClasses.includes(p.midi%12));
    }
    if(api.isShengInstrument(instrumentProfile))for(const n of notes.filter(n=>n.chord))
      assert.ok(api.isShengPracticeVoicing(api.notePitches(n).map(p=>p.midi),instrumentProfile));
    assert.equal(notes.at(-1).midi%12,pitchClass(tonic));
    assert.equal(api.createPlaybackEvents(ex,80,true).duration,24);
  }
});

test('narrow custom ranges retain the existing legal fallback when the new complete guide cannot fit',()=>{
  const base=fixtures.listened[0].options;
  for(const range of [{min:60,max:64},{min:62,max:71}]){
    const options={...base,range};
    const composed=loadModule('src/music/composeExercise.ts',57037).composeExercise(options);
    const {api,ex}=finish(composed,options,57037);
    for(const n of ex.measures.flatMap(b=>b.events).filter(n=>!n.rest))for(const p of api.notePitches(n))
      assert.ok(p.midi>=range.min&&p.midi<=range.max);
    assert.equal(api.createPlaybackEvents(ex,80,true).duration,24);
  }
});
