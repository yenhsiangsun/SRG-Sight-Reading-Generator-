import test from 'node:test';
import assert from 'node:assert/strict';
import * as VF from 'vexflow';
import {loadModule} from './helpers.mjs';

globalThis.document={createElement:()=>({style:{fontFamily:'Bravura',fontSize:'30px',fontWeight:'normal',fontStyle:'normal',
  set font(value){const match=value.match(/([\d.]+(?:px|pt))\s+(.+)$/);if(match){this.fontSize=match[1];this.fontFamily=match[2];}},
}})};
VF.Element.setTextMeasurementCanvas({getContext:()=>({measureText:text=>({width:text.length*8,actualBoundingBoxLeft:0,actualBoundingBoxRight:text.length*8,actualBoundingBoxAscent:12,actualBoundingBoxDescent:3,fontBoundingBoxAscent:12,fontBoundingBoxDescent:3})})});
const {simplifyStaffRests}=loadModule('src/notation/simplifyStaffRests.ts');
const {TIME_SIGNATURES}=loadModule('src/music.ts');
const {createMeasureNotation}=loadModule('src/notation/createMeasureNotation.ts',1,undefined,{vexflow:VF});
const {prepareGrandMeasure}=loadModule('src/notation/drawGrandScore.ts',1,undefined,{vexflow:VF});
const {collectMeasureAnchors,collectNoteGeometry}=loadModule('src/notation/scoreGeometry.ts',1,undefined,{vexflow:VF});
const {createPlaybackEvents}=loadModule('src/audio/PlaybackController.ts');
const plain=value=>JSON.parse(JSON.stringify(value));

function measure(meter,start,end){
  const info=TIME_SIGNATURES[meter];
  return {timeSignature:meter,totalUnits:info.units,groups:info.groups,beamGroups:info.groups,
    events:Array.from({length:info.units},(_,at)=>({key:'c/4',octave:4,midi:60,rest:at>=start&&at<end,
      duration:'16',dots:0,startUnits:at,durationUnits:1})),
  };
}
const rests=bar=>Array.from(bar.events.filter(n=>n.rest),n=>[n.startUnits,n.durationUnits]);

test('compound rest spelling is identical at every big beat, including the second beat',()=>{
  for(const meter of ['6/8','9/8','12/8']){
    for(let beat=0;beat<TIME_SIGNATURES[meter].units;beat+=6){
      assert.deepEqual(rests(simplifyStaffRests(measure(meter,beat,beat+4),meter)),[[beat,4]],meter);
      assert.deepEqual(rests(simplifyStaffRests(measure(meter,beat+2,beat+6),meter)),[[beat+2,2],[beat+4,2]],meter);
      assert.deepEqual(rests(simplifyStaffRests(measure(meter,beat,beat+6),meter)),[[beat,6]],meter);
    }
  }
  assert.deepEqual(rests(simplifyStaffRests(measure('7/8',8,12),'7/8')),[[8,4]]);
  assert.deepEqual(rests(simplifyStaffRests(measure('7/8',10,14),'7/8')),[[10,2],[12,2]]);
});

test('short rests use a dotted eighth at beat openings and preserve offbeat and half-bar boundaries',()=>{
  assert.deepEqual(rests(simplifyStaffRests(measure('4/4',0,3),'4/4')),[[0,3]]);
  assert.deepEqual(rests(simplifyStaffRests(measure('4/4',1,4),'4/4')),[[1,1],[2,2]]);
  assert.deepEqual(rests(simplifyStaffRests(measure('4/4',2,16),'4/4')),[[2,2],[4,4],[8,8]]);
  assert.deepEqual(rests(simplifyStaffRests(measure('6/8',4,10),'6/8')),[[4,2],[6,4]]);
  assert.deepEqual(rests(simplifyStaffRests(measure('7/8',2,10),'7/8')),[[2,2],[4,4],[8,2]]);
});

