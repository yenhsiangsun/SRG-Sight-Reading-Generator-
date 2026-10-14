import test from 'node:test';
import assert from 'node:assert/strict';
import * as VF from 'vexflow';
import {loadModule} from './helpers.mjs';

globalThis.document={createElement:()=>({style:{fontFamily:'Bravura',fontSize:'30px',fontWeight:'normal',fontStyle:'normal',
  set font(value){const match=value.match(/([\d.]+(?:px|pt))\s+(.+)$/);if(match){this.fontSize=match[1];this.fontFamily=match[2];}}}})};
VF.Element.setTextMeasurementCanvas({getContext:()=>({measureText:text=>({width:text.length*8,actualBoundingBoxLeft:0,
  actualBoundingBoxRight:text.length*8,actualBoundingBoxAscent:12,actualBoundingBoxDescent:3,fontBoundingBoxAscent:12,fontBoundingBoxDescent:3})})});
const {createMeasureNotation,prepareNotationForDrawing}=loadModule('src/notation/createMeasureNotation.ts',1,undefined,{'vexflow':VF});
const {simplifyStaffRests}=loadModule('src/notation/simplifyStaffRests.ts');
const {planExpressionDrawing,drawExpressionSpans,expressionOverflow}=loadModule('src/notation/expressionSpans.ts');
const {drawOctaveLines}=loadModule('src/notation/octaveLines.ts');
const bar=(keys,unit=2)=>({totalUnits:16,timeSignature:'4/4',groups:[4,4,4,4],beamGroups:[4,4,4,4],events:keys.map((key,i)=>({
  key:key??'b/4',octave:Number(key?.split('/')[1]??4),rest:!key,duration:unit===2?'8':'q',dots:0,startUnits:i*unit,durationUnits:unit,
}))});
const prepare=(source,index,row,staff=0)=>{
  const measure=simplifyStaffRests(source,'4/4');
  const notation=createMeasureNotation(measure,staff===0?'treble':'bass','C','4/4');
  const stave=new VF.Stave(10+(index%2)*420,row*240+30,420).addClef(staff===0?'treble':'bass');
  new VF.Formatter().joinVoices([notation.voice]).format([notation.voice],320);
  prepareNotationForDrawing(notation,stave);
  return {bar:index,row,staff,stave,notes:notation.notes,measure};
};
const context=()=>{
  const commands=[],ctx={commands};
  for(const method of ['save','restore','openGroup','closeGroup','setFillStyle','setStrokeStyle','setLineWidth','setLineDash','setFont',
    'beginPath','moveTo','lineTo','bezierCurveTo','closePath','fill','stroke','fillText'])ctx[method]=(...args)=>{commands.push([method,...args]);return ctx;};
  ctx.measureText=text=>({width:text.length*7});return ctx;
};
const center=note=>(note.getNoteHeadBeginX()+note.getNoteHeadEndX())/2;
const paintedY=(path,curve,x)=>{
  const t=(x-path.xStart)/(path.xEnd-path.xStart),u=1-t;
  return u*u*u*path.startY+3*u*u*t*curve[2]+3*u*t*t*curve[4]+t*t*t*path.endY;
};
function paintedCurves(exercise,bars) {
  const paths=planExpressionDrawing(exercise,bars),ctx=context();drawExpressionSpans(ctx,exercise,bars);
  return paths.map((path,index)=>({path,curve:ctx.commands.filter(command=>command[0]==='bezierCurveTo')[index*2]}));
}

