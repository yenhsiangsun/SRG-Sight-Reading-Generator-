import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

const {composeExercise}=loadModule('src/music/composeExercise.ts',816);
const {addScalePractice}=loadModule('src/music/scalePractice.ts');
const {buildPitchMaterial,SCALES}=loadModule('src/music/scales.ts');
const {melodicVoice,validateGeneratedExercise}=loadModule('src/music/exerciseQuality.ts');
const {createPlaybackEvents}=loadModule('src/audio/PlaybackController.ts');
const {metricPosition}=loadModule('src/music/meterFeel.ts');
const focus=loadModule('src/practice/focus.ts');
const {validSettings}=loadModule('src/practice/library.ts');
const options={instrument:'Sheng',clef:'treble',difficulty:'beginner',keySignature:'C',tonic:'C',scaleId:'major',
  timeSignature:'4/4',rhythmLevel:'simple',measures:8,tempo:80,range:{min:48,max:84},allowAccidentals:false,
  mixedMeters:false,meters:['4/4','6/8']};
const sounding=measures=>measures.flatMap(bar=>bar.events).filter(n=>!n.rest);
const plain=value=>JSON.parse(JSON.stringify(value));

function assertScale(exercise,range) {
  validateGeneratedExercise(exercise,range,false);
  const voices=[melodicVoice(exercise),...(exercise.grandMode==='two-hand'?[exercise.lowerMeasures]:[])];
  const pitches=buildPitchMaterial(exercise.tonality,range).pitches.map(p=>p.midi);
  for(const voice of voices) {
    const notes=sounding(voice);
    assert.ok(notes.length);
    const voiceRange=exercise.grandMode==='two-hand'?(voice===voices[0]?{min:60,max:range.max}:{min:range.min,max:59}):range;
    const material=buildPitchMaterial(exercise.tonality,voiceRange);
    if(material.tonicPC!==null&&material.pitches.some(p=>p.midi%12===material.tonicPC))
      assert.equal(notes.at(-1).midi%12,material.tonicPC,'resolve to the modal tonic, not necessarily the opening note');
    const steps=notes.slice(1).map((note,i)=>Math.abs(pitches.indexOf(note.midi)-pitches.indexOf(notes[i].midi)));
    assert.ok(steps.filter(n=>n<=1).length>=steps.length*.65,'scalar motion remains the main material');
    if(steps.length)assert.ok(steps.at(-1)<=1,'approach the cadence by a scale step');
    assert.ok(notes.every(note=>!note.chord));
  }
}

test('scale focus combines with rhythm skills, switches from leaps and survives saved settings',()=>{
  const selected=focus.togglePracticeFocus(['leaps','dotted'],'scales');
  assert.deepEqual(plain(selected),['dotted','scales']);
  assert.deepEqual(plain(focus.togglePracticeFocus(selected,'leaps')),['dotted','leaps']);
  const settings={instrument:'Sheng',clef:'treble',difficulty:'Beginner',keySignature:'C',tonic:'C',scaleId:'major',
    timeSignature:'4/4',rhythmLevel:'Simple',measureCount:8,rangeMinMidi:55,rangeMaxMidi:90,
    allowAccidentals:true,mixedMeters:false,meters:['4/4','6/8'],...focus.focusSettings(selected)};
  assert.equal(settings.allowAccidentals,false);
  assert.ok(validSettings(settings));
  assert.deepEqual(plain(focus.selectedPracticeFocus(settings)),['dotted','scales']);
  assert.equal(focus.focusSettings('balanced').pitchFocus,'balanced');
});

test('every supported scale forms scalar phrases in both directions and a modal ending',()=>{
  for(const scale of SCALES)for(const difficulty of ['beginner','intermediate','advanced']) {
    const exercise=composeExercise({...options,scaleId:scale.id,difficulty,pitchFocus:'scales'});
    assertScale(exercise,options.range);
    const notes=sounding(exercise.measures);
    assert.ok(notes.some((n,i)=>i&&n.midi>notes[i-1].midi));
    assert.ok(notes.some((n,i)=>i&&n.midi<notes[i-1].midi));
  }
});

test('scale shaping preserves rhythm, mixed meter, rests, tuplets and playback duration for every staff mode',()=>{
  for(const mode of [undefined,'mono','two-hand'])for(const rhythmLevel of ['simple','medium','complex']) {
    const source=composeExercise({...options,rhythmLevel,mixedMeters:true,rhythmFocus:['sixteenths','dotted','triplets']},mode);
    const before=JSON.stringify(source),exercise=addScalePractice(source,options.range);
    assert.equal(JSON.stringify(source),before);
    assertScale(exercise,options.range);
    assert.equal(createPlaybackEvents(source,80).duration,createPlaybackEvents(exercise,80).duration);
    const rhythm=ex=>plain(melodicVoice(ex).map(bar=>bar.events.map(n=>[n.startUnits,n.durationUnits,n.rest,n.tuplet])));
    assert.deepEqual(rhythm(exercise),rhythm(source));
    assert.ok(sounding(melodicVoice(exercise)).some(n=>n.tuplet));
    assert.ok(sounding(melodicVoice(exercise)).some(n=>n.dots===1));
  }
});

