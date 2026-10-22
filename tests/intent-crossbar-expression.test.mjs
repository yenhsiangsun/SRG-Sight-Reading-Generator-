import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';
const {addIntentExpression}=loadModule('src/music/intentExpression.ts');
const {describeTonality}=loadModule('src/music/scales.ts');
const plain=x=>JSON.parse(JSON.stringify(x));
const note=(midi,startUnits,durationUnits=4,extra={})=>({midi,key:`${['c','c#','d','d#','e','f','f#','g','g#','a','a#','b'][midi%12]}/${Math.floor(midi/12)-1}`,octave:Math.floor(midi/12)-1,startUnits,durationUnits,duration:durationUnits===16?'w':durationUnits===2?'8':'q',dots:0,rest:false,...extra});
const bar=events=>({timeSignature:'4/4',totalUnits:16,groups:[4,4,4,4],beamGroups:[4,4,4,4],events});
function fixture(){
 const phrase={startBar:0,endBar:2,role:'opening',cadence:'home',gesture:'present',peak:.5};
 return {instrument:'Piano',soundProfile:'Piano',difficulty:'intermediate',timeSignature:'4/4',keySignature:'C',tonality:describeTonality('C','major'),grandMode:'two-hand',phrasePlan:[phrase],musicalIntent:{grammar:'classical',phrases:[phrase]},
  measures:[bar([note(72,0),note(76,4),note(79,8),note(76,12,2),note(77,14,2)]),bar([note(79,0),note(76,4),note(74,8),note(76,12,2),note(74,14,2)]),bar([note(72,0,16)])],
  lowerMeasures:[bar([note(48,0,16)]),bar([note(55,0,16)]),bar([note(48,0,16)])]};
}
const sound=n=>{const {articulation:_articulation,dynamic:_dynamic,...rest}=n;return rest;};
test('a gap-free rising or falling pickup remains joined across the bar inside its complete phrase',()=>{
 const input=fixture(),snapshot=JSON.stringify(input),result=addIntentExpression(input);
 assert.equal(JSON.stringify(input),snapshot,'source stays immutable');
 assert.equal(result.measures[0].events.at(-1).articulation,undefined,'F to G continues instead of being cut only at the barline');
 assert.equal(result.measures[1].events.at(-1).articulation,undefined,'D to C joins the final arrival');
 assert.equal(result.measures[2].events[0].articulation,'tenuto','the actual phrase ending keeps its arrival');
 assert.deepEqual(plain(result.measures.map(b=>b.events.map(sound))),plain(input.measures.map(b=>b.events.map(sound))),'pitches, rhythm and addresses stay intact');
 for(const [b,measure] of result.lowerMeasures.entries())assert.deepEqual(plain(measure.events.map(sound)),plain(input.lowerMeasures[b].events.map(sound)),'accompaniment remains the same');
});
test('repeated, leaping, interrupted and special playing gestures retain their detached ending',()=>{
 const stories=[
  ex=>{ex.measures[1].events[0]=note(77,0);},
  ex=>{ex.measures[1].events[0]=note(84,0);},
  ex=>{ex.measures[1].events[0]=note(79,0,4,{rest:true,midi:undefined});},
  ex=>{ex.measures[0].events.at(-1).technique='tremolo';},
  ex=>{ex.measures[0].events.at(-1).chord=[{midi:72}];},
 ];
 for(const change of stories){const ex=fixture();change(ex);assert.equal(addIntentExpression(ex).measures[0].events.at(-1).articulation,'staccato');}
 const ex=fixture();ex.measures[0].events.at(-1).rest=true;
 assert.equal(addIntentExpression(ex).measures[0].events.at(-2).articulation,'staccato','a real end-of-bar rest remains a release');
});
