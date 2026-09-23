import test from 'node:test';
import assert from 'node:assert/strict';
import { loadModule } from './helpers.mjs';

const scales=loadModule('src/music/scales.ts');
const base={instrument:'Sheng',clef:'treble',difficulty:'beginner',keySignature:'C',timeSignature:'4/4',rhythmLevel:'medium',measures:4,tempo:72,range:{min:48,max:84},allowAccidentals:false,mixedMeters:false,meters:['3/4','4/4','6/8']};
function writtenMidi(note) {
  const [name,octave]=note.key.split('/');
  return (Number(octave)+1)*12+{c:0,d:2,e:4,f:5,g:7,a:9,b:11}[name[0]]+[...name.slice(1)].reduce((sum,c)=>sum+(c==='#'?1:-1),0);
}

test('textbook spellings, modal signatures and Japanese named forms are explicit',()=>{
  const expected=[
    ['A','natural-minor',['A','B','C','D','E','F','G'],'C'],
    ['A','harmonic-minor',['A','B','C','D','E','F','G#'],'C'],
    ['A','melodic-minor',['A','B','C','D','E','F#','G#'],'C'],
    ['D','dorian',['D','E','F','G','A','B','C'],'C'],
    ['C','dorian',['C','D','Eb','F','G','A','Bb'],'Bb'],
    ['C','egyptian-pentatonic',['C','D','F','G','Bb'],'Bb'],
    ['D','egyptian-pentatonic',['D','E','G','A','C'],'C'],
    ['F#','egyptian-pentatonic',['F#','G#','B','C#','E'],'E'],
    ['C#','major',['C#','D#','E#','F#','G#','A#','B#'],'C#'],
    ['Cb','major',['Cb','Db','Eb','Fb','Gb','Ab','Bb'],'Cb'],
    ['C','hirajoshi',['C','D','Eb','G','Ab'],null],
    ['C','in',['C','Db','F','G','Ab'],null],
    ['C','insen',['C','Db','F','G','Bb'],null],
    ['C','iwato',['C','Db','F','Gb','Bb'],null],
    ['C','yo',['C','D','F','G','A'],null],
    ['C','kumoi',['C','D','Eb','G','A'],null],
    ['C','ryukyu',['C','E','F','G','B'],null],
  ];
  for(const [tonic,id,notes,signature] of expected) {
    const actual=scales.describeTonality(tonic,id);
    assert.equal(JSON.stringify(actual.notes),JSON.stringify(notes),`${tonic} ${id}`);
    assert.equal(actual.signature,signature);
  }
});

test('Southeast Asian practice approximations have explicit spellings and no Western key signature',()=>{
  const expected=[
    ['C','pelog-pentatonic',['C','Db','Eb','G','Ab']],
    ['D','pelog-pentatonic',['D','Eb','F','A','Bb']],
    ['F#','pelog-pentatonic',['F#','G','A','C#','D']],
    ['C','slendro-pentatonic',['C','D','F','G','Bb']],
    ['D','slendro-pentatonic',['D','E','G','A','C']],
    ['F#','slendro-pentatonic',['F#','G#','B','C#','E']],
  ];
  for(const [tonic,id,notes] of expected) {
    const actual=scales.describeTonality(tonic,id);
    assert.deepEqual(Array.from(actual.notes),notes);
    assert.equal(actual.signature,null);
    assert.match(scales.getScale(id).description,/近似|取整/);
  }
});

test('all scale transpositions retain correct written octaves, pitch sets, range and leap limits',()=>{
  const engine=loadModule('src/music.ts',2187);
  for(const scale of scales.SCALES) for(const tonic of scales.TONICS) {
    const exercise=engine.generatePracticeExercise({...base,scaleId:scale.id,tonic});
    const material=scales.buildPitchMaterial(exercise.tonality,base.range);
    let previous;
    for(const note of exercise.measures.flatMap(m=>m.events).filter(n=>!n.rest)) {
      assert.equal(writtenMidi(note),note.midi,`${tonic} ${scale.id}: ${note.key}`);
      assert.ok(material.pitchClasses.includes(note.midi%12));
      assert.ok(note.midi>=base.range.min&&note.midi<=base.range.max);
      if(previous!==undefined) assert.ok(Math.abs(previous-note.midi)<=7);
      previous=note.midi;
    }
    for(const pitch of scales.buildPitchMaterial(exercise.tonality,{min:24,max:108}).pitches) {
      assert.equal(writtenMidi({key: `${pitch.key.toLowerCase()}/${pitch.octave}`}),pitch.midi);
    }
  }
});

test('tonal exercises begin on tonic and close there when range and leap permit',()=>{
  const engine=loadModule('src/music.ts',551);
  for(const id of ['major','dorian','natural-minor','hirajoshi','minor-pentatonic']) {
    const exercise=engine.generatePracticeExercise({...base,scaleId:id,tonic:'D',range:{min:60,max:74}});
    const notes=exercise.measures.flatMap(m=>m.events).filter(n=>!n.rest);
    assert.equal(notes[0].midi%12,2);
    assert.equal(notes.at(-1).midi%12,2);
  }
});

test('atonal ignores tonic selection and includes all twelve pitch classes without a key signature',()=>{
  const a=loadModule('src/music.ts',721).generatePracticeExercise({...base,scaleId:'atonal',tonic:'C',allowAccidentals:false,measures:16});
  const b=loadModule('src/music.ts',721).generatePracticeExercise({...base,scaleId:'atonal',tonic:'Gb',allowAccidentals:true,measures:16});
  assert.equal(JSON.stringify(a),JSON.stringify(b));
  assert.equal(a.tonality.signature,null);
  assert.equal(a.tonality.tonic,null);
  const classes=new Set(a.measures.flatMap(m=>m.events).filter(n=>!n.rest).map(n=>n.midi%12));
  assert.equal(classes.size,12);
});

test('additional chromatic option allows scale outsiders; a narrow empty scale range fails clearly',()=>{
  const engine=loadModule('src/music.ts',992);
  const exercise=engine.generatePracticeExercise({...base,scaleId:'major-pentatonic',tonic:'C',allowAccidentals:true,measures:16});
  assert.ok(exercise.measures.flatMap(m=>m.events).some(n=>!n.rest&&![0,2,4,7,9].includes(n.midi%12)));
  assert.throws(()=>engine.generatePracticeExercise({...base,scaleId:'major-pentatonic',tonic:'C',range:{min:65,max:66}}));
});
