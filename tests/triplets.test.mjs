import test from 'node:test';
import assert from 'node:assert/strict';
import * as VF from 'vexflow';
import {loadModule} from './helpers.mjs';

// Real VexFlow fractions, beams and tick contexts; visual QA runs in the browser.
globalThis.document={createElement:()=>({style:{fontFamily:'Bravura',fontSize:'30px',fontWeight:'normal',fontStyle:'normal',
  set font(value){const m=value.match(/([\d.]+(?:px|pt))\s+(.+)$/);if(m){this.fontSize=m[1];this.fontFamily=m[2];}}}})};
VF.Element.setTextMeasurementCanvas({getContext:()=>({measureText:text=>({width:text.length*8,actualBoundingBoxLeft:0,actualBoundingBoxRight:text.length*8,actualBoundingBoxAscent:12,actualBoundingBoxDescent:3,fontBoundingBoxAscent:12,fontBoundingBoxDescent:3})})});
const {createMeasureNotation,prepareNotationForDrawing}=loadModule('src/notation/createMeasureNotation.ts',1,undefined,{vexflow:VF});
const {simplifyStaffRests}=loadModule('src/notation/simplifyStaffRests.ts');
const {assertMeasureRhythm}=loadModule('src/music/rhythmTiming.ts');
const {createPlaybackEvents,createMetronomeEvents}=loadModule('src/audio/PlaybackController.ts');
const {scoreEvents}=loadModule('src/practice/feedback.ts');
const {collectMeasureAnchors,collectNoteGeometry,findCursor,hitTest}=loadModule('src/notation/scoreGeometry.ts',1,undefined,{vexflow:VF});
const opts={instrument:'Sheng',clef:'treble',difficulty:'beginner',keySignature:'C',timeSignature:'4/4',rhythmLevel:'complex',measures:32,tempo:60,
  range:{min:48,max:84},allowAccidentals:false,mixedMeters:false,meters:['4/4','6/8'],tonic:'C',scaleId:'major'};
const plain=x=>JSON.parse(JSON.stringify(x));
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
function bar(rests=[]) {
  return {timeSignature:'2/4',totalUnits:8,groups:[4,4],beamGroups:[4,4],events:Array.from({length:6},(_,i)=>({
    key:'c/4',octave:4,midi:60,rest:rests.includes(i),duration:'8',dots:0,startUnits:i*4/3,durationUnits:4/3,tuplet:3,
  }))};
}
function format(measure) {
  const notation=createMeasureNotation(measure,'treble','C',measure.timeSignature);
  const stave=new VF.Stave(10,80,1000).setNoteStartX(100);
  notation.voice.setStave(stave);
  new VF.Formatter().joinVoices([notation.voice]).format([notation.voice],850);
  prepareNotationForDrawing(notation,stave);
  return notation;
}

test('all /4 meters generate complete triplet beats at every pitch grade, increasingly with rhythm level',()=>{
  const engine=loadModule('src/music.ts',67219);
  for(const meter of ['2/4','3/4','4/4','5/4']) for(const difficulty of ['beginner','intermediate','advanced']) {
    const rates=[];
    for(const rhythmLevel of ['simple','medium','complex']) {
      let groups=0,beats=0;
      for(let sample=0;sample<12;sample++) {
        const ex=engine.generatePracticeExercise({...opts,timeSignature:meter,difficulty,rhythmLevel});
        for(const measure of ex.measures) {
          assert.doesNotThrow(()=>assertMeasureRhythm(measure,meter));
          let ticks=0;
          for(let i=0;i<measure.events.length;i++) {
            const note=measure.events[i];
            assert.equal(note.startUnits,ticks/12);ticks+=Math.round(note.durationUnits*12);
            if(note.tuplet) {
              assert.equal(note.duration,'8');assert.equal(note.dots,0);assert.equal(note.durationUnits,4/3);
              if(note.startUnits%4===0){groups++;assert.ok(measure.events.slice(i,i+3).every(n=>n.tuplet===3));}
            }
          }
          assert.equal(ticks,measure.totalUnits*12);beats+=measure.totalUnits/4;
        }
      }
      rates.push(groups/beats);
    }
    assert.ok(rates[0]>.02 && rates[0]<.07,`${meter} ${rates}`);
    assert.ok(rates[1]>.05 && rates[1]<.12 && rates[2]>.075 && rates[2]<.16,`${meter} ${rates}`);
    assert.ok(rates[1]>rates[0]+.01 && rates[2]>rates[1]+.01,`${meter} ${rates}`);
  }
});

