import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

const plain=x=>JSON.parse(JSON.stringify(x));
const {addPipaRollRhythm}=loadModule('src/music/pipaRollRhythm.ts');
const options={instrumentProfile:'Pipa',rhythmLevel:'complex',range:{min:45,max:88}};
const phrases=[{startBar:0,endBar:3,role:'opening'},{startBar:4,endBar:7,role:'closing'}];
const fixture=()=>Array.from({length:8},()=>({meter:'4/4',notes:Array.from({length:16},(_,i)=>({units:1,startUnits:i,rest:false,duration:'16',dots:0}))}));
const activity=plan=>{const notes=plan.flatMap(b=>b.notes).filter(n=>!n.rest);return {attacks:notes.length,shortShare:notes.filter(n=>n.units<=1).length/notes.length};};

test('one occasional interior hold precedes pitch composition and preserves the surrounding difficult rhythm',()=>{
 const source=fixture(),before=plain(source),result=addPipaRollRhythm(source,options,phrases,()=>0);
 assert.deepEqual(plain(source),before,'do not mutate the original rhythm');
 assert.equal(result.filter((b,i)=>b!==source[i]).length,1);
 assert.equal(result[0],source[0]);assert.equal(result.at(-1),source.at(-1));
 assert.equal(result[3],source[3],'do not rewrite an existing phrase cadence');
 const holds=result.flatMap((b,bar)=>b.notes.flatMap(n=>n.units>=4?[{bar,...n}]:[]));
 assert.equal(holds.length,1);assert.equal(holds[0].units,4);assert.ok(holds[0].bar>0&&holds[0].bar<7);
 assert.ok(activity(result).attacks>=activity(source).attacks*.9);
 assert.equal(addPipaRollRhythm(source,options,phrases,()=>.8),source,'some scores retain the full original motion');
 for(const patch of [{instrumentProfile:'Sheng'},{rhythmLevel:'simple'},{rhythmLevel:'medium'},{rhythmFocus:'sixteenths'},{rhythmFocus:['dotted','offbeats']},{pitchFocus:'scales'},{range:{min:45,max:56}}]){
  assert.equal(addPipaRollRhythm(source,{...options,...patch},phrases,()=>{throw Error('unsupported option consumed RNG');}),source);
 }
 const spacious=fixture();spacious[2].notes=[{units:4,startUnits:0,rest:false,duration:'q',dots:0},...spacious[2].notes.slice(4)];
 assert.equal(addPipaRollRhythm(spacious,options,phrases,()=>{throw Error('existing hold consumed RNG');}),spacious);
});

test('ordinary forms and all meters retain exact ticks, rests, tuplets and most subdivision with at most one added hold',()=>{
 const {planMusicalIntent}=loadModule('src/music/musicalIntent.ts');
 const {assertMeasureRhythm}=loadModule('src/music/rhythmTiming.ts');
 let changed=0;
 for(const compositionStyle of ['classical','lyrical','pentatonic'])for(const timeSignature of ['2/4','3/4','4/4','5/4','3/8','6/8','7/8','9/8','12/8'])for(const variant of [.1,.35,.6,.85]){
  const intent=planMusicalIntent({...options,compositionStyle,timeSignature,measures:8,keySignature:'C',scaleId:compositionStyle==='pentatonic'?'major-pentatonic':'major'},()=>variant);
  const source=intent.rhythm,before=plain(source),result=addPipaRollRhythm(source,options,intent.phrases,()=>0);
  assert.deepEqual(plain(source),before);
  const bars=result.flatMap((b,i)=>b!==source[i]?[i]:[]);assert.ok(bars.length<=1);
  if(bars.length){changed++;assert.ok(![0,7,...intent.phrases.map(p=>p.endBar)].includes(bars[0]));}
  assert.deepEqual(plain(result.flatMap(b=>b.notes.filter(n=>n.rest||n.tuplet))),plain(source.flatMap(b=>b.notes.filter(n=>n.rest||n.tuplet))));
  assert.ok(activity(result).attacks>=activity(source).attacks*.9);
  if(bars.length)assert.ok(activity(result).shortShare>=.55);
  const [top,bottom]=timeSignature.split('/').map(Number);
  for(const bar of result)assertMeasureRhythm({events:bar.notes.map(n=>({...n,durationUnits:n.units})),totalUnits:top*16/bottom},timeSignature);
 }
 assert.ok(changed>=40,'exercise actual /4 and /8 opportunities, not only identity cases');
});

test('new opportunities keep pitch grades independent, legal fingering and strict final playback through the actual pipeline',()=>{
 const bridge=`export {composeExercise} from './composeExercise';export {addInstrumentHarmony} from './instrumentHarmony';export {addPerformanceMarks} from './performanceMarks';export {addPipaTechniques} from './pipaTechniques';export {validateGeneratedExercise} from './exerciseQuality';export {validPipaTechnique} from './pipaTechniques';export {createPlaybackEvents} from '../audio/PlaybackController';`;
 const timing=ex=>JSON.stringify(ex.measures.map(b=>b.events.map(n=>[n.startUnits,n.durationUnits,n.rest,n.tuplet])));
 let interiorRolls=0;
 for(const compositionStyle of ['classical','pentatonic'])for(const timeSignature of ['4/4','6/8'])for(const seed of [79001,79007]){
  let reference;
  for(const difficulty of ['beginner','intermediate','advanced']){
   const api=loadModule('src/music/__pipaRhythmPipeline.ts',seed,bridge);
   const o={...options,instrument:'Sheng',compositionStyle,clef:'treble',difficulty,keySignature:'C',tonic:'C',scaleId:compositionStyle==='pentatonic'?'major-pentatonic':'major',timeSignature,measures:8,tempo:80,allowAccidentals:false,mixedMeters:false,meters:['4/4','6/8']};
   let ex=api.composeExercise(o);reference??=timing(ex);assert.equal(timing(ex),reference);
   ex=api.addPipaTechniques(api.addPerformanceMarks(api.addInstrumentHarmony({...ex,soundProfile:'Pipa'},o.range)),o.range);
   api.validateGeneratedExercise(ex,o.range,false);
   assert.equal(timing(ex),reference,'decorations do not rewrite the planned rhythm');
   if(ex.measures.slice(1,-1).some(b=>b.events.some(n=>n.technique==='pipa-roll')))interiorRolls++;
   for(const n of ex.measures.flatMap(b=>b.events))if(n.technique){assert.ok(api.validPipaTechnique(n));assert.ok(!['pipa-brush','pipa-arpeggio'].includes(n.technique));if(n.technique==='pipa-roll')assert.ok(n.durationUnits>=4||n.pipaRollGroup);}
   assert.equal(api.createPlaybackEvents(ex,80,true).duration,api.createPlaybackEvents(ex,80).duration);
   assert.ok(ex.measures.flatMap(b=>b.events).filter(n=>n.duration==='32').length<=4);
  }
 }
 assert.ok(interiorRolls>=4,'the completed pipeline must actually retain some interior rolls');
});
