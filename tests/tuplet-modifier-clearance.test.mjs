import test from 'node:test';
import assert from 'node:assert/strict';
import * as VF from 'vexflow';
import {loadModule} from './helpers.mjs';

// This exact left-hand measure reproduced the original four-page piano PDF
// collision (fixed SHA256-seeded R27 fixture, measure8). No audio or storage.
const originalMeasure = {"events":[{"key":"b/4","octave":4,"duration":"8","dots":0,"rest":true,"startUnits":0,"durationUnits":1.3333333333333333,"tuplet":3},{"key":"g/3","octave":3,"duration":"8","dots":0,"rest":false,"startUnits":1.3333333333333333,"durationUnits":1.3333333333333333,"tuplet":3,"midi":55,"dynamic":"mp"},{"key":"b/2","octave":2,"duration":"8","dots":0,"rest":false,"startUnits":2.6666666666666665,"durationUnits":1.3333333333333333,"tuplet":3,"midi":47},{"key":"g/3","octave":3,"duration":"8","dots":0,"rest":false,"startUnits":4,"durationUnits":2,"midi":55,"chord":[{"key":"g/3","octave":3,"midi":55},{"midi":60,"key":"c/4","octave":4}],"articulation":"tenuto"},{"key":"b/4","octave":4,"duration":"16","dots":0,"rest":true,"startUnits":6,"durationUnits":1},{"key":"g/2","octave":2,"duration":"16","dots":0,"rest":false,"startUnits":7,"durationUnits":1,"midi":43},{"key":"e/3","octave":3,"duration":"16","dots":0,"rest":false,"startUnits":8,"durationUnits":1,"midi":52},{"key":"b/3","octave":3,"duration":"16","dots":0,"rest":false,"startUnits":9,"durationUnits":1,"midi":59},{"key":"c/3","octave":3,"duration":"16","dots":0,"rest":false,"startUnits":10,"durationUnits":1,"midi":48},{"key":"b/4","octave":4,"duration":"16","dots":0,"rest":true,"startUnits":11,"durationUnits":1},{"key":"g/3","octave":3,"duration":"8","dots":0,"rest":false,"startUnits":12,"durationUnits":2,"midi":55,"chord":[{"key":"g/3","octave":3,"midi":55},{"midi":60,"key":"c/4","octave":4}]},{"key":"c/3","octave":3,"duration":"8","dots":0,"rest":false,"startUnits":14,"durationUnits":2,"midi":48}],"totalUnits":16,"groups":[4,4,4,4],"beamGroups":[4,4,4,4],"timeSignature":"4/4"};
globalThis.document={createElement:()=>({style:{fontFamily:'Bravura',fontSize:'30px',fontWeight:'normal',fontStyle:'normal',
  set font(value){const match=value.match(/([\d.]+(?:px|pt))\s+(.+)$/);if(match){this.fontSize=match[1];this.fontFamily=match[2];}}}})};
const metrics=text=>({width:text.length*8,actualBoundingBoxLeft:0,actualBoundingBoxRight:text.length*8,
  actualBoundingBoxAscent:12,actualBoundingBoxDescent:3,fontBoundingBoxAscent:12,fontBoundingBoxDescent:3});
VF.Element.setTextMeasurementCanvas({getContext:()=>({measureText:metrics})});
const {createMeasureNotation,prepareNotationForDrawing}=loadModule('src/notation/createMeasureNotation.ts',1,undefined,{vexflow:VF});
const clone=value=>JSON.parse(JSON.stringify(value));
function drawingContext(){
  const labels=[],commands=[],context=new Proxy({labels,commands},{get(target,key){
    if(key in target)return target[key];
    if(key==='measureText')return metrics;
    return (...args)=>{commands.push([key,...args]);if(key==='fillText')labels.push(args);return context;};
  }});return context;
}
function format({dynamic=true,above=false,bracketed=true}={}){
  const measure=clone(originalMeasure);if(!dynamic)delete measure.events[1].dynamic;
  const sourceBefore=JSON.stringify(measure);
  const notation=createMeasureNotation(measure,'bass','C','4/4'),stave=new VF.Stave(10,80,510).addClef('bass');
  notation.voice.setStave(stave);new VF.Formatter().joinVoices([notation.voice]).format([notation.voice],420);
  prepareNotationForDrawing(notation,stave);
  const tuplet=notation.tuplets[0];tuplet.setTupletLocation(above?VF.Tuplet.LOCATION_TOP:VF.Tuplet.LOCATION_BOTTOM);tuplet.setBracketed(bracketed);
  return {notation,tuplet,stave,measure,sourceBefore};
}
function drawDynamics(notation,context){
  for(const note of notation.notes)for(const modifier of note.getModifiers())if(modifier.getCategory()==='Annotation')modifier.setContext(context).draw();
}
function drawnNumeral(tuplet,context){
  context.labels.length=0;tuplet.setContext(context).draw();
  const text=context.labels.find(label=>label[0]===tuplet.textElement.getText());assert.ok(text,'real VexFlow Tuplet.draw emits the digit');
  return {x:text[1],y:text[2]-12,w:metrics(text[0]).width,h:15};
}
function box(value){return {x:value.getX(),y:value.getY(),w:value.getW(),h:value.getH()};}
function intersects(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}
function dynamicOf(notation){return notation.notes[1].getModifiers().find(m=>m.getCategory()==='Annotation');}

