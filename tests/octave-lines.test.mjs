import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';
const {planOctaveLines, octaveWrittenKey, ledgerCount, drawOctaveLines} = loadModule('src/notation/octaveLines.ts');
const bar = keys => ({events:keys.map((key,index)=>({key,rest:key==='r',midi:90,startUnits:index*4,durationUnits:4,duration:'q',dots:0})),totalUnits:keys.length*4});

test('octave notation reduces extreme ledger lines in every clef without changing source pitches or timing',()=>{
  for(const clef of ['treble','bass','alto','tenor']) {
    const measures=[bar(['a/0','c/2','c/4','f#/6','bb/7','c/8'])];
    const before=JSON.stringify(measures);
    const shifts=planOctaveLines(measures,clef)[0];
    measures[0].events.forEach((event,index)=>{
      assert.ok([0,1,-1].includes(shifts[index]));
      const bestPossible=Math.min(...[0,1,-1].map(shift=>ledgerCount(event.key,clef,shift)));
      assert.ok(ledgerCount(event.key,clef,shifts[index])<=Math.max(3,bestPossible), `${clef} ${event.key}`);
      const written=octaveWrittenKey(event.key,shifts[index]);
      assert.equal(written.split('/')[0],event.key.split('/')[0]);
      assert.equal(Number(written.split('/')[1])+shifts[index],Number(event.key.split('/')[1]));
    });
    assert.equal(JSON.stringify(measures),before);
  }
});

test('ordinary notes retain original notation; sustained high and low passages share octave instructions',()=>{
  assert.equal(planOctaveLines([bar(['a/0','a/0'])],'bass')[0][0],-1);
  assert.equal(planOctaveLines([bar(['c/8','c/8'])],'treble')[0][0],1);
  assert.deepEqual(Array.from(planOctaveLines([bar(['c/4','e/4','g/4','c/5'])],'treble')[0]),[0,0,0,0]);
  for(const [clef,key,sign] of [['treble','c/7',1],['bass','a/0',-1]]) {
    const shifts=planOctaveLines([bar([key,key,'r',key]),bar([key,key,key,key])],clef).flat();
    assert.ok(shifts.every(value=>Math.sign(value)===sign));
    assert.equal(new Set(shifts).size,1);
  }
  assert.deepEqual(Array.from(planOctaveLines([bar(['r','r'])],'treble')[0]),[0,0]);
});

test('octave brackets join barlines, repeat at a new system and terminate when original register returns',()=>{
  const texts=[], paths=[];
  const context=new Proxy({}, {get:(_,method)=>(...args)=>{
    if(method==='fillText')texts.push(args[0]);
    if(method==='moveTo'||method==='lineTo')paths.push(args);
    if(method==='measureText')return {width:24};
    return context;
  }});
  const stave={getYForLine:line=>100+line*10,getNoteEndX:()=>450};
  const note=x=>({getAbsoluteX:()=>x,getTuplet:()=>undefined,getBoundingBox:()=>({getY:()=>90,getH:()=>45})});
  drawOctaveLines(context,[
    {notes:[note(100),note(200)],shifts:[1,1],stave,row:0},
    {notes:[note(300),note(400)],shifts:[1,1],stave,row:0},
    {notes:[note(100),note(200)],shifts:[1,0],stave,row:1},
  ]);
  assert.deepEqual(texts,['8va','(8va)']);
  assert.ok(paths.some(([x])=>x===450));
});

test('adjacent octave labels on short notes occupy separate vertical lanes',()=>{
  const labels=[];
  const context=new Proxy({}, {get:(_,method)=>(...args)=>{
    if(method==='fillText')labels.push(args);
    if(method==='measureText')return {width:34};
    return context;
  }});
  const stave={getYForLine:line=>100+line*10,getNoteEndX:()=>450};
  const notes=[100,110,120,130,150].map(x=>({getAbsoluteX:()=>x,getTuplet:()=>undefined,getBoundingBox:()=>({getY:()=>90,getH:()=>45})}));
  drawOctaveLines(context,[{notes,shifts:[1,0,1,0,1],stave,row:0}]);
  assert.deepEqual(labels.map(label=>label[0]),['8va','8va','8va']);
  for(let i=1;i<labels.length;i++) assert.ok(Math.abs(labels[i][2]-labels[i-1][2])>=18);
});
