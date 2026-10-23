import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';
const {addPipaTechniques,validPipaTechnique}=loadModule('src/music/pipaTechniques.ts');
const {validPipaRollGroups}=loadModule('src/music/pipaRollGroups.ts');
const {createPlaybackEvents}=loadModule('src/audio/PlaybackController.ts');
const {forMonophonicAssessment}=loadModule('src/music/notePitches.ts');
const {describeTonality}=loadModule('src/music/scales.ts');
const {validStudy,readLibrary}=loadModule('src/practice/library.ts');
const {readLastPractice}=loadModule('src/practice/resume.ts');
const plain=x=>JSON.parse(JSON.stringify(x));
const note=(midi,startUnits,durationUnits)=>({midi,key:({57:'a/3',60:'c/4',64:'e/4',67:'g/4',69:'a/4'})[midi],octave:Math.floor(midi/12)-1,
  duration:({1:'16',2:'8',3:'8',4:'q',6:'q'})[durationUnits],dots:[3,6].includes(durationUnits)?1:0,startUnits,durationUnits,rest:false});
function fixture(meter='4/4'){
 const compound=meter==='6/8',total=compound?12:16;
 const bar=()=>({timeSignature:meter,totalUnits:total,groups:compound?[6,6]:[4,4,4,4],beamGroups:compound?[6,6]:[4,4,4,4],events:
   compound?[note(60,0,3),note(64,3,3),note(67,6,6)]:[note(60,0,2),note(64,2,2),note(67,4,2),note(64,6,2),note(57,8,1),note(64,9,3),note(60,12,4)]});
 return {instrument:'Sheng',soundProfile:'Pipa',clef:'treble',difficulty:'intermediate',keySignature:'C',timeSignature:meter,rhythmLevel:'complex',tempo:compound?160:80,tonality:describeTonality('C','major'),measures:Array.from({length:4},bar)};
}
const all=score=>score.measures.flatMap(b=>b.events);
const decorate=score=>addPipaTechniques(score,{min:45,max:88},()=>.5);
const study=exercise=>({id:'roll-group',created:1,bpm:80,exercise,settings:{instrument:'Pipa',clef:'treble',difficulty:'Intermediate',rhythmLevel:'Complex',rangeMinMidi:45,rangeMaxMidi:88,keySignature:'C',tonic:'C',scaleId:'major',timeSignature:exercise.timeSignature,measureCount:4,allowAccidentals:false,mixedMeters:false,meters:[exercise.timeSignature],performanceMarks:true}});

test('the complete third and fourth beats can form one roll without lengthening short notes or simplifying the rhythm',()=>{
 const before=fixture(),copy=plain(before),after=decorate(before);
 assert.deepEqual(plain(before),copy);
 const changed=after.measures.filter(b=>b.events.some(n=>n.pipaRollGroup));assert.equal(changed.length,1);
 const bar=changed[0],members=bar.events.filter(n=>n.pipaRollGroup);
 assert.deepEqual(members.map(n=>[n.startUnits,n.durationUnits]),[[8,1],[9,3],[12,4]]);
 assert.ok(members.every(n=>n.technique==='pipa-roll'&&validPipaTechnique(n)));
 assert.deepEqual(plain(members[0].pipaRollGroup),{startUnits:8,endUnits:16});
 assert.ok(validPipaRollGroups(bar,'4/4'));
 all(after).forEach((n,i)=>{for(const key of ['midi','key','duration','dots','durationUnits','startUnits','rest'])assert.equal(n[key],all(before)[i][key]);});
 const standalone={...members[0]};delete standalone.pipaRollGroup;assert.equal(validPipaTechnique(standalone),false);
 assert.ok(all(decorate({...before,rhythmLevel:'medium'})).every(n=>!n.pipaRollGroup),'do not change simpler tiers');
});

test('continuous rolls respect compound pulses and cannot bridge a rest, chord, staccato or tuplet',()=>{
 const compound=decorate(fixture('6/8'));
 assert.ok(compound.measures.some(b=>b.events.some(n=>n.pipaRollGroup?.endUnits===12)));
 assert.ok(compound.measures.every(b=>validPipaRollGroups(b,'6/8')));
 for(const patch of [{rest:true},{articulation:'staccato'},{tuplet:3},{chord:[note(57,0,4),note(64,0,4)]}]){
  const score=fixture();for(const bar of score.measures)Object.assign(bar.events[4],patch);
  assert.ok(all(decorate(score)).every(n=>!n.pipaRollGroup));
 }
});

test('whole-group validation rejects orphan, truncated, overlapping and malformed annotations while saved scores and resume round-trip',()=>{
 const score=decorate(fixture()),saved=study(score);
 assert.ok(validStudy(saved,true));
 assert.deepEqual(plain(readLibrary(JSON.stringify({version:1,scores:[saved],presets:[]})).scores),plain([saved]));
 assert.deepEqual(plain(readLastPractice(JSON.stringify({version:1,study:saved,position:1})).study),plain(saved));
 for(const mutate of [n=>{delete n.technique;},n=>{delete n.pipaRollGroup;},n=>{n.pipaRollGroup.endUnits=12;},n=>{n.pipaRollGroup=null;},n=>{n.pipaRollGroup.startUnits=9;}]){
  const bad=plain(saved),bar=bad.exercise.measures.find(b=>b.events.some(n=>n.pipaRollGroup)),member=bar.events.find(n=>n.pipaRollGroup);mutate(member);
  assert.equal(validStudy(bad,true),false);
 }
});

test('roll playback keeps pitch-change onsets and group boundaries; assessment remains the unchanged plain melody',()=>{
 const before=fixture(),after=decorate(before),written=createPlaybackEvents(before,80),audio=createPlaybackEvents(after,80,true);
 assert.equal(audio.duration,written.duration);
 assert.ok(audio.events.every(e=>e.time>=0&&e.time+e.duration<=audio.duration+1e-9));
 const barIndex=after.measures.findIndex(b=>b.events.some(n=>n.pipaRollGroup));
 const group=after.measures[barIndex].events.filter(n=>n.pipaRollGroup);
 for(const n of group){
  const start=(barIndex*16+n.startUnits)*.1875,end=start+n.durationUnits*.1875;
  const sounds=audio.events.filter(e=>e.time>=start-1e-9&&e.time<end-1e-9);
  assert.ok(sounds.some(e=>Math.abs(e.time-start)<1e-9&&e.note===n.key.replace('/','')),'retain every written pitch-change onset');
  assert.ok(sounds.every(e=>e.time+e.duration<=end+1e-9),'no previous pitch bleeds through the next written note');
 }
 const assessed=forMonophonicAssessment(after);
 assert.ok(all(assessed).every(n=>!n.technique&&!n.pipaRollGroup));
 assert.deepEqual(plain(createPlaybackEvents(assessed,80)),plain(createPlaybackEvents(forMonophonicAssessment(before),80)));
});
