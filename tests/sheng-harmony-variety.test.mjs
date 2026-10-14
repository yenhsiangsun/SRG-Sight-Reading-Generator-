import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

const {addInstrumentHarmony}=loadModule('src/music/instrumentHarmony.ts');
const {SHENG_HARMONY_PROFILES,isShengPracticeVoicing}=loadModule('src/music/shengFingering.ts');
const {describeTonality}=loadModule('src/music/scales.ts');
const randomFrom=initial=>{
  let seed=initial;
  return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
};
const pitches=['c','c#','d','eb','e','f','f#','g','ab','a','bb','b'];
const note=(midi,startUnits)=>({midi,key:`${pitches[midi%12]}/${Math.floor(midi/12)-1}`,octave:Math.floor(midi/12)-1,
  rest:false,duration:'q',dots:0,durationUnits:4,startUnits});
const chordKey=chord=>chord.map(p=>p.midi).join(',');
const shape=chord=>chord.map(p=>p.midi-chord[0].midi).join(',');
function fixture(instrument,difficulty='intermediate') {
  // Repeated melody deliberately isolates the harmony choices: variety must
  // not come from changing the user's tune, key, rhythm or instrument range.
  return {instrument:'Sheng',soundProfile:instrument,clef:'treble',difficulty,
    keySignature:'C',tonality:describeTonality('C','major'),timeSignature:'4/4',rhythmLevel:'simple',tempo:72,
    harmonyPlan:Array.from({length:16},()=>({root:0,pitches:[0,4,7],role:'home'})),
    measures:Array.from({length:16},()=>({timeSignature:'4/4',totalUnits:16,groups:[4,4,4,4],beamGroups:[4,4,4,4],
      events:[0,4,8,12].map(start=>note(60,start))}))};
}
const chords=exercise=>exercise.measures.flatMap(bar=>bar.events.filter(note=>note.chord).map(note=>note.chord));

test('all sheng models vary inversions and spacing even over a repeated tune and harmonic centre',()=>{
  for(const [instrument,{min,max}] of Object.entries(SHENG_HARMONY_PROFILES)) {
    const shapes=new Set(),spans=new Set();
    for(let seed=1;seed<=12;seed++) {
      const source=fixture(instrument),before=JSON.stringify(source);
      const generated=addInstrumentHarmony(source,{min,max},randomFrom(seed*773));
      const voiced=chords(generated),counts=new Map();
      assert.equal(JSON.stringify(source),before);
      assert.equal(JSON.stringify(generated,(key,value)=>key==='chord'?undefined:value),before);
      for(const chord of voiced) {
        const key=chordKey(chord);
        counts.set(key,(counts.get(key)??0)+1);shapes.add(shape(chord));
        spans.add(chord.at(-1).midi-chord[0].midi);
        assert.ok(chord.some(p=>p.midi===60),'the melody stays in every voicing');
        assert.ok(chord.every(p=>[0,4,7].includes(p.midi%12)),'use the planned harmony');
        assert.ok(isShengPracticeVoicing(chord.map(p=>p.midi),instrument));
      }
      assert.ok(counts.size>=4,`${instrument}, seed ${seed}: only ${counts.size} voicings`);
      assert.ok(Math.max(...counts.values())<=Math.ceil(voiced.length/2),`${instrument}: one voicing dominates`);
    }
    assert.ok(shapes.size>=7,`${instrument}: ${shapes.size} interval shapes`);
    assert.ok(spans.has(7)&&spans.has(12),`${instrument}: include open fifths and octaves`);
    assert.ok(spans.has(8)||spans.has(9),`${instrument}: include sixths/inversions`);
  }
});

test('advanced sheng passages vary their chord movement rather than repeating a held voicing',()=>{
  for(const [instrument,{min,max}] of Object.entries(SHENG_HARMONY_PROFILES)) {
    const movements=new Set();let total=0,unchanged=0;
    for(let seed=1;seed<=32;seed++) {
      const generated=addInstrumentHarmony(fixture(instrument,'advanced'),{min,max},randomFrom(seed*997));
      const line=generated.measures.flatMap(bar=>bar.events);
      for(let i=1;i<line.length;i++)if(line[i-1].chord&&line[i].chord) {
        const previous=line[i-1].chord,next=line[i].chord;
        assert.ok(previous.length<=3&&next.length<=3);
        assert.ok(isShengPracticeVoicing(next.map(p=>p.midi),instrument));
        total++;if(chordKey(previous)===chordKey(next))unchanged++;
        movements.add(`${shape(previous)}>${shape(next)}`);
      }
    }
    assert.ok(total>=10,`${instrument}: expected occasional passages`);
    assert.ok(movements.size>=8,`${instrument}: only ${movements.size} passage movements`);
    assert.ok(unchanged/total<.3,`${instrument}: ${unchanged}/${total} chord changes are exact repeats`);
  }
});
