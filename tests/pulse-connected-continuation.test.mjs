import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadModule} from './helpers.mjs';
const api=loadModule('src/music/pulseConnectedContinuation.ts');
const {buildPitchMaterial,describeTonality}=loadModule('src/music/scales.ts');
const {metricPosition}=loadModule('src/music/meterFeel.ts');
const {continuationPhrases}=loadModule('src/music/thematicContinuation.ts');
const {PITCH_DIFFICULTY}=loadModule('src/music/pitchDifficulty.ts');
const plain=x=>JSON.parse(JSON.stringify(x));
function fixture({count=4,rest=false,articulated=false,alternating=false}={}) {
  const pitches=buildPitchMaterial(describeTonality('C','major'),{min:60,max:84}).pitches;
  const measures=Array.from({length:8},(_,bar)=>({timeSignature:'4/4',totalUnits:16,groups:[4,4,4,4],
    events:Array.from({length:count*4},(_,i)=>({startUnits:i*4/count,durationUnits:4/count,duration:count===8?'32':count===4?'16':'8',dots:0,
      rest:rest&&i%count===1,midi:72,key:'c/5',octave:5,...(articulated&&i%count===0?{articulation:'accent'}:{}),fixtureMidi:alternating&&(bar*4+Math.floor(i/count))%2?76:72}))}));
  const notes=measures.flatMap(b=>b.events).filter(n=>!n.rest),targets=notes.map((n,index)=>({index,midi:n.fixtureMidi,weight:3.3,preferredStep:index?0:undefined,stepWeight:2}));
  targets[0].fixed=true;targets.at(-1).fixed=true;targets.at(-2).fixed=true;
  targets.forEach((t,i)=>{if(i)t.preferredStep=pitches.findIndex(p=>p.midi===t.midi)-pitches.findIndex(p=>p.midi===targets[i-1].midi);});
  return {measures,pitches,phrases:continuationPhrases(8),skeleton:{targets,proposalsTried:1,themeBudgetPitches:pitches.length,themeDegrees:[7,7,7,7],phraseShifts:[0,0],openingIdentity:[]}};
}
const connect=(f,d='intermediate')=>api.connectPulseTargets(f.measures,f.pitches,d,f.phrases,f.skeleton);
function assertLegal(plan,f,difficulty='intermediate') {
  const notes=f.measures.flatMap(b=>b.events).filter(n=>!n.rest);
  plan.targets.forEach((t,i)=>{
    const degree=f.pitches.findIndex(p=>p.midi===t.midi);assert.ok(degree>=0);
    if(i){assert.ok(Math.abs(t.midi-plan.targets[i-1].midi)<=PITCH_DIFFICULTY[difficulty].maxLeap);
      if(notes[i].duration==='32'&&notes[i-1].duration==='32')assert.ok(Math.abs(degree-f.pitches.findIndex(p=>p.midi===plan.targets[i-1].midi))<=1);}
  });
  for(const anchor of plan.anchorIdentity)assert.equal(plan.targets[anchor.index].midi,anchor.midi);
}

test('whole-pulse neighbor returns retain every structural anchor and leave most rhythmic repetitions intact',()=>{
  const f=fixture(),plan=connect(f);assertLegal(plan,f);
  assert.ok(plan.connectedGroups.length>0&&plan.connectedGroups.length<=4);
  assert.ok(plan.retainedPlateauGroups>plan.connectedGroups.length);
  assert.ok(plan.connectedGroups.every(g=>g.kind==='neighbor-return'&&g.changedIndices.length===1));
  for(const i of [0,f.skeleton.targets.length-2,f.skeleton.targets.length-1])assert.equal(plan.targets[i].midi,f.skeleton.targets[i].midi);
});

test('a passing cell follows the next strong anchor as a complete in-range scalar gesture',()=>{
  const f=fixture({alternating:true}),plan=connect(f);assertLegal(plan,f);
  assert.ok(plan.connectedGroups.length>0);
  for(const g of plan.connectedGroups) {
    assert.equal(g.kind,'passing');assert.equal(g.after[0],g.before[0]);
    const sign=Math.sign(g.after.at(-1)-g.after[0]);assert.notEqual(sign,0);
    assert.ok(g.after.slice(1).every((n,i)=>(n-g.after[i])*sign>=0));
  }
});

