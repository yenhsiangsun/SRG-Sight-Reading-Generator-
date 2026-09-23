import test from 'node:test';
import assert from 'node:assert/strict';
import { loadModule } from './helpers.mjs';
import * as VF from 'vexflow';

// Font parsing only; no DOM layout is simulated or asserted.
globalThis.document = { createElement: () => ({ style: {
  fontFamily: 'Bravura', fontSize: '30px', fontWeight: 'normal', fontStyle: 'normal',
  set font(value) { const match=value.match(/([\d.]+(?:px|pt))\s+(.+)$/); if(match){this.fontSize=match[1];this.fontFamily=match[2];} },
} }) };
// Only musical ticks/modifiers/beams are tested here; approximate metrics are not visual QA.
VF.Element.setTextMeasurementCanvas({getContext:()=>({measureText:text=>({width:text.length*8,actualBoundingBoxLeft:0,actualBoundingBoxRight:text.length*8,actualBoundingBoxAscent:12,actualBoundingBoxDescent:3,fontBoundingBoxAscent:12,fontBoundingBoxDescent:3})})});
const engine=loadModule('src/music.ts',812);
const {createMeasureNotation}=loadModule('src/notation/createMeasureNotation.ts',1,undefined,{'vexflow':VF});
const options={instrument:'Sheng',clef:'treble',difficulty:'advanced',keySignature:'C',timeSignature:'4/4',rhythmLevel:'complex',measures:8,tempo:72,range:{min:48,max:84},allowAccidentals:true,mixedMeters:true,meters:['3/4','4/4','6/8','7/8']};

test('chords are a single strict rhythmic event with every notehead and accidental present',()=>{
  const {midiFromKey}=loadModule('src/music/notePitches.ts');
  const chord=keys=>keys.map(key=>({key,octave:+key.split('/')[1],midi:midiFromKey(key)}));
  const measure=bar(['c#/4','c/4','c/4','c/4']);
  measure.events[0].chord=chord(['c#/4','e/4','g#/4']);
  measure.events[1].chord=chord(['c/4','e/4','g/4']);
  const notation=createMeasureNotation(measure,'treble','C','4/4');
  assert.equal(notation.voice.getTickables().length,4);
  assert.ok(notation.voice.isComplete());
  assert.deepEqual(notation.notes[0].getKeys(),['c#/4','e/4','g#/4']);
  assert.equal(notation.notes[0].getTicks().value(),VF.VexFlow.RESOLUTION/4);
  assert.equal(JSON.stringify(accidentals(notation.notes)),JSON.stringify([['#','#'],['n','n'],[],[]]));
});

test('pipa clefs follow register, stay constant through beams, and add no rhythmic time',()=>{
  const {planMixedStaff}=loadModule('src/notation/mixedStaff.ts');
  const measure=bar(['a/2','d/3','a/2','e/3','g/4','c/5','g/4','c/5'],2);
  measure.events.forEach(n=>{n.duration='8';});
  measure.groups=measure.beamGroups=[4,4,4,4];measure.timeSignature='4/4';
  const plan=planMixedStaff([measure],'treble').clefs;
  assert.equal(plan[0][0],'bass');assert.equal(plan[0].at(-1),'treble');
  const notation=createMeasureNotation(measure,plan[0][0],'G','4/4',[],plan[0]);
  assert.ok(notation.voice.isComplete());assert.equal(notation.voice.getTickables().length,8);
  assert.ok(notation.notes.some(n=>n.getModifiers().some(m=>m.getCategory()===VF.NoteSubGroup.CATEGORY)));
  for(const beam of notation.beams){
    const clefs=beam.getNotes().map(n=>plan[0][notation.notes.indexOf(n)]);
    assert.equal(new Set(clefs).size,1);
  }
  assert.doesNotThrow(()=>new VF.Formatter().joinVoices([notation.voice]).preCalculateMinTotalWidth([notation.voice]));
});