test('two-hand scale phrases share harmonic arrivals without sacrificing scalar motion or either rhythm',()=>{
  const {composeExercise}=loadModule('src/music/composeExercise.ts',783);
  const range={min:36,max:84};
  const rhythm=exercise=>plain([exercise.measures,exercise.lowerMeasures].map(staff=>staff.map(bar=>({
    meter:bar.timeSignature,events:bar.events.map(n=>[n.startUnits,n.durationUnits,n.rest,n.tuplet]),
  }))));
  for(const difficulty of ['beginner','intermediate','advanced']) {
    let clashes=0,overlaps=0,aligned=0,arrivals=0;
    for(const rhythmLevel of ['simple','medium','complex'])for(const timeSignature of ['4/4','6/8'])for(let sample=0;sample<2;sample++) {
      const source=composeExercise({...options,instrument:'Piano',instrumentProfile:'Piano',range,difficulty,rhythmLevel,timeSignature},'two-hand');
      const exercise=addScalePractice(source,range);
      assertScale(exercise,range);
      assert.deepEqual(rhythm(exercise),rhythm(source));
      assert.deepEqual(plain(exercise.harmonyPlan),plain(source.harmonyPlan));
      for(const staff of [exercise.measures,exercise.lowerMeasures]) {
        const ending=sounding(staff).slice(-2);
        assert.notEqual(ending[0].midi,ending[1].midi,'a reachable cadence uses a neighbour, even under harmonic pressure');
      }
      exercise.measures.forEach((bar,b)=>bar.events.filter(n=>!n.rest&&metricPosition(bar,n.startUnits).onPulse).forEach(note=>{
        arrivals++;aligned+=exercise.harmonyPlan[b].pitches.includes(note.midi%12);
        // Include a left-hand note held across a later right-hand arrival.
        const bass=exercise.lowerMeasures[b].events.find(n=>!n.rest&&n.startUnits<=note.startUnits&&n.startUnits+n.durationUnits>note.startUnits);
        if(bass) {overlaps++;clashes+=![0,3,4,5,7,8,9].includes(((note.midi-bass.midi)%12+12)%12);}
      }));
    }
    assert.ok(aligned/arrivals>.7,`${difficulty}: harmonic arrivals ${aligned}/${arrivals}`);
    assert.ok(clashes/overlaps<.1,`${difficulty}: unprepared strong-beat clashes ${clashes}/${overlaps}`);
  }
});

test('scale focus handles short and narrow ranges, including a tonic only at the upper boundary',()=>{
  for(const range of [{min:62,max:65},{min:59,max:60},{min:61,max:62}])for(const measures of [1,2,4]) {
    const exercise=composeExercise({...options,range,measures,pitchFocus:'scales'});
    assertScale(exercise,range);
  }
});


test('musical scale studies vary entry degrees, turn within the range and develop beyond the first phrase',()=>{
  const starts=new Set(),fingerprints=new Set();let innerTurns=0,repeatedBars=0,scalarPhrases=0;
  for(let sample=0;sample<30;sample++) {
    const exercise=composeExercise({...options,instrumentProfile:'Erhu',pitchFocus:'scales'});
    const notes=sounding(exercise.measures),midis=notes.map(n=>n.midi);
    starts.add(midis[0]%12);fingerprints.add(midis.join(','));
    const low=Math.min(...midis),high=Math.max(...midis);
    for(let i=1;i<midis.length-1;i++)if(midis[i]>low&&midis[i]<high&&
      (midis[i]-midis[i-1])*(midis[i+1]-midis[i])<0)innerTurns++;
    for(let bar=0;bar<6;bar+=2) {
      const line=sounding(exercise.measures.slice(bar,bar+2)).map(n=>n.midi);
      if(new Set(line).size>=3)scalarPhrases++;
    }
    for(let bar=1;bar<exercise.measures.length;bar++) {
      if(JSON.stringify(sounding([exercise.measures[bar]]).map(n=>n.midi))===JSON.stringify(sounding([exercise.measures[bar-1]]).map(n=>n.midi)))repeatedBars++;
    }
  }
  assert.ok(repeatedBars<30*7*.05,`incidental repeated fragments must remain rare: ${repeatedBars}`);
  assert.ok(scalarPhrases>=30*3*.9,`scalar phrases: ${scalarPhrases}`);
  assert.ok(starts.size>=3,'begin on several different scale degrees');
  assert.equal(fingerprints.size,30);
  assert.ok(innerTurns>=30,'turns occur inside the register, not just at octave boundaries');
});