test('/8 subdivisions and dedicated dotted/sixteenth studies do not become triplets',()=>{
  const engine=loadModule('src/music.ts',419);
  for(const timeSignature of Object.keys(engine.TIME_SIGNATURES)) for(const rhythmFocus of ['balanced','dotted','sixteenths']) {
    if(timeSignature.endsWith('/4')&&rhythmFocus==='balanced')continue;
    const ex=engine.generatePracticeExercise({...opts,timeSignature,rhythmFocus});
    assert.ok(ex.measures.every(m=>m.events.every(n=>n.tuplet===undefined)));
  }
});

test('VexFlow engraves 3:2 eighths with exact strict-voice ticks, complete beams and a bracket for edge rests',()=>{
  for(const rests of [[],[0],[1],[2],[0,1],[1,2]]) {
    const measure=bar(rests), notation=format(measure);
    assert.equal(notation.tuplets.length,2);assert.ok(notation.voice.isComplete());
    for(const note of notation.notes) close(note.getTicks().value(),VF.VexFlow.RESOLUTION/12);
    for(const tuplet of notation.tuplets) {
      assert.equal(tuplet.getNoteCount(),3);assert.equal(tuplet.getNotesOccupied(),2);
      assert.ok(Number.isFinite(tuplet.getYPosition()));
    }
    assert.equal(notation.tuplets[0].options.bracketed,rests.includes(0)||rests.includes(2));
    assert.equal(notation.tuplets[1].options.bracketed,false);
    for(const beam of notation.beams) {
      const indexes=beam.getNotes().map(n=>notation.notes.indexOf(n));
      assert.equal(Math.floor(indexes[0]/3),Math.floor(indexes.at(-1)/3));
    }
  }
});

test('triplet digits follow final beam stems in either clef, including bracketed rests',()=>{
  for (const [clef,key,expected] of [['treble','c/4',1],['treble','f/5',-1],['bass','g/2',1],['bass','e/4',-1]]) {
    for (const rests of [[],[0],[1],[2]]) {
      const measure=bar(rests);measure.events.forEach(n=>{n.key=key;});
      const notation=createMeasureNotation(measure,clef,'C','2/4');
      const stave=new VF.Stave(10,80,1000).setNoteStartX(100);
      notation.voice.setStave(stave);new VF.Formatter().joinVoices([notation.voice]).format([notation.voice],850);
      prepareNotationForDrawing(notation,stave);
      for (const tuplet of notation.tuplets) {
        assert.equal(tuplet.location,expected,`${clef} ${key} ${rests}`);
        const sounded=tuplet.getNotes().filter(n=>!n.isRest());
        const tips=sounded.map(n=>n.getStemExtents().topY);
        assert.ok(expected===1?tuplet.getYPosition()<Math.min(...tips):tuplet.getYPosition()>Math.max(...tips));
        if(!tuplet.options.bracketed)assert.ok(Math.abs(tuplet.getYPosition()-tips[0])<35,'digit stays close to a level beam');
      }
    }
  }
});

test('rest consolidation preserves partial tuplets but replaces a silent triplet beat with an ordinary rest',()=>{
  for(const rests of [[0],[0,1],[0,1,2],[1,2,3,4,5],[0,1,2,3,4,5]]) {
    const original=bar(rests), before=JSON.stringify(original), reduced=simplifyStaffRests(original,'2/4');
    assert.equal(JSON.stringify(original),before);
    assert.doesNotThrow(()=>assertMeasureRhythm(reduced,'2/4'));
    assert.ok(format(reduced).voice.isComplete());
    if(rests.length===3) {assert.equal(reduced.events[0].duration,'q');assert.equal(reduced.events[0].tuplet,undefined);}
    else if(rests.length<3)assert.equal(reduced.events.length,6);
    if(rests.length===6)assert.equal(reduced.events[0].measureRest,true);
  }
});