test('original event anchors survive rest consolidation and slurs continue across score systems',()=>{
  const exercise={timeSignature:'4/4',measures:[bar([null,null,'g/5','a/5','b/5','a/5','g/5','f/5']),bar(['e/5','d/5','c/5','d/5','e/5','f/5','g/5','c/5'])],
    expressionSpans:[{kind:'slur',staff:0,start:{bar:0,event:2},end:{bar:1,event:2}}]};
  const bars=exercise.measures.map((measure,index)=>prepare(measure,index,index));
  assert.equal(bars[0].notes.length,7,'two quarter-beat rests become one engraved rest');
  const paths=planExpressionDrawing(exercise,bars);assert.equal(paths.length,2);
  assert.equal(paths[0].xStart,center(bars[0].notes[1]));assert.equal(paths[1].xEnd,center(bars[1].notes[2]));
  assert.equal(paths[0].xEnd,bars[0].stave.getNoteEndX()-5);assert.equal(paths[1].xStart,bars[1].stave.getNoteStartX()-6);
  assert.ok(paths.every(path=>path.above),'stem-down phrases place slurs above noteheads');
  const ctx=context();drawExpressionSpans(ctx,exercise,bars);
  assert.equal(ctx.commands.filter(command=>command[0]==='bezierCurveTo').length,4,'each system has a tapered continuation curve');
  assert.deepEqual(exercise.expressionSpans[0].start,{bar:0,event:2});
});

test('slur curves clear inner noteheads and hairpins stay below beams, numerals and expression',()=>{
  const exercise={timeSignature:'4/4',measures:[bar(['c/4','d/4','g/4','c/5','b/4','g/4','f/4','e/4'])],expressionSpans:[
    {kind:'crescendo',staff:0,start:{bar:0,event:0},end:{bar:0,event:7}},
    {kind:'slur',staff:0,start:{bar:0,event:0},end:{bar:0,event:7}}]};
  const bars=[prepare(exercise.measures[0],0,0)];
  const paths=planExpressionDrawing(exercise,bars),slur=paths.find(path=>path.kind==='slur'),hairpin=paths.find(path=>path.kind==='crescendo');
  for(const note of bars[0].notes){
    const t=(center(note)-slur.xStart)/(slur.xEnd-slur.xStart),y=slur.startY+(slur.endY-slur.startY)*t+3*t*(1-t)*slur.controlLift;
    assert.ok(slur.above?y<Math.min(...note.getYs())-5:y>Math.max(...note.getYs())+5);
  }
  assert.ok(hairpin.bounds.yTop>slur.bounds.yBottom+8);assert.equal(hairpin.startOpening,0);assert.equal(hairpin.endOpening,7);
  const svg=context(),canvas=context();drawExpressionSpans(svg,exercise,bars);drawExpressionSpans(canvas,exercise,bars);
  assert.deepEqual(svg.commands,canvas.commands,'SVG and PDF surfaces receive identical expression engraving');
});

test('octave indications clear expression bounds without changing notes or written octave displacement',()=>{
  const source=bar(['c/6','d/6','e/6','f/6'],4),rendered=prepare(source,0,0),ctx=context();
  const before=rendered.notes.map(note=>note.getKeys());
  drawOctaveLines(ctx,[{...rendered,shifts:[1,1,1,1],expressionBounds:[{xStart:90,xEnd:400,yTop:-45,yBottom:220}]}]);
  const label=ctx.commands.find(command=>command[0]==='fillText');assert.equal(label[1],'8va');assert.ok(label[3]<=-59);
  assert.deepEqual(rendered.notes.map(note=>note.getKeys()),before);
});

test('a mixed-stem phrase chooses a clear arc around its stem-down triplet and hairpin',()=>{
  const source=bar(['g/5','f/5','e/5','c/4','d/4','c/4'],4);
  source.totalUnits=16;
  source.events.slice(0,3).forEach((note,index)=>Object.assign(note,{duration:'8',tuplet:3,startUnits:index*4/3,durationUnits:4/3}));
  source.events.slice(3).forEach((note,index)=>{note.startUnits=4+index*4;});
  const exercise={timeSignature:'4/4',measures:[source],expressionSpans:[
    {kind:'slur',staff:0,start:{bar:0,event:0},end:{bar:0,event:5}},
    {kind:'diminuendo',staff:0,start:{bar:0,event:0},end:{bar:0,event:5}}]};
  const bars=[prepare(source,0,0)],paths=planExpressionDrawing(exercise,bars),slur=paths.find(path=>path.kind==='slur'),hairpin=paths.find(path=>path.kind==='diminuendo');
  const tuplet=bars[0].notes[0].getTuplet();assert.ok(tuplet);
  const note=bars[0].notes[1],t=(center(note)-slur.xStart)/(slur.xEnd-slur.xStart);
  const y=slur.startY+(slur.endY-slur.startY)*t+3*t*(1-t)*slur.controlLift;
  assert.ok(slur.above?y<Math.min(...note.getYs())-5:y>tuplet.getYPosition()+12);assert.ok(hairpin.bounds.yTop>slur.bounds.yBottom+8);
});

