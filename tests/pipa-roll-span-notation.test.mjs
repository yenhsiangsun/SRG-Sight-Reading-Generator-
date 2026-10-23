import test from 'node:test';
import assert from 'node:assert/strict';
import * as VF from 'vexflow';
import {loadModule} from './helpers.mjs';
globalThis.document={createElement:()=>({style:{fontFamily:'Bravura',fontSize:'30px',fontWeight:'normal',fontStyle:'normal',
 set font(value){const match=value.match(/([\d.]+(?:px|pt))\s+(.+)$/);if(match){this.fontSize=match[1];this.fontFamily=match[2];}}}})};
VF.Element.setTextMeasurementCanvas({getContext:()=>({measureText:text=>({width:text.length*8,actualBoundingBoxLeft:0,
 actualBoundingBoxRight:text.length*8,actualBoundingBoxAscent:12,actualBoundingBoxDescent:3,fontBoundingBoxAscent:12,fontBoundingBoxDescent:3})})});
const {createMeasureNotation,prepareNotationForDrawing}=loadModule('src/notation/createMeasureNotation.ts',1,undefined,{'vexflow':VF});
const {planPipaRollSpans,drawPipaRollSpans,pipaRollSpanSpace}=loadModule('src/notation/pipaRollSpans.ts');
const {createPlaybackEvents}=loadModule('src/audio/PlaybackController.ts');
const context=()=>{const commands=[],ctx={commands};for(const name of ['save','restore','openGroup','closeGroup','setStrokeStyle','setFillStyle','setLineDash','setLineWidth','beginPath','moveTo','lineTo','bezierCurveTo','closePath','fill','stroke'])ctx[name]=(...args)=>{commands.push([name,...args]);return ctx;};return ctx;};
function fixture(){
 const group={startUnits:8,endUnits:16},keys=['c/4','e/4','a/3','e/4','c/4'],starts=[0,4,8,9,12],units=[4,4,1,3,4];
 return {timeSignature:'4/4',totalUnits:16,groups:[4,4,4,4],beamGroups:[4,4,4,4],events:keys.map((key,i)=>({key,octave:+key.split('/')[1],midi:({ 'c/4':60,'e/4':64,'a/3':57})[key],rest:false,
   duration:({1:'16',3:'8',4:'q'})[units[i]],dots:units[i]===3?1:0,startUnits:starts[i],durationUnits:units[i],...(i>=2?{technique:'pipa-roll',pipaRollGroup:group}:{})}))};
}
function prepare(measure,staff=0){
 const notation=createMeasureNotation(measure,staff?'bass':'treble','C','4/4');
 const stave=new VF.Stave(10,150+staff*150,500).addClef(staff?'bass':'treble');
 new VF.Formatter().joinVoices([notation.voice]).format([notation.voice],380);prepareNotationForDrawing(notation,stave);
 const ctx=context();for(const note of notation.notes)for(const mark of note.getModifiers())if(mark.getCategory()===VF.Articulation.CATEGORY)mark.setContext(ctx).draw();
 return {bar:3,row:1,staff,stave,notes:notation.notes,measure};
}
test('a continuous roll has an upper right-hooked range and a note-anchored slur below its up-stem notes',()=>{
 const measure=fixture(),before=JSON.stringify(measure),bar=prepare(measure),ctx=context(),spans=drawPipaRollSpans(ctx,[bar]);
 assert.equal(spans.length,1);const span=spans[0];
 const centers=bar.notes.map(n=>(n.getNoteHeadBeginX()+n.getNoteHeadEndX())/2);
 assert.equal(span.xStart,centers[2]);assert.ok(span.xEnd>centers[4]);
 const signs=bar.notes.flatMap(n=>n.getModifiers().filter(m=>m.getCategory()===VF.Articulation.CATEGORY));
 assert.equal(signs.length,1,'the range line replaces repeated signs on later beats');
 assert.ok(signs.every(sign=>span.rangeY<=sign.getBoundingBox().getY()-10));
 assert.ok(bar.notes.slice(2).every(n=>n.getStemDirection()>0));
 assert.equal(span.slur.above,false,'all-up-stem groups take a downward slur on the notehead side');
 assert.equal(span.slur.xStart,centers[2]);assert.equal(span.slur.xEnd,centers[4]);
 assert.ok(span.slur.startY>Math.max(...bar.notes[2].getYs())&&span.slur.endY>Math.max(...bar.notes[4].getYs()));
 assert.ok(span.slur.controlLift>0,'the curve bends downward, independently of the upper bracket');
 assert.equal(ctx.commands.filter(c=>c[0]==='openGroup'&&c[1]==='pipa-roll-range').length,1);
 assert.equal(ctx.commands.filter(c=>c[0]==='openGroup'&&c[1]==='pipa-roll-slur').length,1);
 assert.ok(ctx.commands.some(c=>c[0]==='lineTo'&&c[1]===span.xEnd&&c[2]===span.rangeY+6),'visible downward hook at the end of the range');
 assert.equal(ctx.commands.filter(c=>c[0]==='bezierCurveTo').length,2,'a tapered musical slur rather than a box or tie');
 assert.equal(JSON.stringify(measure),before);
});
test('moving a technique bracket around other ink never moves the note-anchored slur with it',()=>{
 const bar=prepare(fixture()),plain=planPipaRollSpans([bar])[0];
 const obstacle={row:1,staff:0,bars:[3],bounds:{xStart:plain.xStart,xEnd:plain.xEnd,yTop:plain.rangeY-30,yBottom:plain.rangeY-10}};
 const displaced=planPipaRollSpans([bar],[obstacle])[0];assert.ok(displaced.rangeY+8<obstacle.bounds.yTop);
 assert.deepEqual(displaced.slur,plain.slur,'slur placement follows the notes, never the bracket');
 assert.equal(planPipaRollSpans([bar],[{...obstacle,staff:1}])[0].rangeY,plain.rangeY);
 assert.equal(planPipaRollSpans([bar],[{...obstacle,row:0}])[0].rangeY,plain.rangeY);
 assert.equal(pipaRollSpanSpace([fixture()],{first:0,last:0}),20);
 assert.equal(pipaRollSpanSpace([fixture()],{first:1,last:2}),0);
 const single=fixture();for(const n of single.events)delete n.pipaRollGroup;
 assert.equal(planPipaRollSpans([prepare(single)]).length,0,'standalone signs gain no false multi-note range');
 assert.equal(pipaRollSpanSpace([single],{first:0,last:0}),0);
});
test('SVG and PDF receive the same range/slur paths and notation leaves written and performed audio timelines unchanged',()=>{
 const measure=fixture(),exercise={instrument:'Sheng',soundProfile:'Pipa',timeSignature:'4/4',tempo:80,measures:[measure]};
 const written=JSON.stringify(createPlaybackEvents(exercise,80)),performed=JSON.stringify(createPlaybackEvents(exercise,80,true));
 const bar=prepare(measure),svg=context(),canvas=context();drawPipaRollSpans(svg,[bar]);drawPipaRollSpans(canvas,[bar]);
 assert.deepEqual(svg.commands,canvas.commands);
 assert.equal(JSON.stringify(createPlaybackEvents(exercise,80)),written);
 assert.equal(JSON.stringify(createPlaybackEvents(exercise,80,true)),performed);
});

