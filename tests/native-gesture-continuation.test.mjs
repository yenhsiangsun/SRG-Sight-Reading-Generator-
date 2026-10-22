import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {loadModule} from './helpers.mjs';
const api=loadModule('src/music/nativeGestureContinuation.ts'),frozen=loadModule('src/music/thematicContinuation.ts');
const {buildPitchMaterial,describeTonality}=loadModule('src/music/scales.ts');
const {PITCH_DIFFICULTY}=loadModule('src/music/pitchDifficulty.ts');
const plain=x=>JSON.parse(JSON.stringify(x));
function fixture({meter='4/4',scale='major',rest=true}={}) {
 const tonality=describeTonality('C',scale),pitches=buildPitchMaterial(tonality,{min:60,max:84}).pitches;
 const totalUnits=meter==='6/8'?12:16;
 const measures=Array.from({length:8},(_,bar)=>({timeSignature:meter,totalUnits,groups:meter==='6/8'?[6,6]:[4,4,4,4],
  events:Array.from({length:totalUnits/2},(_,i)=>({startUnits:i*2,durationUnits:2,duration:'8',dots:0,rest:rest&&i===2,
   midi:60+(bar+i)%12,key:'c/4',octave:4}))}));
 return {measures,pitches,tonality,phrases:frozen.continuationPhrases(8),harmony:[]};
}
const plan=(f,d='intermediate')=>api.planNativeGestureContinuation(f.measures,f.pitches,f.tonality,d,f.phrases,f.harmony,'Sheng');
function legal(p,f,d) {
 assert.ok(p);assert.ok(p.proposalsTried<=3);assert.equal(p.targets.length,f.measures.flatMap(b=>b.events).filter(n=>!n.rest).length);
 p.targets.forEach((t,i)=>{assert.ok(f.pitches.some(n=>n.midi===t.midi));if(i)assert.ok(Math.abs(t.midi-p.targets[i-1].midi)<=PITCH_DIFFICULTY[d].maxLeap);});
 assert.equal(p.targets.at(-1).midi%12,0);assert.ok(Math.abs(p.targets.at(-1).midi-p.targets.at(-2).midi)<=3);
}

test('native whole phrases retain every source event including real rhythms with rests',()=>{
 const f=fixture(),before=JSON.stringify(f),p=plan(f);legal(p,f,'intermediate');
 assert.equal(p.source.eventDegrees.length,p.targets.length);assert.equal(p.sourceIdentity.length,p.targets.length);
 const changes=new Set(p.cadenceChanges.map(c=>c.index));
 for(const m of p.sourceIdentity)if(!changes.has(m.index))assert.equal(m.placedDegree,m.sourceDegree+m.shift);
 assert.equal(JSON.stringify(f),before);assert.ok(p.openingIdentity.length>8,'No reduction to one guide target per pulse');
});

test('major and pentatonic guides preserve grade bounds and valid modal cadences at each tier',()=>{
 for(const scale of ['major','major-pentatonic'])for(const meter of ['4/4','6/8'])for(const d of ['beginner','intermediate','advanced']) {
  const f=fixture({scale,meter});legal(plan(f,d),f,d);
 }
});

test('only declared phrase releases and the final approach can alter native source intervals before the solver',()=>{
 const f=fixture(),p=plan(f);const notes=f.measures.flatMap((b,bar)=>b.events.flatMap(n=>n.rest?[]:[{bar,n}]));
 for(const change of p.cadenceChanges) {
  const m=p.sourceIdentity.find(m=>m.index===change.index),phrase=f.phrases[m.phrase];
  const ending=notes.findLastIndex(n=>n.bar<=phrase.endBar);
  assert.ok(change.index===ending||m.phrase===f.phrases.length-1&&change.index===p.targets.length-2);
  assert.equal(p.targets[change.index].midi,change.after);
 }
 assert.equal(p.targets[0].fixed,true);assert.equal(p.targets.at(-1).fixed,true);assert.equal(p.targets.at(-2).fixed,true);
});