test('long mixed-stem phrases clear actual stems and beams on one or two systems',()=>{
  const keys=['c/4','e/4','g/4','c/5','e/5','g/5','b/5','a/5','f/5','d/5','b/4','g/4','f/4','e/4','d/4','c/4'];
  const source=[bar(keys.slice(0,8)),bar(keys.slice(8))];
  const exercise={timeSignature:'4/4',measures:source,expressionSpans:[{kind:'slur',staff:0,start:{bar:0,event:0},end:{bar:1,event:7}}]};
  for (const split of [false,true]) {
    const bars=source.map((measure,index)=>prepare(measure,index,split?index:0)),painted=paintedCurves(exercise,bars);
    assert.equal(painted.length,split?2:1);assert.equal(new Set(painted.map(({path})=>path.above)).size,1,'continuation keeps the same side');
    for (const {path,curve} of painted) for (const entry of bars.filter(bar=>bar.row===path.row)) {
      for (const note of entry.notes) {
        const x=note.getStemX();if(x<=path.xStart||x>=path.xEnd)continue;
        const y=paintedY(path,curve,x),stem=note.getStemExtents();
        const edge=path.above?Math.min(...note.getYs(),stem.topY,stem.baseY):Math.max(...note.getYs(),stem.topY,stem.baseY);
        assert.ok(path.above?y<edge-4:y>edge+4,`stem clearance ${split} ${path.above} ${x} ${y} ${edge}`);
      }
      const beams=[...new Set(entry.notes.map(note=>note.getBeam()).filter(Boolean))];
      for(const beam of beams){
        const members=beam.getNotes(),first=members[0],last=members.at(-1),x1=first.getStemX(),x2=last.getStemX();
        for(let step=0;step<=10;step++) {
          const x=x1+(x2-x1)*step/10;if(x<=path.xStart||x>=path.xEnd)continue;
          const beamY=first.getStemExtents().topY+(last.getStemExtents().topY-first.getStemExtents().topY)*step/10;
          const y=paintedY(path,curve,x);
          assert.ok(path.above?y<beamY-5:y>beamY+5,`beam clearance ${split} ${path.above}`);
        }
      }
    }
  }
});

test('painted steep arcs follow the checked baseline and exact bounds, and overflow asks for only necessary room',()=>{
  const exercise={timeSignature:'4/4',measures:[bar(['c/4','d/4','g/4','a/4','b/4','c/5','d/5','g/5'])],
    expressionSpans:[{kind:'slur',staff:0,start:{bar:0,event:0},end:{bar:0,event:7}}]};
  const bars=[prepare(exercise.measures[0],0,0)],{path,curve}=paintedCurves(exercise,bars)[0];
  for (let step=0;step<=100;step++) {
    const x=path.xStart+(path.xEnd-path.xStart)*step/100,y=paintedY(path,curve,x);
    assert.ok(y>=path.bounds.yTop&&y<=path.bounds.yBottom);
    const outer=y+3*(path.above?-3:3)*(step/100)*(1-step/100);
    assert.ok(outer>=path.bounds.yTop&&outer<=path.bounds.yBottom);
  }
  const okay=expressionOverflow([path],[{top:path.bounds.yTop-12,bottom:path.bounds.yBottom+12}]);assert.deepEqual(JSON.parse(JSON.stringify(okay)),{above:0,below:0});
  const tight=expressionOverflow([path],[{top:path.bounds.yTop-2,bottom:path.bounds.yBottom+2}]);assert.deepEqual(JSON.parse(JSON.stringify(tight)),{above:10,below:10});
});