test('single and grand layouts contain roll signs, ranges and note-side slurs in narrow and wide SVG/PDF systems',()=>{
 const calls=[],scoreContext=(container,width,height,_viewport)=>{
  const ctx=context();ctx.getFont=()=> '10px Arial';ctx.measureText=text=>({width:text.length*7});
  calls.push({height,commands:ctx.commands});return new Proxy(ctx,{get(target,key){return key in target?target[key]:()=>ctx;}});
 };
 const mappings={'vexflow':VF,'./scoreRenderer':{scoreContext}};
 const {drawSingleScore}=loadModule('src/notation/drawSingleScore.ts',1,undefined,mappings);
 const {drawGrandScore}=loadModule('src/notation/drawGrandScore.ts',1,undefined,mappings);
 for(const grand of [false,true])for(const width of [600,1000]){
  const measures=[fixture(),fixture()],exercise={soundProfile:'Pipa',timeSignature:'4/4',clef:'treble',keySignature:'C',tempo:80,measures,
   expressionSpans:[{kind:'slur',staff:0,start:{bar:0,event:0},end:{bar:1,event:4}}],
   ...(grand?{grandMode:'two-hand',lowerMeasures:[fixture(),fixture()]}:{})};
  const original=JSON.stringify(exercise),container={replaceChildren(){},querySelector(){return {setAttribute(){}}}},draw=grand?drawGrandScore:drawSingleScore;
  const before=calls.length,svg=draw(container,exercise,width);assert.ok(calls.length-before<=2);
  const next=calls.length,pdf=draw(container,exercise,width,{sourceY:0,sourceHeight:svg.height,pixelRatio:1});assert.ok(calls.length-next<=2);
  assert.deepEqual(JSON.parse(JSON.stringify(pdf)),JSON.parse(JSON.stringify(svg)));
  const commands=calls.at(-1).commands;
  assert.equal(commands.filter(c=>c[0]==='openGroup'&&c[1]==='pipa-roll-range').length,grand?4:2);
  for(let i=0;i<commands.length;i++){
   const start=commands[i];if(start[0]!=='openGroup'||!String(start[1]).startsWith('pipa-roll-'))continue;
   const ink=[];while(++i<commands.length&&commands[i][0]!=='closeGroup')ink.push(commands[i]);
   const ys=ink.filter(c=>['moveTo','lineTo'].includes(c[0])).map(c=>c[2]);
   let currentY=ink.find(c=>c[0]==='moveTo')?.[2];
   for(const curve of ink.filter(c=>c[0]==='bezierCurveTo')){
    for(let step=0;step<=100;step++){const t=step/100,u=1-t;ys.push(u*u*u*currentY+3*u*u*t*curve[2]+3*u*t*t*curve[4]+t*t*t*curve[6]);}
    currentY=curve[6];
   }
   assert.ok(svg.systems.some(system=>Math.min(...ys)-1>=system.top&&Math.max(...ys)+1<=system.bottom),`${start[1]} is contained: ${grand}/${width}`);
  }
  assert.equal(JSON.stringify(exercise),original,'layout cannot change saved music or playback metadata');
 }
});

test('local roll slurs follow down/mixed stem conventions and reuse an already engraved matching slur',()=>{
 const down=fixture();for(const n of down.events){n.octave++;n.midi+=12;n.key=n.key.replace(/\/(\d)/,(_,octave)=>'/'+(+octave+1));}
 const downBar=prepare(down),downSpan=planPipaRollSpans([downBar])[0];
 assert.ok(downBar.notes.slice(2).every(n=>n.getStemDirection()<0));
 assert.equal(downSpan.slur.above,true);assert.ok(downSpan.slur.controlLift<0);
 const mixed=fixture();Object.assign(mixed.events[4],{key:'c/5',midi:72,octave:5});
 const mixedBar=prepare(mixed),mixedSpan=planPipaRollSpans([mixedBar])[0];
 assert.ok(new Set(mixedBar.notes.slice(2).map(n=>n.getStemDirection())).size>1);
 assert.equal(mixedSpan.slur.above,true,'mixed stems use an upward slur');
 const bar=prepare(fixture()),span=planPipaRollSpans([bar])[0];
 const reused=planPipaRollSpans([bar],[span.slur])[0];
 assert.equal(reused.slur,undefined,'an existing slur on the same notes is not duplicated');
});