test('all generated instrument chords engrave in strict voices, including dotted durations and octave lines',()=>{
  const {addInstrumentHarmony}=loadModule('src/music/instrumentHarmony.ts');
  const {planOctaveLines}=loadModule('src/notation/octaveLines.ts');
  const {generateGrandExercise}=loadModule('src/music/grandStaff.ts');
  for(const instrument of ['Piano','Sheng','Pipa'])for(const meter of Object.keys(engine.TIME_SIGNATURES)){
    const range=instrument==='Piano'?{min:36,max:96}:instrument==='Pipa'?{min:45,max:88}:{min:55,max:90};
    const opts={...options,range,mixedMeters:false,timeSignature:meter,tonic:'F#',scaleId:'harmonic-minor'};
    const source=instrument==='Piano'?generateGrandExercise(opts):engine.generatePracticeExercise(opts);source.soundProfile=instrument;
    const ex=addInstrumentHarmony(source,range);
    for(const [clef,measures] of [['treble',ex.measures],['bass',ex.lowerMeasures??[]]]){
      const shifts=planOctaveLines(measures,clef);
      measures.forEach((measure,i)=>{
        const notation=createMeasureNotation(measure,clef,ex.tonality.signature??'C',meter,shifts[i]);
        assert.ok(notation.voice.isComplete());
        measure.events.forEach((event,n)=>assert.equal(notation.notes[n].getKeys().length,event.chord?.length??1));
      });
    }
  }
});

function bar(keys,units=4) {
  return {events:keys.map((key,i)=>({key,rest:false,duration:'q',dots:0,startUnits:i*units,durationUnits:units})),totalUnits:keys.length*units,groups:Array(keys.length).fill(units),beamGroups:Array(keys.length).fill(units)};
}

test('modal phrasing and instrument harmony retain strict notation through mixed meters and staff changes',()=>{
  const {addModalPhrasing}=loadModule('src/music/modalPhrasing.ts');
  const {addInstrumentHarmony}=loadModule('src/music/instrumentHarmony.ts');
  const {generateGrandExercise}=loadModule('src/music/grandStaff.ts');
  const {planOctaveLines}=loadModule('src/notation/octaveLines.ts');
  const {planMixedStaff}=loadModule('src/notation/mixedStaff.ts');
  for(const [instrument,mode,scaleId,range] of [
    ['Piano','two-hand','harmonic-minor',{min:21,max:108}],
    ['Yangqin','two-hand','pelog-pentatonic',{min:43,max:96}],
    ['Sheng','mono','dorian',{min:55,max:90}],
    ['Pipa','mixed','hirajoshi',{min:45,max:88}],
    ['Flute','single','whole-tone',{min:60,max:96}],
  ]){
    const opts={...options,instrument,range,allowAccidentals:false,tonic:'F#',scaleId};
    const source=['mono','two-hand'].includes(mode)?generateGrandExercise(opts,mode):engine.generatePracticeExercise(opts);
    source.soundProfile=instrument;
    const ex=addInstrumentHarmony(addModalPhrasing(source,range,false),range);
    for(const [clef,measures] of [['treble',ex.measures],['bass',ex.lowerMeasures??[]]]){
      const clefs=mode==='mixed'?planMixedStaff(measures,'treble').clefs:undefined;
      const shifts=planOctaveLines(measures,clef);
      measures.forEach((measure,b)=>{
        const notation=createMeasureNotation(measure,clefs?.[b][0]??clef,ex.tonality.signature??'C',measure.timeSignature,clefs?[]:shifts[b],clefs?.[b]);
        assert.ok(notation.voice.isComplete(),instrument);
        measure.events.forEach((event,n)=>assert.equal(notation.notes[n].getTicks().value(),VF.VexFlow.RESOLUTION*event.durationUnits/16));
        assert.doesNotThrow(()=>new VF.Formatter().joinVoices([notation.voice]).preCalculateMinTotalWidth([notation.voice]));
      });
    }
  }
});
function accidentals(notes) {return notes.map(note=>note.getModifiers().filter(m=>m.getCategory()===VF.Accidental.CATEGORY).map(m=>m.type));}

test('readable open-scale transpositions remove avoidable accidentals in actual VexFlow notation',()=>{
  const {getTonalityChoices}=loadModule('src/music/randomTonality.ts');
  const {addModalPhrasing}=loadModule('src/music/modalPhrasing.ts');
  const {addInstrumentHarmony}=loadModule('src/music/instrumentHarmony.ts');
  const choices=getTonalityChoices([options.range],{allowAccidentals:false,difficulty:'beginner'});
  const count=(scaleId,tonic)=>{
    const raw=engine.generatePracticeExercise({...options,scaleId,tonic,allowAccidentals:false});raw.soundProfile='Sheng';
    const ex=addInstrumentHarmony(addModalPhrasing(raw,options.range,false),options.range);
    return ex.measures.reduce((sum,measure)=>{
      const notation=createMeasureNotation(measure,'treble',ex.tonality.signature??'C',measure.timeSignature);
      assert.ok(notation.voice.isComplete());
      return sum+accidentals(notation.notes).flat().length;
    },0);
  };
  for(const scaleId of ['hirajoshi','pelog-pentatonic','insen']){
    const before=count(scaleId,'Ab');
    const after=count(scaleId,choices.find(s=>s.scaleId===scaleId).candidates[0].tonic);
    assert.ok(before>10,`${scaleId}: ${before}`);
    assert.equal(after,0,scaleId);
  }
});