test('real piano left-hand bracketed triplet digit clears the rendered mp annotation',()=>{
  const {notation,tuplet,measure,sourceBefore}=format(),context=drawingContext();drawDynamics(notation,context);
  assert.equal(tuplet.options.bracketed,true);assert.equal(tuplet.location,VF.Tuplet.LOCATION_BOTTOM);
  const dynamic=box(dynamicOf(notation).getBoundingBox()),digit=drawnNumeral(tuplet,context);
  assert.equal(intersects(dynamic,digit),false,`mp ${JSON.stringify(dynamic)} overlaps triplet3 ${JSON.stringify(digit)}`);
  assert.ok(digit.y>=dynamic.y+dynamic.h+3,'digit retains breathing room below mp');
  assert.equal(JSON.stringify(measure),sourceBefore,'engraving does not alter the generated notes or timing');
});

test('bracketed top tuplets clear an actual rendered modifier above without double text offset',()=>{
  const {notation,tuplet}=format({above:true}),context=drawingContext();drawDynamics(notation,context);
  tuplet.options.textYOffset=7;
  const modifier=dynamicOf(notation),current=drawnNumeral(tuplet,context),bounds=modifier.getBoundingBox();
  modifier.setYShift(current.y-bounds.getY());
  const dynamic=box(modifier.getBoundingBox()),digit=drawnNumeral(tuplet,context);
  assert.equal(intersects(dynamic,digit),false);assert.ok(digit.y+digit.h<=dynamic.y-3);
});

test('non-colliding bracketed tuplets preserve the inherited bracket coordinate and text offset exactly',()=>{
  for(const above of [true,false])for(const offset of [-3,0,7]){
    const {notation,tuplet}=format({dynamic:false,above});tuplet.options.textYOffset=offset;
    const expected=VF.Tuplet.prototype.getYPosition.call(tuplet),context=drawingContext();drawDynamics(notation,context);
    assert.equal(tuplet.getYPosition(),expected);
    const digit=drawnNumeral(tuplet,context),baseline=digit.y+12;
    assert.equal(baseline,expected+tuplet.textElement.getHeight()/2+(above?-1:1)*offset);
  }
});

test('unrendered or horizontally distant modifiers do not displace a bracketed triplet',()=>{
  const {notation,tuplet}=format(),context=drawingContext(),expected=VF.Tuplet.prototype.getYPosition.call(tuplet);
  assert.equal(tuplet.getYPosition(),expected,'an undrawn modifier has no reliable ink bounds');
  drawDynamics(notation,context);dynamicOf(notation).setXShift(1000);
  assert.equal(tuplet.getYPosition(),expected,'unrelated horizontal ink does not add vertical space');
});

test('existing unbracketed beam-aligned positions match the frozen pre-fix fixture geometry',()=>{
  // Recorded from the unmodified ScoreTuplet with these final real VexFlow
  // stems and rendered annotations. Browser SVG/Canvas QA is separate.
  for(const [above,dynamic,expected] of [[true,false,110.5],[true,true,110.5],
    [false,false,190.42090492368206],[false,true,209.6298726321359]]){
    const {notation,tuplet}=format({above,dynamic,bracketed:false}),context=drawingContext();
    drawDynamics(notation,context);
    assert.equal(tuplet.getYPosition(),expected,'unbracketed beam clearance remains unchanged');
  }
});
