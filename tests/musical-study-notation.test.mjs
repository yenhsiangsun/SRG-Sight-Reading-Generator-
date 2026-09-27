import test from 'node:test';
import assert from 'node:assert/strict';
import * as VF from 'vexflow';
import {loadModule} from './helpers.mjs';

globalThis.document={createElement:()=>({style:{fontFamily:'Bravura',fontSize:'30px',fontWeight:'normal',fontStyle:'normal',
  set font(value){const match=value.match(/([\d.]+(?:px|pt))\s+(.+)$/);if(match){this.fontSize=match[1];this.fontFamily=match[2];}}}})};
VF.Element.setTextMeasurementCanvas({getContext:()=>({measureText:text=>({width:text.length*8,actualBoundingBoxLeft:0,
  actualBoundingBoxRight:text.length*8,actualBoundingBoxAscent:12,actualBoundingBoxDescent:3,fontBoundingBoxAscent:12,fontBoundingBoxDescent:3})})});
const {composeExercise}=loadModule('src/music/composeExercise.ts',5918);
const {addPerformanceMarks}=loadModule('src/music/performanceMarks.ts');
const {addInstrumentHarmony}=loadModule('src/music/instrumentHarmony.ts');
const {createMeasureNotation}=loadModule('src/notation/createMeasureNotation.ts',1,undefined,{'vexflow':VF});
const {planMixedStaff}=loadModule('src/notation/mixedStaff.ts');
const {planOctaveLines}=loadModule('src/notation/octaveLines.ts');
const {TIME_SIGNATURES}=loadModule('src/music.ts');

test('the complete musical-study pipeline retains strict engraved voices with harmony, marks and staff changes',()=>{
  for(const [instrumentProfile,grandMode,range] of [['Erhu',undefined,{min:62,max:86}],['Zhonghu',undefined,{min:55,max:74}],
    ['Pipa',undefined,{min:45,max:88}],['Piano','two-hand',{min:21,max:108}]])
    for(const timeSignature of Object.keys(TIME_SIGNATURES))for(const scaleId of ['major','harmonic-minor','pelog-pentatonic']) {
      const raw=composeExercise({instrument:instrumentProfile==='Piano'?'Piano':'Sheng',instrumentProfile,range,clef:'treble',
        difficulty:'advanced',keySignature:'C',tonic:'F#',scaleId,timeSignature,rhythmLevel:'complex',measures:4,tempo:80,
        allowAccidentals:false,mixedMeters:false,meters:['4/4','6/8'],rhythmFocus:['sixteenths','dotted']},grandMode);
      raw.soundProfile=instrumentProfile;
      const exercise=addPerformanceMarks(addInstrumentHarmony(raw,range));
      for(const [clef,measures] of [['treble',exercise.measures],['bass',exercise.lowerMeasures??[]]]) {
        const mixed=instrumentProfile==='Pipa'?planMixedStaff(measures,clef).clefs:undefined;
        const octaves=planOctaveLines(measures,clef);
        measures.forEach((bar,b)=>{
          const notation=createMeasureNotation(bar,mixed?.[b][0]??clef,exercise.tonality.signature??'C',timeSignature,mixed?[]:octaves[b],mixed?.[b]);
          assert.ok(notation.voice.isComplete(),`${instrumentProfile} ${scaleId} ${timeSignature}`);
          bar.events.forEach((note,n)=>{
            assert.equal(notation.notes[n].getTicks().value(),VF.VexFlow.RESOLUTION*note.durationUnits/16);
            assert.equal(notation.notes[n].getKeys().length,note.chord?.length??1);
          });
          assert.doesNotThrow(()=>new VF.Formatter().joinVoices([notation.voice]).preCalculateMinTotalWidth([notation.voice]));
        });
      }
    }
});
