import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

const {selectRandomTonality,getTonalityChoices}=loadModule('src/music/randomTonality.ts');
const {describeTonality,buildPitchMaterial}=loadModule('src/music/scales.ts');
const {KEY_SIGNATURE_CHOICES,normalizeKeySignatureChoices}=loadModule('src/music/keySignatureChoices.ts');
const range={min:48,max:84};
const signatureOf=choice=>describeTonality(choice.tonic,choice.scaleId).signature??'open';

test('seven-sharp and six/seven-flat legacy engine spellings retain sounding octaves',()=>{
  const engine=loadModule('src/music.ts');
  const {midiFromKey}=loadModule('src/music/notePitches.ts');
  const encountered=new Set();
  for(const key of ['C#','Gb','Cb'])for(let i=0;i<12;i++) {
    const exercise=engine.generateExercise('Sheng','treble','advanced',key,'4/4','complex',4,90);
    for(const note of exercise.measures.flatMap(bar=>bar.events).filter(note=>!note.rest)) {
      assert.equal(midiFromKey(note.key),note.midi,note.key);
      if(note.key.startsWith('b#/')||note.key.startsWith('cb/'))encountered.add(note.key.split('/')[0]);
    }
  }
  assert.equal(encountered.size,2);
});

test('each of the 15 selected signatures works at beginner level without changing it to an easier key',()=>{
  for(const signature of KEY_SIGNATURE_CHOICES.filter(key=>key!=='open')) {
    const options={allowedKeySignatures:[signature],difficulty:'beginner',allowAccidentals:false};
    const choices=getTonalityChoices([range],options);
    assert.ok(choices.length>1,signature+' retains hidden mode variety');
    for(const scale of choices)for(const choice of scale.candidates)assert.equal(choice.signature,signature);
    for(const draw of [.01,.29,.62,.99])assert.equal(signatureOf(selectRandomTonality([range],()=>draw,options)),signature);
  }
});

test('selection chooses among explicit signatures equally before choosing a compatible mode',()=>{
  const allowedKeySignatures=['C','G','Bb','C#','Cb'];
  const seen=new Set(),modes=new Set();
  for(let i=0;i<100;i++) {
    let draw=0;
    const choice=selectRandomTonality([range],()=>draw++===0?(i+.5)/100:((i*37)%100+.5)/100,
      {allowedKeySignatures,difficulty:'beginner',allowAccidentals:false});
    assert.ok(allowedKeySignatures.includes(signatureOf(choice)));
    seen.add(signatureOf(choice));modes.add(choice.scaleId);
  }
  assert.equal(seen.size,5);
  assert.ok(modes.size>5,'still randomizes modes rather than forcing major tonics');
});

test('automatic, legacy, empty and all-selected pools preserve the existing seeded choices',()=>{
  for(let n=0;n<100;n++) {
    const random=()=>((n*73)%100+.5)/100;
    const expected=selectRandomTonality([range],random,{allowAccidentals:false});
    for(const allowedKeySignatures of [undefined,[],[...KEY_SIGNATURE_CHOICES]]) {
      const actual=selectRandomTonality([range],random,{allowAccidentals:false,allowedKeySignatures});
      assert.deepEqual(actual,expected);
    }
  }
  assert.equal(normalizeKeySignatureChoices([]),undefined);
});

test('open-key option preserves non-tonal practice; ordinary signatures never include atonal studies',()=>{
  const open=getTonalityChoices([range],{allowedKeySignatures:['open']});
  assert.ok(open.some(scale=>scale.scaleId==='atonal'));
  assert.ok(open.every(scale=>scale.candidates.every(candidate=>candidate.signature===null)));
  assert.ok(!getTonalityChoices([range],{allowedKeySignatures:['C']}).some(scale=>scale.scaleId==='atonal'));
});

test('narrow ranges never silently escape the selected signatures',()=>{
  // C#4 cannot be supplied by a C-signature mode in this catalog.
  assert.throws(()=>selectRandomTonality([{min:61,max:61}],()=>.5,{allowedKeySignatures:['C'],allowAccidentals:false}),/音域/);
  const ranges=[{min:58,max:61},{min:58,max:59},{min:60,max:61}];
  for(let i=0;i<20;i++) {
    const selected=selectRandomTonality(ranges,()=>i/20,{allowedKeySignatures:['G','F','Gb']});
    assert.ok(['G','F','Gb'].includes(signatureOf(selected)));
    assert.ok(ranges.every(r=>buildPitchMaterial(describeTonality(selected.tonic,selected.scaleId),r).pitches.length));
  }
});

test('generated study, quick edits, saved settings and restored studies retain the requested signature pool',()=>{
  const state=[];let cursor=0;
  const react={useState(initial){const index=cursor++;if(!(index in state))state[index]=typeof initial==='function'?initial():initial;return[state[index],next=>{state[index]=typeof next==='function'?next(state[index]):next;}];}};
  const hook=loadModule('src/hooks/useExercise.ts',631,undefined,{react},{window:{matchMedia:()=>({matches:false})}});
  const render=()=>{cursor=0;return hook.useExercise();};
  const {validSettings,validStudy}=loadModule('src/practice/library.ts');
  assert.ok(validSettings(hook.DEFAULT_SETTINGS),'legacy settings remain valid');
  assert.equal(validSettings({...hook.DEFAULT_SETTINGS,allowedKeySignatures:['not-a-key']}),false);
  render().change('instrument','Piano');
  render().change('allowedKeySignatures',['C#','Gb','Cb']);
  const seen=new Set();
  for(let i=0;i<24;i++) {
    assert.equal(typeof render().generateNew(80),'number');
    const {exercise,settings}=render().current;
    seen.add(exercise.tonality.signature);
    assert.ok(['C#','Gb','Cb'].includes(exercise.tonality.signature));
    assert.equal(exercise.keySignature,exercise.tonality.signature);
    assert.equal(settings.keySignature,exercise.tonality.signature);
    assert.ok(validSettings(settings));assert.ok(validStudy({id:'keys-'+i,created:1,bpm:exercise.tempo,settings,exercise},true));
    assert.deepEqual(Array.from(settings.allowedKeySignatures),['C#','Gb','Cb']);
  }
  assert.equal(seen.size,3);
  const saved=render().current;
  render().restore(saved.exercise,JSON.parse(JSON.stringify(saved.settings)));
  assert.deepEqual(Array.from(render().settings.allowedKeySignatures),['C#','Gb','Cb']);
  assert.equal(typeof render().generateFrom({...render().current.settings,allowedKeySignatures:['D'],pitchFocus:'scales'},80),'number');
  assert.equal(render().current.exercise.tonality.signature,'D');
});