test('eighth rest plus sixteenth rest before a sixteenth note becomes one dotted eighth rest',()=>{
  for(const meter of ['2/4','3/4','4/4','5/4'])for(let beat=0;beat<TIME_SIGNATURES[meter].units;beat+=4){
    const original=measure(meter,beat,beat+3);
    // Match the user's exact input: 8th rest + 16th rest + 16th note.
    original.events.splice(beat,2,{...original.events[beat],duration:'8',durationUnits:2});
    const spelled=simplifyStaffRests(original,meter);
    assert.deepEqual(rests(spelled),[[beat,3]],`${meter}, beat ${beat/4+1}`);
    const index=spelled.events.findIndex(note=>note.rest);
    assert.equal(spelled.events[index].duration,'8');
    assert.equal(spelled.events[index].dots,1);
    assert.equal(spelled.events[index+1].startUnits,beat+3);
    assert.equal(spelled.events[index+1].rest,false);
    for(const clef of ['treble','bass','alto','tenor']){
      const notation=createMeasureNotation(spelled,clef,'C',meter);
      assert.ok(notation.voice.isComplete());
      assert.equal(notation.notes[index].getTicks().value(),VF.VexFlow.RESOLUTION*3/16);
      assert.equal(notation.notes[index].getModifiers().filter(modifier=>modifier.getCategory()===VF.Dot.CATEGORY).length,1);
      assert.ok(!notation.notes[index+1].hasBeam(),'the isolated final sixteenth keeps its flag');
    }
    const exercise={instrument:'Piano',clef:'treble',keySignature:'C',timeSignature:meter,measures:[original]};
    assert.deepEqual(plain(createPlaybackEvents({...exercise,measures:[spelled]},72)),plain(createPlaybackEvents(exercise,72)));
    const grand=prepareGrandMeasure(original,original,'C',meter,true);
    assert.equal(grand.right.notes[index].getTicks().value(),VF.VexFlow.RESOLUTION*3/16);
    assert.equal(grand.left.notes[index].getTicks().value(),VF.VexFlow.RESOLUTION*3/16);
  }
});

test('dotted eighth rests stay inside quarter beats and never merge across a beat or barline',()=>{
  for(const [meter,start,end,expected] of [
    ['4/4',1,4,[[1,1],[2,2]]],
    ['4/4',2,5,[[2,2],[4,1]]],
    ['4/4',3,6,[[3,1],[4,2]]],
    ['4/4',12,15,[[12,3]]],
    ['7/8',4,7,[[4,3]]],
    ['7/8',8,11,[[8,2],[10,1]]],
    ['6/8',6,9,[[6,2],[8,1]]],
  ])assert.deepEqual(rests(simplifyStaffRests(measure(meter,start,end),meter)),expected);
});

test('every rest interval retains exact silence, sounded notes and strict meter without mutating the source',()=>{
  for(const meter of Object.keys(TIME_SIGNATURES)){
    const total=TIME_SIGNATURES[meter].units;
    for(let start=0;start<total;start++)for(let end=start+1;end<=total;end++){
      const source=measure(meter,start,end),snapshot=plain(source);
      const result=simplifyStaffRests(source,meter);
      assert.deepEqual(plain(source),snapshot);
      assert.deepEqual(plain(result.events.filter(n=>!n.rest)),plain(source.events.filter(n=>!n.rest)));
      assert.equal(result.events.filter(n=>n.rest).reduce((sum,n)=>sum+n.durationUnits,0),end-start);
      assert.ok(result.events.filter(n=>n.rest).every(n=>n.startUnits>=start&&n.startUnits+n.durationUnits<=end));
      assert.ok(createMeasureNotation(result,'treble','C',meter).voice.isComplete(),`${meter}: ${start}–${end}`);
      assert.deepEqual(plain(simplifyStaffRests(result,meter)),plain(result),'normalization is idempotent');
    }
  }
});

test('rest spelling preserves mixed-meter playback and grand-staff seek anchors after consolidation',()=>{
  const original={instrument:'Piano',clef:'treble',keySignature:'C',timeSignature:'4/4',tempo:72,
    measures:[measure('4/4',2,16),measure('6/8',6,10),measure('7/8',10,14)]};
  const spelled={...original,measures:original.measures.map(bar=>simplifyStaffRests(bar,bar.timeSignature))};
  assert.deepEqual(plain(createPlaybackEvents(spelled,72)),plain(createPlaybackEvents(original,72)));
  const upper=measure('6/8',6,10),lower=measure('6/8',0,12);
  const prepared=prepareGrandMeasure(upper,lower,'C','6/8',true);
  const staves=[new VF.Stave(0,0,1200),new VF.Stave(0,180,1200)];
  prepared.right.voice.setStave(staves[0]);prepared.left.voice.setStave(staves[1]);
  prepared.formatter.format(prepared.voices,1000);
  const anchors=collectMeasureAnchors([prepared.right.notes,prepared.left.notes],12,0,1200);
  assert.deepEqual(Array.from(anchors,n=>n.units),[0,1,2,3,4,5,6,10,11,12]);
  assert.ok(prepared.voices.every(voice=>voice.isComplete()));
  assert.equal(prepared.left.notes.length,1);
  prepared.right.notes.forEach(note=>note.setStave(staves[0]));
  const feedback=collectNoteGeometry(prepared.right.notes,2,0);
  assert.ok(feedback.length>0);
  assert.equal(feedback[0].units,0);
  assert.equal(feedback.at(-1).units,11);
  assert.ok(feedback.every(n=>Number.isFinite(n.x)&&Number.isFinite(n.y)&&n.measure===2&&n.staff===0));
  assert.equal(collectNoteGeometry(prepared.left.notes,2,1).length,0);
});