test('focused studies retain strict VexFlow durations and bounded beams in every meter',()=>{
  for(const meter of Object.keys(engine.TIME_SIGNATURES))for(const focus of ['sixteenths','dotted']){
    const exercise=engine.generatePracticeExercise({...options,mixedMeters:false,timeSignature:meter,rhythmFocus:focus});
    for(const measure of exercise.measures){
      const notation=createMeasureNotation(measure,'treble','C',meter);
      assert.ok(notation.voice.isComplete());
      for(let i=0;i<measure.events.length;i++)assert.equal(notation.notes[i].getTicks().value(),VF.VexFlow.RESOLUTION*measure.events[i].durationUnits/16);
      for(const beam of notation.beams){
        const indexes=beam.getNotes().map(note=>notation.notes.indexOf(note));
        const first=measure.events[indexes[0]].startUnits,last=measure.events[indexes.at(-1)];
        let boundary=0;
        for(const group of measure.beamGroups??measure.groups){boundary+=group;assert.ok(!(first<boundary&&last.startUnits+last.durationUnits>boundary));}
      }
    }
  }
});

test('accidentals persist by octave within a bar and reset at the barline',()=>{
  const first=createMeasureNotation(bar(['f#/4','f#/4','f/4','f#/5']),'treble','C','4/4');
  assert.equal(JSON.stringify(accidentals(first.notes)),JSON.stringify([['#'],[],['n'],['#']]));
  const second=createMeasureNotation(bar(['f/4','f/4','f/4','f/4']),'treble','C','4/4');
  assert.equal(JSON.stringify(accidentals(second.notes)),JSON.stringify([[],[],[],[]]));
});

test('key signatures suppress redundant accidentals and restore altered notes correctly',()=>{
  const result=createMeasureNotation(bar(['f#/4','f/4','f/4','f#/4']),'treble','G','4/4');
  assert.equal(JSON.stringify(accidentals(result.notes)),JSON.stringify([[],['n'],[],['#']]));
  const flats=createMeasureNotation(bar(['bb/3','b/3','bb/3','bb/3']),'bass','F','4/4');
  assert.equal(JSON.stringify(accidentals(flats.notes)),JSON.stringify([[],['n'],['b'],[]]));
});

test('dotted quarter has six units in actual VexFlow ticks, not just a visual dot',()=>{
  const measure={events:[0,6].map(startUnits=>({key:'c/4',rest:false,duration:'q',dots:1,startUnits,durationUnits:6})),totalUnits:12,groups:[6,6],beamGroups:[6,6]};
  const result=createMeasureNotation(measure,'treble','C','6/8');
  assert.equal(result.voice.getMode(),VF.Voice.Mode.STRICT);
  assert.ok(result.voice.isComplete());
  assert.equal(result.notes[0].getTicks().value(),VF.VexFlow.RESOLUTION*6/16);
  assert.equal(result.notes[0].getModifiers().filter(m=>m.getCategory()===VF.Dot.CATEGORY).length,1);
});

test('all meters, keys and clefs produce complete strict voices with chromatic notes',()=>{
  let chromatic=0;
  const pitchClasses={c:0,'c#':1,db:1,d:2,'d#':3,eb:3,e:4,'e#':5,f:5,'f#':6,gb:6,g:7,'g#':8,ab:8,a:9,'a#':10,bb:10,b:11};
  for(const key of ['C','G','D','A','E','B','F#','F','Bb','Eb','Ab','Db']) {
    for(const meter of Object.keys(engine.TIME_SIGNATURES)) {
      const exercise=engine.generatePracticeExercise({...options,keySignature:key,mixedMeters:false,timeSignature:meter,measures:4});
      for(const clef of ['treble','bass','alto','tenor']) {
        for(const measure of exercise.measures) {
          const notation=createMeasureNotation(measure,clef,key,meter);
          assert.ok(notation.voice.isComplete());
          for(let i=0;i<measure.events.length;i++) {
            const note=measure.events[i];
            assert.equal(notation.notes[i].getTicks().value(),VF.VexFlow.RESOLUTION*note.durationUnits/16);
            if(!note.rest) {
              const [name,octave]=note.key.split('/');
              assert.equal((Number(octave)+1)*12+pitchClasses[name],note.midi);
              assert.ok(note.midi>=48&&note.midi<=84);
              if(!engine.getKeyScale(key).map(s=>s.toLowerCase()).includes(name)) chromatic++;
            }
          }
        }
      }
    }
  }
  assert.ok(chromatic>0);
});