test('8va stays above actual VexFlow tuplet numbers, including articulated groups',()=>{
  const {drawOctaveLines}=loadModule('src/notation/octaveLines.ts');
  const measure=bar();measure.events.forEach(n=>{n.articulation='tenuto';});
  const notation=format(measure), labels=[];
  const context=new Proxy({}, {get:(_,method)=>(...args)=>{
    if(method==='fillText')labels.push(args);
    if(method==='measureText')return {width:24};
    return context;
  }});
  drawOctaveLines(context,[{notes:notation.notes,shifts:Array(6).fill(1),stave:notation.notes[0].getStave(),row:0}]);
  assert.equal(labels.length,1);assert.equal(labels[0][0],'8va');
  for(const tuplet of notation.tuplets) assert.ok(labels[0][2]<=tuplet.getYPosition()-20);
});

test('playback, metronome, grading and the draggable cursor agree on thirds across mixed meters',()=>{
  const compound={timeSignature:'6/8',totalUnits:12,groups:[6,6],beamGroups:[6,6],events:Array.from({length:6},(_,i)=>({key:'d/4',octave:4,midi:62,rest:false,duration:'8',dots:0,startUnits:i*2,durationUnits:2}))};
  const ex={...opts,timeSignature:'2/4',measures:[bar(),compound,bar()]};
  const playback=createPlaybackEvents(ex,60), feedback=scoreEvents(ex,60);
  close(playback.duration,7);
  for(let i=0;i<6;i++) {close(playback.events[i].time,i/3);close(playback.events[i].duration,1/3);}
  close(playback.events[6].time,2);close(playback.events[6].duration,.5);close(playback.events[12].time,5);
  assert.deepEqual(Array.from(createMetronomeEvents(ex,60),n=>n.time),[0,1,2,2.5,3,3.5,4,4.5,5,6]);
  feedback.forEach((n,i)=>close(n.time,playback.events[i].time));
  const notation=format(ex.measures[0]);
  const anchors=collectMeasureAnchors([notation.notes],8,100,990);
  const notes=collectNoteGeometry(notation.notes,0,0);
  const layout={width:1000,height:200,measures:[{index:0,row:0,xStart:100,xEnd:990,yTop:20,yBottom:180,totalUnits:8,anchors}]};
  notes.forEach((note,i)=>{
    assert.equal(note.units,ex.measures[0].events[i].startUnits);
    close(findCursor(layout,ex,60,playback.events[i].time).x,anchors[i].x);
    close(hitTest(layout,ex,60,anchors[i].x,80),playback.events[i].time);
  });
});

test('saved triplets round-trip and malformed ratios, incomplete groups and wrong playback durations are rejected',()=>{
  const library=loadModule('src/practice/library.ts');
  const settings={instrument:'Sheng',clef:'treble',difficulty:'Beginner',keySignature:'C',tonic:'C',scaleId:'major',timeSignature:'2/4',rhythmLevel:'Complex',measureCount:1,rangeMinMidi:48,rangeMaxMidi:84,allowAccidentals:false,mixedMeters:false,meters:['2/4']};
  const study={id:'triplet',created:1,bpm:60,settings,exercise:{...opts,timeSignature:'2/4',soundProfile:'Sheng',measures:[bar()]}};
  assert.equal(library.validStudy(study,true),true);
  assert.deepEqual(plain(library.readLibrary(JSON.stringify({version:1,scores:[study],presets:[]})).scores[0]),study);
  for(const corrupt of [n=>{n.tuplet=5;},n=>{delete n.tuplet;},n=>{n.durationUnits=2;},n=>{n.startUnits+=.01;},n=>{n.dots=1;}]) {
    const broken=plain(study);corrupt(broken.exercise.measures[0].events[1]);
    assert.equal(library.validStudy(broken,true),false);
    assert.throws(()=>createMeasureNotation(broken.exercise.measures[0],'treble','C','2/4'));
  }
});
