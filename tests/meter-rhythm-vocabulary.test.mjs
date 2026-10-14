import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

const levels=['simple','medium','complex'];
const meters=['3/8','6/8','9/8','12/8'];
const plain=value=>JSON.parse(JSON.stringify(value));

test('entering a new triple grouping establishes sounded three-part vocabulary at every rhythm level',()=>{
  const {createPhraseRhythmPlan}=loadModule('src/music/phraseRhythm.ts',32718);
  for(const meter of meters)for(const level of levels)for(let sample=0;sample<40;sample++) {
    const plan=createPhraseRhythmPlan(['4/4','4/4',meter,meter,'3/4','3/4',meter,meter],level);
    for(const index of [2,6]) {
      const bar=plan[index],entry=bar.notes.filter(note=>note.startUnits<6);
      assert.equal(entry[0].rest,false,'the new meter has an audible arrival');
      assert.ok(entry.length>1,'establish its subdivisions before a whole-pulse hold');
      assert.ok(entry.every(note=>!note.tuplet && note.units!==3),'no competing duple/dotted division on the first pulse');
      assert.equal(entry.reduce((sum,note)=>sum+note.units,0),6);
      for(let start=0;start<Number(meter.split('/')[0])*2;start+=6)
        assert.equal(bar.notes.find(note=>note.startUnits===start)?.rest,false);
    }
    assert.ok(plan.flatMap(bar=>bar.notes).filter(note=>note.tuplet).length<=(level==='simple'?3:Infinity));
  }
});

test('launch, flowing and settling pulses have distinct long-short placement without flattening subdivision levels',()=>{
  const counts={};
  for(const role of ['launch','carry','answer','settle']) {
    const {createGroupComposition}=loadModule('src/music/practiceRhythm.ts',317);
    const stats={head:0,tail:0,holds:0,notes:0,subdivisions:0};
    for(let sample=0;sample<2000;sample++) {
      const cell=createGroupComposition(6,'simple',true,false,role);
      stats.head+=Number(cell[0].units>=4);
      stats.tail+=Number(cell.at(-1).units>=4);
      stats.holds+=Number(cell.length===1);
      stats.notes+=cell.length;
      stats.subdivisions+=cell.filter(note=>note.units===1).length;
    }
    assert.ok(stats.subdivisions/stats.notes>.15 && stats.subdivisions/stats.notes<.30);
    counts[role]=stats;
  }
  assert.ok(counts.launch.head>counts.launch.tail*1.4,'launches establish the pulse before moving');
  assert.ok(counts.answer.tail>counts.answer.head*1.1,'answers move toward a longer landing');
  assert.ok(counts.settle.tail>counts.carry.tail*4,'settling and flowing pulses are different gestures');
  assert.ok(counts.carry.holds<counts.settle.holds/4,'flow keeps the eighth-note motion alive');
});

test('complete mixed-meter phrases preserve time, level separation, and multiple selected skills',()=>{
  const {selectPhraseRhythmPlan}=loadModule('src/music/phraseRhythm.ts',88239);
  const layout=['4/4','4/4','3/8','3/8','3/8','6/8','6/8','9/8','9/8','12/8','12/8'];
  const totals=[];
  for(const level of levels) {
    let count=0,subdivisions=0;
    for(let sample=0;sample<60;sample++) {
      const plan=selectPhraseRhythmPlan(layout,level);
      for(const bar of plan) {
        const [top,bottom]=bar.meter.split('/').map(Number),end=top*(bottom===8?2:4);
        assert.equal(Math.round(bar.notes.reduce((sum,note)=>sum+note.units,0)*12),end*12);
        if(bottom===8)for(const note of bar.notes) {
          assert.ok(Math.floor(note.startUnits/6)===Math.floor((note.startUnits+note.units-1e-6)/6));
          if(!note.rest) {count++;subdivisions+=Number(note.units===1);}
        }
      }
      assert.equal(plan.at(-1).notes.at(-1).rest,false);
    }
    totals.push(subdivisions/count);
  }
  assert.ok(totals[0]<.30 && totals[1]>totals[0]+.08 && totals[2]>totals[1]+.15,totals.join(','));
  const focused=selectPhraseRhythmPlan(layout,'complex',['sixteenths','dotted','triplets']);
  assert.ok(focused.some(bar=>bar.meter.endsWith('/4')&&bar.notes.some(note=>note.tuplet===3)));
  for(const meter of meters) {
    const notes=focused.filter(bar=>bar.meter===meter).flatMap(bar=>bar.notes);
    assert.ok(notes.some(note=>note.units===1),meter+' keeps the selected sixteenths');
    assert.ok(notes.some(note=>note.units===3),meter+' keeps the selected dotted practice');
    assert.ok(notes.every(note=>!note.tuplet),'ordinary /8 subdivisions are not printed as triplets');
  }
});

test('three-eighth bars keep their opening audible without turning the meter into compound time',()=>{
  const {createPhraseRhythmPlan}=loadModule('src/music/phraseRhythm.ts',7449);
  const {TIME_SIGNATURES}=loadModule('src/music.ts');
  assert.equal(TIME_SIGNATURES['3/8'].compound,false);
  assert.deepEqual(plain(TIME_SIGNATURES['3/8'].groups),[6]);
  for(const level of levels) {
    const plan=createPhraseRhythmPlan(Array(24).fill('3/8'),level);
    assert.ok(plan.every(bar=>bar.notes[0].rest===false));
    assert.ok(new Set(plan.map(bar=>bar.notes.map(note=>note.units).join(','))).size>=3);
    assert.deepEqual(plain(plan.at(-1).notes.map(note=>note.units)),[2,4]);
  }
});