test('whole infeasible source journeys reject instead of clipping or suppressing notes',()=>{
 const f=fixture(),mock={planStudyMelody:(measures,pitches)=>({form:'singing-arch',phrases:[],targets:measures.flatMap(b=>b.events).filter(n=>!n.rest)
  .map((_,index)=>({index,midi:index%2?pitches.at(-1).midi:pitches[0].midi,weight:1}))})};
 const observed=loadModule('src/music/nativeGestureContinuation.ts',1,undefined,{'./studyMelody':mock});
 assert.equal(observed.planNativeGestureContinuation(f.measures,f.pitches,f.tonality,'beginner',f.phrases,[]),undefined);
});

test('a full native phrase continues through a barline and is not made by copying its preceding bar',()=>{
 const f=fixture({rest:false}),p=plan(f),byBar=[];let index=0;
 f.measures.forEach(b=>byBar.push(b.events.filter(n=>!n.rest).map(()=>p.source.eventDegrees[index++])));
 assert.notDeepEqual(plain(byBar[0]),plain(byBar[1]));assert.notDeepEqual(plain(byBar[2]),plain(byBar[3]));
});

test('planning is immutable, deterministic and consumes no global rhythm RNG',()=>{
 const path='src/music/nativeGestureContinuation.ts',f=fixture(),before=JSON.stringify(f);
 const observed=loadModule(path,39,'Math.random=()=>{throw Error("global RNG consumed")};\n'+fs.readFileSync(path,'utf8'));
 assert.deepEqual(plain(observed.planNativeGestureContinuation(f.measures,f.pitches,f.tonality,'intermediate',f.phrases,[],'Sheng')),plain(plan(f)));
 assert.equal(JSON.stringify(f),before);
});

test('unsupported modulation, missing phrase coverage and very short studies do not invent a guide',()=>{
 const f=fixture();f.measures[3].timeSignature='6/8';assert.equal(plan(f),undefined);
 const g=fixture();g.phrases=g.phrases.slice(0,1);assert.equal(plan(g),undefined);
 const h=fixture();h.measures=h.measures.slice(0,2);assert.equal(plan(h),undefined);
});

test('the frozen connector and actual modal solver retain hard scalar 32nd rules without registering this candidate',()=>{
 const pulse=loadModule('src/music/pulseConnectedContinuation.ts'),quality=loadModule('src/music/exerciseQuality.ts');
 for(const meter of ['4/4','6/8']) {
  let chosen;
  const overrides={'./thematicContinuation':{...frozen,continuationTargets:(...args)=>{
   const native=api.planNativeGestureContinuation(...args,'Sheng');chosen=native?pulse.connectPulseTargets(args[0],args[1],args[3],args[4],native):undefined;return chosen?.targets;
  }}};
  const options={instrument:'Sheng',instrumentProfile:'Sheng',clef:'treble',difficulty:'advanced',rhythmLevel:'complex',tonic:'C',keySignature:'C',scaleId:'major',
   measures:8,tempo:80,range:{min:60,max:84},allowAccidentals:false,mixedMeters:false,meters:['4/4','6/8'],timeSignature:meter};
  const ex=loadModule('src/music/composeExercise.ts',97001,undefined,overrides).composeExercise(options,undefined,'thematic-continuation');
  quality.validateGeneratedExercise(ex,options.range,false);assert.ok(chosen);
  const notes=ex.measures.flatMap(b=>b.events).filter(n=>!n.rest),material=buildPitchMaterial(describeTonality('C','major'),options.range).pitches;
  for(let i=1;i<notes.length;i++)if(notes[i].duration==='32'&&notes[i-1].duration==='32')assert.ok(Math.abs(material.findIndex(p=>p.midi===notes[i].midi)-material.findIndex(p=>p.midi===notes[i-1].midi))<=1);
 }
 assert.ok(!fs.readFileSync('src/music/composeExercise.ts','utf8').includes('nativeGestureContinuation'));
 assert.deepEqual(Array.from(loadModule('src/music/phraseStrategy.ts').STUDY_STRATEGIES),['continuous-line','sentence-growth']);
});
