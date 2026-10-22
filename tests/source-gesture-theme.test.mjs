import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadModule} from './helpers.mjs';
const api=loadModule('src/music/sourceGestureTheme.ts');
const {buildPitchMaterial,describeTonality}=loadModule('src/music/scales.ts');
const {planStudyMelody}=loadModule('src/music/studyMelody.ts');
const {continuationPhrases}=loadModule('src/music/thematicContinuation.ts');
const {PITCH_DIFFICULTY}=loadModule('src/music/pitchDifficulty.ts');
const plain=x=>JSON.parse(JSON.stringify(x));
function fixture({hold=false,meter='4/4'}={}) {
  const tonality=describeTonality('C','major'),pitches=buildPitchMaterial(tonality,{min:60,max:96}).pitches;
  const groups=meter==='6/8'?[6,6]:[4,4,4,4],totalUnits=groups.reduce((a,b)=>a+b),durationUnits=hold?8:2;
  const measures=Array.from({length:8},(_,bar)=>({timeSignature:meter,totalUnits,groups,
    events:Array.from({length:totalUnits/durationUnits},(_,i)=>({startUnits:i*durationUnits,durationUnits,duration:hold?'h':'8',dots:0,rest:false,midi:60+(bar+i)%12,key:'c/4',octave:4}))}));
  return {tonality,pitches,measures,phrases:continuationPhrases(8),count:groups.length*2};
}
const build=(f,d='intermediate',draw=.5)=>api.buildSourceGestureTheme(f.measures,f.pitches,f.tonality,d,f.count,()=>draw,'Sheng',f.phrases);

test('a complete two-bar source window retains exact graded event and pulse provenance across its barline',()=>{
  const f=fixture(),theme=build(f),guide=planStudyMelody(f.measures,f.pitches,0,'intermediate','Sheng',f.phrases);
  assert.ok(theme);assert.equal(theme.source.endBar,theme.source.startBar+1);
  assert.equal(theme.degrees.length,f.count);assert.equal(theme.source.form,guide.form);
  const targets=new Map(guide.targets.map(t=>[t.index,t.midi]));
  assert.deepEqual(plain(theme.source.eventMidi),plain(theme.source.eventIndices.map(i=>targets.get(i))));
  assert.deepEqual(plain(theme.source.pulseMidi),plain(theme.source.pulseEventIndices.map(i=>targets.get(i))));
  assert.deepEqual(plain(theme.degrees.map(i=>f.pitches[i].midi)),plain(theme.source.pulseMidi));
  assert.ok(theme.source.eventIndices.length>theme.degrees.length,'Projection is explicitly separate from full event guide');
});

test('held notes cover multiple pulses without inventing new source events',()=>{
  const f=fixture({hold:true}),theme=build(f);assert.ok(theme);
  assert.ok(new Set(theme.source.pulseEventIndices).size<theme.degrees.length);
  for(let i=1;i<theme.degrees.length;i++)if(theme.source.pulseEventIndices[i]===theme.source.pulseEventIndices[i-1])assert.equal(theme.degrees[i],theme.degrees[i-1]);
});

test('a source window never bridges a rest or a phrase boundary',()=>{
  const f=fixture();f.measures.forEach(bar=>bar.events[3].rest=true);assert.equal(build(f),undefined);
  const g=fixture();g.phrases=g.measures.map((_,i)=>({startBar:i,endBar:i,role:i===7?'closing':'opening'}));assert.equal(build(g),undefined);
});

test('an entire source gesture is rejected when its pulse projection exceeds the grade leap limit',()=>{
  const f=fixture(),override={planStudyMelody:()=>({form:'singing-arch',phrases:[{startBar:0,endBar:7,role:'opening',figure:'scale'}],
    targets:f.measures.flatMap(b=>b.events).map((_,index)=>({index,midi:index%4<2?60:96,weight:1}))})};
  const observed=loadModule('src/music/sourceGestureTheme.ts',1,undefined,{'./studyMelody':override});
  assert.equal(observed.buildSourceGestureTheme(f.measures,f.pitches,f.tonality,'beginner',8,()=>0),undefined);
});

test('all accepted grade guides stay in supplied material and within their own hard leap bound',()=>{
  for(const d of ['beginner','intermediate','advanced'])for(const meter of ['4/4','6/8']) {
    const f=fixture({meter}),theme=build(f,d);assert.ok(theme);
    for(const list of [theme.source.eventMidi,theme.source.pulseMidi])list.forEach((n,i)=>{
      assert.ok(f.pitches.some(p=>p.midi===n));if(i)assert.ok(Math.abs(n-list[i-1])<=PITCH_DIFFICULTY[d].maxLeap);
    });
    assert.ok(continuationPhrases(8).some(p=>theme.source.startBar>=p.startBar&&theme.source.endBar<=p.endBar));
  }
});

test('unsupported meter transitions, incomplete theme counts and invalid random draws reject without repair',()=>{
  const f=fixture();assert.equal(api.buildSourceGestureTheme(f.measures,f.pitches,f.tonality,'intermediate',7,()=>0),undefined);
  for(const draw of [-1,1,NaN])assert.equal(build(f,'intermediate',draw),undefined);
  f.measures[3].timeSignature='6/8';assert.equal(build(f),undefined);
});

test('planning is immutable and deterministic, consumes only the supplied window choice, and leaves defaults unregistered',()=>{
  const f=fixture(),before=JSON.stringify(f),path='src/music/sourceGestureTheme.ts';let draws=0;
  const observed=loadModule(path,991,'Math.random=()=>{throw Error("global RNG consumed")};\n'+fs.readFileSync(path,'utf8'));
  const theme=observed.buildSourceGestureTheme(f.measures,f.pitches,f.tonality,'intermediate',f.count,()=>{draws++;return .5;},'Sheng',f.phrases);
  assert.deepEqual(plain(theme),plain(build(f)));assert.equal(draws,1);assert.equal(JSON.stringify(f),before);
  assert.ok(!fs.readFileSync('src/music/composeExercise.ts','utf8').includes('sourceGestureTheme'));
  assert.deepEqual(Array.from(loadModule('src/music/phraseStrategy.ts').STUDY_STRATEGIES),['continuous-line','sentence-growth']);
});

test('dependency injection changes only the theme constructor while retaining whole-phrase feasibility and pulse anchors',()=>{
  const frozen=loadModule('src/music/thematicContinuation.ts'),pulse=loadModule('src/music/pulseConnectedContinuation.ts');
  for(const meter of ['4/4','6/8']) {
    const f=fixture({meter});let source;
    const constructor={...frozen,buildContinuationTheme:(...args)=>{
      source=api.buildSourceGestureTheme(f.measures,...args,'Sheng',f.phrases);return source;
    }};
    const range=loadModule('src/music/rangeBoundContinuation.ts',1,undefined,{'./thematicContinuation':constructor});
    const base=range.planRangeBoundContinuation(f.measures,f.pitches,f.tonality,'intermediate',f.phrases,[]);
    assert.ok(base);assert.ok(source);assert.ok(base.proposalsTried<=12);
    const result=pulse.connectPulseTargets(f.measures,f.pitches,'intermediate',f.phrases,base);assert.ok(result);
    for(const a of result.anchorIdentity)assert.equal(result.targets[a.index].midi,a.midi);
    result.targets.forEach((t,i)=>{assert.ok(f.pitches.some(p=>p.midi===t.midi));if(i)assert.ok(Math.abs(t.midi-result.targets[i-1].midi)<=12);});
    assert.equal(result.targets.at(-1).midi%12,0);
  }
});
