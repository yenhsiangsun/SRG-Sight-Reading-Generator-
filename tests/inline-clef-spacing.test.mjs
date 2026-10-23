import test from 'node:test';
import assert from 'node:assert/strict';
import * as VF from 'vexflow';
import {loadModule} from './helpers.mjs';
globalThis.document={createElement:()=>({style:{fontFamily:'Bravura',fontSize:'30px',fontWeight:'normal',fontStyle:'normal',
 set font(value){const match=value.match(/([\d.]+(?:px|pt))\s+(.+)$/);if(match){this.fontSize=match[1];this.fontFamily=match[2];}}}})};
VF.Element.setTextMeasurementCanvas({getContext:()=>({measureText:text=>({width:text.length*8,actualBoundingBoxLeft:0,
 actualBoundingBoxRight:text.length*8,actualBoundingBoxAscent:12,actualBoundingBoxDescent:3,fontBoundingBoxAscent:12,fontBoundingBoxDescent:3})})});
const {createMeasureNotation,prepareNotationForDrawing}=loadModule('src/notation/createMeasureNotation.ts',1,undefined,{'vexflow':VF});
const {planSingleStaff}=loadModule('src/notation/mixedStaff.ts');
const {createPlaybackEvents}=loadModule('src/audio/PlaybackController.ts');
const {midiFromKey}=loadModule('src/music/notePitches.ts');
const keys=['a/4','c#/5','d#/3','a/3','e#/5','f#/5','bb/2','b#/4'];
const clefs=['treble','treble','bass','bass','treble','treble','bass','treble'];
const fixture=()=>({timeSignature:'4/4',totalUnits:16,groups:[4,4,4,4],beamGroups:[4,4,4,4],events:keys.map((key,i)=>({key,midi:midiFromKey(key),octave:+key.split('/')[1],rest:false,duration:'8',dots:0,startUnits:i*2,durationUnits:2,...(i===2?{dynamic:'mf'}:{})}))});
function context(){
 const commands=[],ctx={commands,getFont:()=> '10px Arial',measureText:text=>({width:text.length*8})};
 return new Proxy(ctx,{get(target,key){if(key in target)return target[key];return (...args)=>{commands.push([key,...args]);return ctx;};}});
}
function prepare(measure,plan=clefs,width=560,annotation){
 const notation=createMeasureNotation(measure,plan[0],'C','4/4',[],plan,annotation),ctx=context();
 const formatter=new VF.Formatter().joinVoices([notation.voice]),minimum=formatter.preCalculateMinTotalWidth([notation.voice]);
 const formattedWidth=Math.max(width,minimum+8),stave=new VF.Stave(10,110,formattedWidth+120).addClef(plan[0]).setContext(ctx);
 formatter.format([notation.voice],formattedWidth);prepareNotationForDrawing(notation,stave);
 notation.voice.draw(ctx,stave);notation.beams.forEach(beam=>beam.setContext(ctx).draw());
 return {...notation,ctx,minimum,stave};
}
function checkGaps(notation){
 let changes=0;
 for(const [index,note]of notation.notes.entries())for(const clef of note.getModifiers().filter(m=>m.getCategory()===VF.NoteSubGroup.CATEGORY)){
  changes++;const box=clef.getClefBounds();
  const left=Math.min(note.getNoteHeadBeginX(),...note.getModifiers().filter(m=>m.getCategory()===VF.Accidental.CATEGORY).map(m=>m.getBoundingBox().getX()));
  assert.ok(left-(box.getX()+box.getW())>=8-1e-8,'clef clears the following accidental/notehead');
  if(index){const prior=notation.notes[index-1].getBoundingBox();assert.ok(box.getX()-(prior.getX()+prior.getW())>=6-1e-8,'clef clears the preceding note/flag/modifiers');}
 }
 return changes;
}
test('dense inline clefs keep real space before and after accidentals, flags and dynamics, even at minimum width',()=>{
 const source=fixture(),before=JSON.stringify(source);
 for(const width of [0,420,800]){const notation=prepare(source,clefs,width);assert.equal(checkGaps(notation),4);assert.ok(notation.voice.isComplete());}
 assert.equal(JSON.stringify(source),before);
});
test('treble, bass, alto and tenor changes retain gap geometry and zero musical duration, including octave annotations',()=>{
 for(const annotation of [undefined,'8va','8vb']){
  const plan=['treble','alto','tenor','bass','treble','alto','tenor','bass'];
  const notation=prepare(fixture(),plan,0,annotation);assert.equal(checkGaps(notation),7);
  const widths=notation.notes.flatMap(n=>n.getModifiers().filter(m=>m.getCategory()===VF.NoteSubGroup.CATEGORY).map(m=>{const width=m.getWidth();m.preFormat();assert.equal(m.getWidth(),width,'reformatting cannot accumulate padding');return width;}));
  assert.ok(widths.every(width=>width>22));assert.equal(notation.voice.getTicksUsed().value(),VF.VexFlow.RESOLUTION);
 }
});
test('clef spacing never rewrites the clef plan, melody, rhythm or playback timeline',()=>{
 const measures=[fixture(),fixture()],exercise={soundProfile:'Pipa',staffMode:'mixed',clef:'treble',timeSignature:'4/4',keySignature:'C',tempo:80,measures};
 const original=JSON.stringify(exercise),timeline=JSON.stringify(createPlaybackEvents(exercise,80,true)),plan=planSingleStaff(exercise,measures);
 measures.forEach((m,i)=>prepare(m,plan.clefs[i],0));
 assert.equal(JSON.stringify(exercise),original);assert.equal(JSON.stringify(createPlaybackEvents(exercise,80,true)),timeline);
 assert.deepEqual(JSON.parse(JSON.stringify(planSingleStaff(exercise,measures))),JSON.parse(JSON.stringify(plan)));
});
