import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

const {composeExercise}=loadModule('src/music/composeExercise.ts',491);
const {generatePracticeExercise,TIME_SIGNATURES}=loadModule('src/music.ts',712);
const {planStudyMelody}=loadModule('src/music/studyMelody.ts');
const {addModalPhrasing}=loadModule('src/music/modalPhrasing.ts');
const {planPhraseHarmony}=loadModule('src/music/phraseHarmony.ts');
const {buildPitchMaterial,describeTonality,pitchClass,SCALES}=loadModule('src/music/scales.ts');
const {validateGeneratedExercise,melodicVoice}=loadModule('src/music/exerciseQuality.ts');
const {createPlaybackEvents}=loadModule('src/audio/PlaybackController.ts');
const base={instrument:'Sheng',instrumentProfile:'Sheng',clef:'treble',difficulty:'intermediate',keySignature:'C',
  timeSignature:'4/4',rhythmLevel:'complex',measures:8,tempo:80,range:{min:55,max:90},allowAccidentals:false,
  mixedMeters:false,meters:['4/4','6/8','7/8'],tonic:'C',scaleId:'major'};
const notesOf=exercise=>melodicVoice(exercise).flatMap(bar=>bar.events).filter(note=>!note.rest);
const timing=exercise=>JSON.stringify(createPlaybackEvents(exercise,80).events.map(({time,duration})=>({time,duration})));

test('whole studies plan every sounding onset, develop across barlines and recall a later answer',()=>{
  const forms=new Set(),figures=new Set(),layouts=new Set();
  for(let sample=0;sample<60;sample++) {
    const raw=generatePracticeExercise({...base,measures:sample%2?8:16});
    const before=JSON.stringify(raw),pitches=buildPitchMaterial(raw.tonality,base.range).pitches;
    const plan=planStudyMelody(raw.measures,pitches,pitchClass(raw.tonality.tonic),raw.difficulty);
    forms.add(plan.form);layouts.add(plan.phrases.map(p=>p.endBar-p.startBar+1).join(','));plan.phrases.forEach(phrase=>figures.add(phrase.figure));
    assert.equal(new Set(plan.targets.map(target=>target.index)).size,notesOf(raw).length);
    assert.ok(plan.targets.every(target=>pitches.some(p=>p.midi===target.midi)));
    assert.ok(plan.phrases.every(phrase=>phrase.endBar>phrase.startBar));
    assert.equal(plan.phrases[0].role,'opening');
    assert.equal(plan.phrases.at(-1).role,'closing');
    assert.equal(plan.phrases.find(phrase=>phrase.role==='answer').figure,plan.phrases[0].figure);
    assert.equal(JSON.stringify(raw),before);
  }
  assert.equal(forms.size,8);assert.equal(figures.size,4);assert.ok(layouts.size>=4);
});

test('actual new scores contain connected scale figures throughout the piece and distinct graded ranges',()=>{
  const stats=['beginner','intermediate','advanced'].map(difficulty=>{
    const covered=new Set();let distance=0,count=0,span=0,repeatedBars=0;
    for(let sample=0;sample<40;sample++) {
      const exercise=composeExercise({...base,difficulty});
      validateGeneratedExercise(exercise,base.range,false);
      const material=buildPitchMaterial(exercise.tonality,base.range).pitches.map(p=>p.midi);
      const notes=exercise.measures.flatMap((bar,b)=>bar.events.filter(n=>!n.rest).map(n=>({...n,bar:b,degree:material.indexOf(n.midi)})));
      span+=Math.max(...notes.map(n=>n.midi))-Math.min(...notes.map(n=>n.midi));
      for(let n=1;n<notes.length;n++) {
        distance+=Math.abs(notes[n].midi-notes[n-1].midi);count++;
        if(n>1) {
          const a=notes[n-1].degree-notes[n-2].degree,b=notes[n].degree-notes[n-1].degree;
          if(a===b&&Math.abs(a)===1)covered.add(notes[n].bar);
        }
      }
      const bars=exercise.measures.map(bar=>bar.events.map(n=>`${n.rest?'r':n.midi}/${n.durationUnits}`).join(','));
      for(let b=1;b<bars.length;b++)if(bars[b]===bars[b-1])repeatedBars++;
    }
    assert.equal(covered.size,8,`${difficulty}: scale gestures also reach the later bars`);
    assert.equal(repeatedBars,0,'a response does not duplicate its adjacent bar');
    return {mean:distance/count,span:span/40};
  });
  assert.ok(stats[1].mean>stats[0].mean+.6&&stats[2].mean>stats[1].mean+.6,JSON.stringify(stats));
  assert.ok(stats[1].span>stats[0].span+4&&stats[2].span>stats[1].span+4,JSON.stringify(stats));
});