test('mixed meter changes on complete phrase boundaries and uses selected meters only',()=>{
  const exercise=engine.generatePracticeExercise(options);
  const meters=exercise.measures.map(m=>m.timeSignature);
  assert.ok(new Set(meters).size>1);
  for(let i=0;i<meters.length;i++) {
    assert.ok(options.meters.includes(meters[i]));
    if(i%2===1) assert.equal(meters[i],meters[i-1]);
    if(i>0&&i%2===0) assert.notEqual(meters[i],meters[i-1]);
    createMeasureNotation(exercise.measures[i],'treble','C',meters[i]);
  }
  assert.throws(()=>engine.generatePracticeExercise({...options,meters:['4/4']}));
});

test('no beam crosses a primary beat in simple, compound or asymmetric meter',()=>{
  for(const meter of ['4/4','5/4','6/8','7/8','9/8','12/8']) {
    const exercise=engine.generatePracticeExercise({...options,timeSignature:meter,mixedMeters:false,measures:8});
    for(const measure of exercise.measures) {
      const result=createMeasureNotation(measure,'treble','C',meter);
      const groups=meter.endsWith('/4')?Array(Number(meter.split('/')[0])).fill(4):measure.beamGroups;
      const boundaries=[];let offset=0;for(const group of groups){offset+=group;boundaries.push(offset);}
      for(const beam of result.beams) {
        const indices=beam.getNotes().map(note=>result.notes.indexOf(note));
        const first=measure.events[indices[0]].startUnits;
        const last=measure.events[indices.at(-1)];
        assert.ok(!boundaries.some(boundary=>boundary>first&&boundary<last.startUnits+last.durationUnits));
      }
    }
  }
});

test('all scale families and enharmonic tonic spellings fit strict VexFlow voices',()=>{
  const scales=loadModule('src/music/scales.ts');
  for(const scale of scales.SCALES) for(const tonic of scales.TONICS) {
    const exercise=engine.generatePracticeExercise({...options,scaleId:scale.id,tonic,measures:2});
    for(const measure of exercise.measures) {
      const meter=measure.timeSignature??exercise.timeSignature;
      const result=createMeasureNotation(measure,'treble',exercise.tonality.signature??'C',meter);
      assert.ok(result.voice.isComplete());
      const stave=new VF.Stave(0,0,900).addClef('treble');
      if(exercise.tonality.signature) stave.addKeySignature(exercise.tonality.signature);
      const formatter=new VF.Formatter().joinVoices([result.voice]);
      assert.ok(Number.isFinite(formatter.preCalculateMinTotalWidth([result.voice])));
    }
  }
});


test('measure 5 regression: eighth C and sixteenth F beam across an internal sixteenth rest',()=>{
  const measure={events:[
    {key:'c/4',rest:false,duration:'8',dots:0,startUnits:0,durationUnits:2},
    {key:'b/4',rest:true,duration:'16',dots:0,startUnits:2,durationUnits:1},
    {key:'f/5',rest:false,duration:'16',dots:0,startUnits:3,durationUnits:1},
    {key:'c/4',rest:false,duration:'q',dots:0,startUnits:4,durationUnits:4},
    {key:'c/4',rest:false,duration:'q',dots:0,startUnits:8,durationUnits:4},
  ],totalUnits:12,groups:[4,4,4],beamGroups:[4,4,4]};
  const result=createMeasureNotation(measure,'treble','C','3/4');
  assert.equal(result.beams.length,1);
  assert.deepEqual(Array.from(result.beams[0].getNotes()),Array.from(result.notes.slice(0,3)));
  assert.ok(result.notes[1].isRest());
  assert.ok(result.voice.isComplete());
  for(let i=0;i<measure.events.length;i++) {
    assert.equal(result.notes[i].getTicks().value(),VF.VexFlow.RESOLUTION*measure.events[i].durationUnits/16);
  }
});

test('leading and trailing rests do not become beam endpoints',()=>{
  const measure={events:Array.from({length:8},(_,i)=>({
    key:'c/4',rest:[0,3,4,7].includes(i),duration:'16',dots:0,startUnits:i,durationUnits:1,
  })),totalUnits:8,groups:[4,4],beamGroups:[4,4]};
  const result=createMeasureNotation(measure,'treble','C','2/4');
  assert.equal(result.beams.length,2);
  assert.deepEqual(Array.from(result.beams,beam=>Array.from(beam.getNotes(),note=>result.notes.indexOf(note))),[[1,2],[5,6]]);
});