test('two-note rhythmic cells and explicitly articulated repetitions are not forced to move',()=>{
  for(const f of [fixture({count:2}),fixture({articulated:true})]) {
    const plan=connect(f);assert.equal(plan.connectedGroups.length,0);
    assert.deepEqual(plain(plan.targets),plain(f.skeleton.targets));
  }
});

test('connections never cross a rest gap or rewrite phrase releases',()=>{
  const broken=fixture({rest:true}),retained=connect(broken);assert.equal(retained.connectedGroups.length,0);
  const f=fixture(),plan=connect(f),last=[];let index=0;
  f.measures.forEach((bar,b)=>bar.events.forEach(n=>{if(!n.rest){if(f.phrases.some(p=>p.endBar===b))last.push(index);index++;}}));
  for(const phrase of f.phrases) {
    const ending=last.filter(i=>Math.floor(i/16)===phrase.endBar).at(-1);
    assert.equal(plan.targets[ending].midi,f.skeleton.targets[ending].midi);
  }
  for(const group of plan.connectedGroups)for(const i of group.changedIndices)assert.ok(!plan.anchorIdentity.some(a=>a.index===i));
});

test('32nd-note gestures remain scale-adjacent, while a non-scalar baseline guide is retained unchanged',()=>{
  const f=fixture({count:8}),plan=connect(f);assertLegal(plan,f);assert.ok(plan.connectedGroups.length>0);
  const bad=fixture({count:8});bad.skeleton.targets[1].midi=77;
  const result=connect(bad);assert.equal(result.guardedReason,'base-path-not-scalar');
  assert.deepEqual(plain(result.targets),plain(bad.skeleton.targets));assert.equal(result.connectedGroups.length,0);
});

test('planning is immutable, deterministic and never consumes the global rhythm random stream',()=>{
  const f=fixture(),before=JSON.stringify(f),path='src/music/pulseConnectedContinuation.ts';
  const observed=loadModule(path,991,'Math.random=()=>{throw Error("composition RNG consumed")};\n'+fs.readFileSync(path,'utf8'));
  const result=observed.connectPulseTargets(f.measures,f.pitches,'intermediate',f.phrases,f.skeleton);
  assert.deepEqual(plain(result),plain(connect(f)));assert.equal(JSON.stringify(f),before);
});

test('the isolated injected candidate composes legal 4/4 and 6/8 studies while production routing remains frozen',()=>{
  const continuation=loadModule('src/music/thematicContinuation.ts'),quality=loadModule('src/music/exerciseQuality.ts');
  const base={instrument:'Sheng',instrumentProfile:'Sheng',clef:'treble',difficulty:'advanced',rhythmLevel:'complex',keySignature:'C',tonic:'C',
    scaleId:'major',measures:8,tempo:80,range:{min:60,max:84},allowAccidentals:false,mixedMeters:false,meters:['4/4','6/8']};
  for(const meter of ['4/4','6/8']) {
    let planned;
    const overrides={'./thematicContinuation':{...continuation,continuationTargets:(...args)=>{planned=api.planPulseConnectedContinuation(...args);return planned?.targets;}}};
    const result=loadModule('src/music/composeExercise.ts',57037,undefined,overrides).composeExercise({...base,timeSignature:meter},undefined,'thematic-continuation');
    quality.validateGeneratedExercise(result,base.range,false);assert.ok(planned);
    const notes=result.measures.flatMap(b=>b.events).filter(n=>!n.rest);assert.equal(notes.at(-1).midi%12,0);
    let index=0;for(const bar of result.measures)for(const note of bar.events)if(!note.rest){
      if(metricPosition(bar,note.startUnits).onPulse)assert.ok(planned.anchorIdentity.some(a=>a.index===index));index++;
    }
  }
  assert.ok(!fs.readFileSync('src/music/composeExercise.ts','utf8').includes('pulseConnectedContinuation'));
  assert.deepEqual(Array.from(loadModule('src/music/phraseStrategy.ts').STUDY_STRATEGIES),['continuous-line','sentence-growth']);
});