test('single and grand score layout returns final contained systems with identical SVG and PDF geometry',()=>{
  const calls=[];
  const scoreContext=(container,width,height,viewport)=>{
    const ctx=context();ctx.getFont=()=> '10px Arial';
    calls.push({container,width,height,viewport,commands:ctx.commands});
    return new Proxy(ctx,{get(target,key){if(key in target)return target[key];return ()=>ctx;}});
  };
  const {drawSingleScore}=loadModule('src/notation/drawSingleScore.ts',1,undefined,{'vexflow':VF,'./scoreRenderer':{scoreContext}});
  const {drawGrandScore}=loadModule('src/notation/drawGrandScore.ts',1,undefined,{'vexflow':VF,'./scoreRenderer':{scoreContext}});
  const keys=['c/4','g/4','c/5','e/5','g/5','a/5','b/5','a/5','g/5','f/5','e/5','d/5','c/5','g/4','e/4','c/4'];
  const exercise={timeSignature:'4/4',clef:'treble',keySignature:'C',measures:[bar(keys.slice(0,8)),bar(keys.slice(8))],expressionSpans:[
    {kind:'slur',staff:0,start:{bar:0,event:0},end:{bar:1,event:7}},
    {kind:'diminuendo',staff:0,start:{bar:0,event:6},end:{bar:1,event:7}}]};
  for (const grand of [false,true]) for (const width of [600,1000]) {
    const ex=grand?{...exercise,grandMode:'two-hand',lowerMeasures:[bar(['c/3','e/3','g/3','c/4','g/3','e/3','g/3','c/3']),
      bar(['c/3','e/3','g/3','c/4','g/3','e/3','g/3','c/3'])]}:exercise;
    const draw=grand?drawGrandScore:drawSingleScore,container={replaceChildren(){},querySelector(){return {setAttribute(){}}}};
    const first=calls.length,screen=draw(container,ex,width);
    assert.ok(calls.length-first<=2,'correction redraw is bounded');
    const second=calls.length,pdf=draw(container,ex,width,{sourceY:0,sourceHeight:screen.height,pixelRatio:1});
    assert.ok(calls.length-second<=2,'PDF correction redraw is bounded');
    assert.deepEqual(JSON.parse(JSON.stringify(pdf)),JSON.parse(JSON.stringify(screen)));
    assert.equal(calls.at(-1).height,screen.height);
    assert.ok(screen.systems.every(system=>system.top>=0&&system.bottom<=screen.height));
    const commands=calls.at(-1).commands;
    for(let index=0;index<commands.length;index++) {
      const command=commands[index];if(command[0]!=='openGroup'||!String(command[1]).startsWith('expression-'))continue;
      const ink=[];
      while(++index<commands.length&&commands[index][0]!=='closeGroup')ink.push(commands[index]);
      const ys=[];
      if(command[1]==='expression-slur') {
        const first=ink.find(item=>item[0]==='moveTo'),curves=ink.filter(item=>item[0]==='bezierCurveTo');
        let startY=first[2];
        for(const curve of curves) {
          for(let step=0;step<=50;step++) {const t=step/50,u=1-t;ys.push(u*u*u*startY+3*u*u*t*curve[2]+3*u*t*t*curve[4]+t*t*t*curve[6]);}
          startY=curve[6];
        }
      } else for(const item of ink) if(item[0]==='moveTo'||item[0]==='lineTo')ys.push(item[2]);
      assert.ok(screen.systems.some(system=>Math.min(...ys)-.35>=system.top&&Math.max(...ys)+.35<=system.bottom),
        `painted ${command[1]} stays within a complete PDF system: ${grand} ${width}`);
    }
  }
});