test('compound studies gain scalar connections without changing their 3+3 rhythm or playback',()=>{
  let oldRuns=0,newRuns=0;
  for(let sample=0;sample<80;sample++) {
    const raw=generatePracticeExercise({...base,timeSignature:'6/8'}),before=JSON.stringify(raw);
    const pitches=buildPitchMaterial(raw.tonality,base.range).pitches.map(p=>p.midi);
    const harmony=planPhraseHarmony(raw.tonality,raw.measures.map(bar=>bar.timeSignature),notesOf(raw).length);
    const legacy=addModalPhrasing(raw,base.range,false,harmony),study=addModalPhrasing(raw,base.range,false,harmony,true);
    const runs=exercise=>{
      const notes=notesOf(exercise).map(note=>pitches.indexOf(note.midi));let total=0;
      for(let n=2;n<notes.length;n++)if(Math.abs(notes[n]-notes[n-1])===1&&notes[n]-notes[n-1]===notes[n-1]-notes[n-2])total++;
      return total;
    };
    oldRuns+=runs(legacy);newRuns+=runs(study);
    assert.equal(JSON.stringify(raw),before);
    assert.equal(timing(study),timing(raw));
    assert.ok(study.measures.every(bar=>JSON.stringify(bar.beamGroups)==='[6,6]'));
  }
  assert.ok(newRuns>oldRuns*1.1,JSON.stringify({oldRuns,newRuns}));
});

test('modal closing gestures prepare a neighbouring tonic arrival, including longer and custom-range studies',()=>{
  for(const scaleId of ['major','natural-minor','harmonic-minor','dorian','phrygian','mixolydian','major-pentatonic','pelog-pentatonic'])
    for(const measures of [4,8,12,16])for(const timeSignature of ['4/4','6/8']) {
      const exercise=composeExercise({...base,scaleId,measures,timeSignature});
      validateGeneratedExercise(exercise,base.range,false);
      const last=notesOf(exercise).slice(-2);
      assert.equal(last[1].midi%12,0);
      assert.ok(Math.abs(last[1].midi-last[0].midi)>0&&Math.abs(last[1].midi-last[0].midi)<=3,`${scaleId}: ${last.map(n=>n.midi)}`);
      assert.equal(exercise.harmonyPlan.at(-2).role,'prepare');
      assert.equal(exercise.harmonyPlan.at(-1).role,'arrive');
      assert.equal(exercise.harmonyPlan.at(-1).root,0);
    }
  for(const {id} of SCALES.filter(scale=>scale.id!=='atonal')) {
    const tonality=describeTonality('C',id),plan=planPhraseHarmony(tonality,Array(12).fill('4/4'));
    const beforeFinal=plan.at(-2),threeBar=planPhraseHarmony(tonality,Array(3).fill('4/4'));
    assert.equal(beforeFinal.root,threeBar[1].root,'the prepared closing harmony is used regardless of piece length');
    assert.ok(!plan.at(-1).pitches.includes(3)||!plan.at(-1).pitches.includes(4),'do not sound both minor and major thirds in a final tonic chord');
  }
  for(const range of [{min:61,max:62},{min:65,max:69}])for(const timeSignature of Object.keys(TIME_SIGNATURES)) {
    const exercise=composeExercise({...base,range,timeSignature});
    validateGeneratedExercise(exercise,range,false);
    assert.ok(notesOf(exercise).every(note=>note.midi>=range.min&&note.midi<=range.max),'a tonic outside a custom range is never invented');
  }
});

test('bowed-string exam-inspired figures stay connected and expression preserves their note path',()=>{
  const {addPerformanceMarks}=loadModule('src/music/performanceMarks.ts');
  for(const [instrumentProfile,range] of [['Erhu',{min:62,max:86}],['Gaohu',{min:67,max:93}],['Zhonghu',{min:55,max:74}]])
    for(const difficulty of ['beginner','intermediate','advanced'])for(const timeSignature of ['2/4','4/4','6/8']) {
      const options={...base,instrumentProfile,range,difficulty,timeSignature,scaleId:'major-pentatonic',tonic:'D',rhythmFocus:['sixteenths','dotted']};
      const raw=generatePracticeExercise(options),pitches=buildPitchMaterial(raw.tonality,range).pitches;
      const plan=planStudyMelody(raw.measures,pitches,pitchClass(raw.tonality.tonic),difficulty,instrumentProfile);
      if(difficulty!=='advanced')assert.ok(plan.phrases.every(phrase=>['scale','turn','thirds'].includes(phrase.figure)));
      const exercise=composeExercise(options),marked=addPerformanceMarks(exercise);
      validateGeneratedExercise(marked,range,false);
      assert.deepEqual(notesOf(marked).map(n=>n.midi),notesOf(exercise).map(n=>n.midi));
      const rhythms=ex=>JSON.stringify(ex.measures.map(bar=>bar.events.map(n=>[n.startUnits,n.durationUnits,n.rest,n.tuplet])));
      assert.equal(rhythms(marked),rhythms(exercise));
      assert.ok(notesOf(marked).some(note=>note.duration==='16')&&notesOf(marked).some(note=>note.dots));
    }
});