const {prepareGrandMeasure}=loadModule('src/notation/drawGrandScore.ts',1,undefined,{'vexflow':VF});
const {generateGrandExercise}=loadModule('src/music/grandStaff.ts',92);
test('grand staff keeps both hands complete, aligned and inside their ranges in every meter',()=>{
  for(const meter of Object.keys(engine.TIME_SIGNATURES)) {
    const exercise=generateGrandExercise({...options,timeSignature:meter,mixedMeters:false,range:{min:21,max:108},tonic:'Db',scaleId:'dorian'});
    for(let i=0;i<exercise.measures.length;i++) {
      const upper=exercise.measures[i],lower=exercise.lowerMeasures[i];
      const result=prepareGrandMeasure(upper,lower,exercise.tonality.signature??'C',meter);
      assert.ok(result.voices.every(voice=>voice.isComplete()));
      result.right.voice.setStave(new VF.Stave(0,0,1200));
      result.left.voice.setStave(new VF.Stave(0,250,1200));
      result.formatter.format(result.voices,Math.max(1000,result.minWidth+100));
      for(let u=0;u<upper.events.length;u++) {
        const note=upper.events[u];
        if(!note.rest)assert.ok(note.midi>=60&&note.midi<=108);
        const l=lower.events.findIndex(other=>other.startUnits===note.startUnits);
        if(l>=0)assert.equal(result.right.notes[u].getTickContext().getX(),result.left.notes[l].getTickContext().getX());
      }
      for(const note of lower.events)if(!note.rest)assert.ok(note.midi>=21&&note.midi<=59);
    }
  }
});
test('grand staff shares all mixed meter changes and rejects ranges without two hand registers',()=>{
  const exercise=generateGrandExercise({...options,tonic:'C',scaleId:'major'});
  assert.deepEqual(Array.from(exercise.measures,m=>m.timeSignature),Array.from(exercise.lowerMeasures,m=>m.timeSignature));
  for(const range of [{min:60,max:84},{min:21,max:59}])assert.throws(()=>generateGrandExercise({...options,range}));
});
test('monophonic grand staff remains strict notation across staff changes and rests',()=>{
  const {generateGrandExercise}=loadModule('src/music/grandStaff.ts',928);
  for(const meter of ['4/4','6/8','7/8']){
    const exercise=generateGrandExercise({...options,timeSignature:meter},'mono');
    for(const [measures,clef] of [[exercise.measures,'treble'],[exercise.lowerMeasures,'bass']])for(const m of measures){
      const notation=createMeasureNotation(m,clef,exercise.keySignature,m.timeSignature??meter);
      assert.ok(notation.voice.isComplete());
    }
  }
});

test('inactive staff rests consolidate by beat and whole silent bars use centered measure rests',()=>{
  const {simplifyStaffRests}=loadModule('src/notation/simplifyStaffRests.ts');
  const make=(units,rest=true,start=0)=>({key:'c/4',octave:4,rest,duration:units===4?'q':units===2?'8':'16',dots:0,startUnits:start,durationUnits:units,midi:60});
  const original={events:[make(2,false),make(1,true,2),make(1,true,3),make(4,true,4),make(4,true,8),make(2,true,12),make(1,true,14),make(1,true,15)],totalUnits:16,beamGroups:[4,4,4,4],groups:[4,4,4,4]};
  const reduced=simplifyStaffRests(original,'4/4');
  assert.deepEqual(Array.from(reduced.events,n=>n.durationUnits),[2,2,4,8]);
  assert.equal(original.events.length,8);
  assert.ok(createMeasureNotation(reduced,'treble','C','4/4').voice.isComplete());
  for(const meter of ['2/4','3/4','4/4','5/4','6/8','7/8','9/8','12/8']){
    const [n,d]=meter.split('/').map(Number),units=n*16/d;
    const empty={events:Array.from({length:units},(_,i)=>make(1,true,i)),totalUnits:units,beamGroups:[units],groups:[units]};
    const result=simplifyStaffRests(empty,meter);
    assert.equal(result.events.length,1);
    const notation=createMeasureNotation(result,'treble','C',meter);
    assert.ok(notation.voice.isComplete(),meter);assert.ok(notation.notes[0].isCenterAligned(),meter);
    assert.equal(notation.notes[0].getDuration(),'w');
  }
  const compound={events:[make(2,false),make(2,true,2),make(2,true,4),make(2,true,6),make(2,true,8),make(2,true,10)],totalUnits:12,beamGroups:[6,6],groups:[6,6]};
  assert.deepEqual(Array.from(simplifyStaffRests(compound,'6/8').events,n=>n.durationUnits),[2,2,2,6]);
});
