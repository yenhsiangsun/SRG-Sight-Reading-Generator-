import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';
const {rangeMidiAtY,rangeNotePosition,rangeStaffBottom,rangeOctaveShift}=loadModule('src/notation/rangeSelection.ts');
test('staff positions round-trip natural pitches in every clef and octave displacement',()=>{
  for(const clef of ['treble','bass','alto','tenor'])for(const shift of [-1,0,1])for(let midi=21;midi<=108;midi++){
    const note=rangeNotePosition(midi);if(note.sharp)continue;
    const y=150-(note.octave*7+note.degree-shift*7-rangeStaffBottom[clef])*5;
    assert.equal(rangeMidiAtY(y,150,clef,shift,21,108),midi);
  }
});
test('8va begins above the fourth upper ledger line, preserving its line and accidentals',()=>{
  for(const clef of ['treble','bass','alto','tenor']) {
    for(const distance of [14,15,16,17,18]) {
      const position=rangeStaffBottom[clef]+distance;
      const midi=(Math.floor(position/7)+1)*12+[0,2,4,5,7,9,11][position%7];
      assert.equal(rangeOctaveShift(midi,clef),distance>16?1:0,`${clef} at ${distance}`);
    }
  }
  assert.equal(rangeOctaveShift(91,'treble'),0,'G6 sits on the fourth upper ledger line');
  assert.equal(rangeOctaveShift(92,'treble'),0,'G sharp 6 occupies that same line');
  assert.equal(rangeOctaveShift(93,'treble'),1,'A6 is above the fourth upper ledger line');
  assert.equal(rangeOctaveShift(53,'treble'),0,'lower ledger threshold is unchanged');
  assert.equal(rangeOctaveShift(52,'treble'),-1);
});
test('staff selection respects the opposite endpoint and global pitch bounds',()=>{
  assert.equal(rangeMidiAtY(-1000,150,'treble',0,21,71),71);
  assert.equal(rangeMidiAtY(1000,150,'bass',0,61,108),61);
  assert.equal(rangeMidiAtY(150,150,'treble',0,21,108),64);
  assert.equal(rangeMidiAtY(150,150,'bass',0,21,108),43);
  assert.equal(rangeNotePosition(61).sharp,true);
});
