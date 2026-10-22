import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadModule} from './helpers.mjs';

const plain=value=>JSON.parse(JSON.stringify(value));
const {describeTonality,buildPitchMaterial}=loadModule('src/music/scales.ts');
const {notePitches,midiFromKey}=loadModule('src/music/notePitches.ts');
const {metricPosition}=loadModule('src/music/meterFeel.ts');
const {validateGeneratedExercise}=loadModule('src/music/exerciseQuality.ts');
const {createPlaybackEvents}=loadModule('src/audio/PlaybackController.ts');
const names=['c','c#','d','d#','e','f','f#','g','g#','a','a#','b'];
const range={min:36,max:84};
const base={instrument:'Piano',instrumentProfile:'Piano',clef:'treble',difficulty:'intermediate',keySignature:'C',
  tonic:'C',scaleId:'major',timeSignature:'4/4',rhythmLevel:'medium',measures:4,tempo:80,range,
  allowAccidentals:false,mixedMeters:false,meters:['4/4','6/8']};

function note(midi,startUnits,durationUnits,extra={}) {
  const octave=Math.floor(midi/12)-1;
  return {midi,key:`${names[midi%12]}/${octave}`,octave,startUnits,durationUnits,
    duration:durationUnits===16?'w':durationUnits===8?'h':durationUnits>=4?'q':durationUnits===1?'16':'8',
    dots:durationUnits===6?1:0,rest:false,...extra};
}
const bar=(events,meter='4/4')=>({timeSignature:meter,totalUnits:meter==='6/8'?12:16,
  groups:meter==='6/8'?[6,6]:[4,4,4,4],beamGroups:meter==='6/8'?[6,6]:[4,4,4,4],events});

function fixture() {
  return {...base,tonality:describeTonality('C','major'),grandMode:'two-hand',soundProfile:'Piano',
    measures:[bar([72,76,79,76].map((m,i)=>note(m,i*4,4))),
      bar([note(77,0,6),note(76,6,2),note(74,8,2),note(72,10,2)],'6/8'),
      bar([note(74,0,4),note(71,4,4),note(72,8,8)])],
    lowerMeasures:[bar([note(59,0,16)]),
      bar([note(53,0,2,{rest:true,midi:undefined}),note(57,2,4),note(53,6,6)],'6/8'),
      bar([note(53,0,8),note(59,8,8)])],
    harmonyPlan:[{root:0,pitches:[0,4,7],role:'home'},{root:5,pitches:[5,9,0],role:'depart'},
      {root:0,pitches:[0,4,7],role:'arrive'}]};
}

const rhythm=exercise=>plain([exercise.measures,exercise.lowerMeasures??[]].map(staff=>staff.map(measure=>({
  meter:measure.timeSignature,totalUnits:measure.totalUnits,groups:measure.groups,beamGroups:measure.beamGroups,
  events:measure.events.map(n=>({start:n.startUnits,units:n.durationUnits,duration:n.duration,dots:n.dots,
    rest:n.rest,tuplet:n.tuplet,measureRest:n.measureRest})),
}))));
const sounding=staff=>staff.flatMap(measure=>measure.events).filter(n=>!n.rest);

function assertLegalBass(exercise,selectedRange=range,scalar=false) {
  validateGeneratedExercise(exercise,selectedRange,false);
  const material=buildPitchMaterial(exercise.tonality,{min:selectedRange.min,max:59});
  const available=material.pitches.map(p=>p.midi);
  const notes=sounding(exercise.lowerMeasures);
  assert.ok(notes.length);
  for(const n of notes) {
    assert.ok(available.includes(n.midi),`bass ${n.midi} belongs to its selected register and mode`);
    assert.equal(midiFromKey(n.key),n.midi);
    for(const p of notePitches(n))assert.ok(p.midi>=selectedRange.min&&p.midi<=selectedRange.max);
  }
  if(available.some(midi=>midi%12===material.tonicPC))assert.equal(notes.at(-1).midi%12,material.tonicPC);
  if(scalar&&notes.length>1) {
    const steps=notes.slice(1).map((n,i)=>Math.abs(available.indexOf(n.midi)-available.indexOf(notes[i].midi)));
    assert.ok(steps.filter(distance=>distance<=1).length>=steps.length*.65,'scalar bass remains principally stepwise');
    assert.ok(steps.at(-1)<=1,'the scale-study bass approaches its cadence by a scale step');
  }
}

test('coordination is immutable, deterministic and independent of the global rhythm random stream',()=>{
  const source=fixture(),before=JSON.stringify(source);
  const path='src/music/grandAccompaniment.ts';
  const api=loadModule(path,17,'Math.random=()=>{throw new Error("global random stream used");};\n'+fs.readFileSync(path,'utf8'));
  const result=api.coordinateGrandStaff(source,range);
  assert.equal(JSON.stringify(source),before);
  assert.deepEqual(plain(result),plain(loadModule(path,991).coordinateGrandStaff(source,range)));
  assert.deepEqual(plain(result.measures),plain(source.measures),'the existing melody is never rewritten');
  assert.deepEqual(plain(result.harmonyPlan),plain(source.harmonyPlan),'shared harmonic movement is retained');
  assert.deepEqual(rhythm(result),rhythm(source),'both independent rhythmic voices and all meter changes survive');
  assert.equal(createPlaybackEvents(result,80).duration,createPlaybackEvents(source,80).duration);
  assertLegalBass(result);
});

test('a held accompaniment is checked against every later melody attack and settles on the modal tonic',()=>{
  const source=fixture();
  const {coordinateGrandStaff}=loadModule('src/music/grandAccompaniment.ts');
  const result=coordinateGrandStaff(source,range);
  const first=result.lowerMeasures[0].events.find(n=>!n.rest);
  assert.equal(first.midi%12,0,'the opening establishes the shared C harmony');
  for(const upper of result.measures[0].events) {
    const held=result.lowerMeasures[0].events.filter(lower=>!lower.rest&&lower.startUnits<=upper.startUnits&&
      lower.startUnits+lower.durationUnits>upper.startUnits);
    assert.ok(held.length,'the held bass remains present under the melody');
    for(const lower of held)for(const pitch of notePitches(lower)) {
      const interval=((upper.midi-pitch.midi)%12+12)%12;
      assert.ok(![1,11].includes(interval),'no sustained semitone or major seventh under this consonant C-triad melody');
    }
  }
  assert.equal(sounding(result.lowerMeasures).at(-1).midi%12,0);
});

test('single voices, monophonic staff transfers and free atonal material bypass tonal accompaniment',()=>{
  const {coordinateGrandStaff}=loadModule('src/music/grandAccompaniment.ts');
  const source=fixture(),single={...source,grandMode:undefined,lowerMeasures:undefined};
  const mono={...source,grandMode:'mono'};
  const atonal={...source,tonality:describeTonality('C','atonal'),harmonyPlan:undefined};
  for(const input of [single,mono,atonal]) {
    const before=JSON.stringify(input);
    assert.equal(coordinateGrandStaff(input,range),input);
    assert.equal(JSON.stringify(input),before);
  }
});

test('chromatic melody colour stays intact while tonal bass support uses the selected mode',()=>{
  const source=fixture();delete source.harmonyPlan;
  source.measures[0].events[1]=note(75,4,4);
  const before=plain(source.measures);
  const {coordinateGrandStaff}=loadModule('src/music/grandAccompaniment.ts');
  const result=coordinateGrandStaff(source,range,true);
  assert.deepEqual(plain(result.measures),before,'the enabled chromatic melody is not quantized to the scale');
  assert.equal(result.measures[0].events[1].midi,75);
  assert.equal(result.harmonyPlan.length,result.measures.length);
  const allowed=buildPitchMaterial(result.tonality,{min:range.min,max:59}).pitches.map(p=>p.midi);
  assert.ok(sounding(result.lowerMeasures).every(n=>allowed.includes(n.midi)));
  assert.deepEqual(rhythm(result),rhythm(source));
});

test('a narrow bass range without the tonic remains legal instead of inventing an out-of-range cadence',()=>{
  const source=fixture(),narrow={min:55,max:84};
  source.lowerMeasures=source.lowerMeasures.map(measure=>({...measure,events:measure.events.map(n=>n.rest?n:note(59,n.startUnits,n.durationUnits))}));
  const {coordinateGrandStaff}=loadModule('src/music/grandAccompaniment.ts');
  const result=coordinateGrandStaff(source,narrow);
  assertLegalBass(result,narrow);
  assert.deepEqual(rhythm(result),rhythm(source));
  assert.deepEqual(plain(result.measures),plain(source.measures));
});

test('the accompaniment rhythm keeps clear pulses and leaves triplet contrasts to the melody',()=>{
  const {createGrandAccompanimentRhythmPlan}=loadModule('src/music/grandStaff.ts',731);
  const meters=['4/4','5/4','6/8','9/8','3/8','7/8','4/4','4/4'];
  for(const level of ['simple','medium','complex']) {
    const plan=createGrandAccompanimentRhythmPlan(meters,level);
    assert.deepEqual(Array.from(plan,bar=>bar.meter),meters);
    if(level==='simple')assert.deepEqual(Array.from(plan[1].notes,n=>n.units),[8,4,8],'5/4 retains its 3+2 grouping');
    for(const planned of plan) {
      const expected=Number(planned.meter.split('/')[0])*(planned.meter.endsWith('/8')?2:4);
      assert.ok(Math.abs(planned.notes.reduce((sum,n)=>sum+n.units,0)-expected)<1e-7);
      assert.ok(planned.notes.every(n=>!n.tuplet),'the supporting hand does not compete with melody triplets');
    }
    assert.equal(plan.at(-1).notes.at(-1).rest,false);
  }
});

test('piano and yangqin retain a musical scale bass, legal hand ranges and complete mixed-meter cadences',()=>{
  for(const instrumentProfile of ['Piano','Yangqin']) {
    const {composeExercise}=loadModule('src/music/composeExercise.ts',instrumentProfile==='Piano'?781:2039);
    const {coordinateGrandStaff}=loadModule('src/music/grandAccompaniment.ts');
    for(const difficulty of ['beginner','intermediate','advanced']) {
      const exercise=composeExercise({...base,instrumentProfile,difficulty,pitchFocus:'scales',mixedMeters:true,
        meters:['4/4','6/8','9/8'],measures:8},'two-hand');
      const before=JSON.stringify(exercise),result=coordinateGrandStaff(exercise,range,false,true);
      assertLegalBass(result,range,true);
      assert.deepEqual(plain(result.measures),plain(exercise.measures));
      assert.deepEqual(rhythm(result),rhythm(exercise));
      assert.equal(JSON.stringify(exercise),before);
    }
  }
});

test('specialist generation coordinates both two-hand instruments after generic melody refinement',()=>{
  for(const instrument of ['Piano','Yangqin']) {
    let state=[],cursor=0;
    const react={useState(initial){const i=cursor++;if(!(i in state))state[i]=typeof initial==='function'?initial():initial;
      return [state[i],next=>{state[i]=typeof next==='function'?next(state[i]):next;}];}};
    let refinedUpper,coordinationInput;
    const actual=loadModule('src/music/grandAccompaniment.ts');
    const hooks=loadModule('src/hooks/useExercise.ts',619,undefined,{react,
      '../music/tempoFlow':{refineFastPassages(exercise){
        const copy=plain(exercise),first=copy.measures[0].events.find(n=>!n.rest);
        Object.assign(first,note(72,first.startUnits,first.durationUnits,{duration:first.duration,dots:first.dots,tuplet:first.tuplet}));
        refinedUpper=plain(copy.measures);return copy;
      }},
      '../music/grandAccompaniment':{coordinateGrandStaff(exercise,...args){coordinationInput=plain(exercise.measures);
        return actual.coordinateGrandStaff(exercise,...args);}},
    },{window:{matchMedia:()=>({matches:false})}});
    const render=()=>{cursor=0;return hooks.useExercise({tonic:'C',scaleId:'major'});};
    const settings={...plain(hooks.DEFAULT_SETTINGS),instrument,clef:'grand',difficulty:'Advanced',rhythmLevel:'Complex',
      rangeMinMidi:36,rangeMaxMidi:84,measureCount:4,performanceMarks:false,rhythmFocus:'dotted'};
    assert.ok(render().generateFrom(settings,80,80));
    const result=render().current.exercise;
    assert.deepEqual(coordinationInput,refinedUpper,'final coordination sees the actual refined melody');
    assert.deepEqual(plain(result.measures),refinedUpper);
    assert.equal(result.soundProfile,instrument);
    assert.equal(result.grandMode,'two-hand');
    assertLegalBass(result);
    result.measures.forEach((measure,b)=>{
      for(const n of measure.events.filter(n=>!n.rest&&metricPosition(measure,n.startUnits).onPulse)) {
        for(const lower of result.lowerMeasures[b].events.filter(l=>!l.rest&&l.startUnits<=n.startUnits&&l.startUnits+l.durationUnits>n.startUnits))
          assert.ok(notePitches(lower).every(p=>p.midi<n.midi),'supporting pitches stay below the melody');
      }
    });
  }
});

// Measure what is actually heard, including bass notes held across later melody
// attacks. Short offbeat colour has less weight; ordinary passing/neighbor notes
// may remain dissonant, so this deliberately asks for an aggregate improvement.
function verticalBurden(exercise) {
  let clash=0,severe=0;
  exercise.measures.forEach((measure,b)=>{
    for(const upper of measure.events.filter(n=>!n.rest)) {
      const position=metricPosition(measure,upper.startUnits);
      const importance=position.onPulse?2:upper.durationUnits>=position.units?1.5:
        upper.durationUnits>=position.units/2?1:.3;
      for(const lower of exercise.lowerMeasures[b].events.filter(n=>!n.rest)) {
        const overlap=Math.min(upper.startUnits+upper.durationUnits,lower.startUnits+lower.durationUnits)-
          Math.max(upper.startUnits,lower.startUnits);
        if(overlap<=1e-7)continue;
        for(const pitch of notePitches(lower)) {
          const interval=((upper.midi-pitch.midi)%12+12)%12;
          if([1,2,6,10,11].includes(interval))clash+=overlap*importance;
          if([1,11].includes(interval))severe+=overlap*importance;
        }
      }
    }
  });
  return {clash,severe};
}

test('shared accompaniment reduces audible sustained clashes across 32 studies without flattening all basses to the tonic',()=>{
  const {coordinateGrandStaff}=loadModule('src/music/grandAccompaniment.ts');
  const totals={before:{clash:0,severe:0},after:{clash:0,severe:0}};
  for(const scaleId of ['major','natural-minor','dorian','major-pentatonic']) {
    for(const [i,seed] of [3,17,41,73,109,587,781,2039].entries()) {
      // Identical current rhythm and melody composition, isolating only this
      // coordination stage rather than conflating it with the rhythm redesign.
      const {composeExercise}=loadModule('src/music/composeExercise.ts',seed,undefined,{
        './grandAccompaniment':{coordinateGrandStaff:exercise=>exercise},
      });
      const source=composeExercise({...base,scaleId,measures:8,pitchFocus:i%2?'leaps':'balanced',
        timeSignature:i%3===0?'6/8':'4/4',rhythmLevel:['complex','medium','simple'][i%3],
        difficulty:['advanced','intermediate','beginner'][i%3]},'two-hand');
      const original=JSON.stringify(source),result=coordinateGrandStaff(source,range);
      assert.equal(JSON.stringify(source),original);
      assert.deepEqual(plain(result.measures),plain(source.measures));
      assert.deepEqual(rhythm(result),rhythm(source));
      assertLegalBass(result);
      const pitches=sounding(result.lowerMeasures).map(n=>n.midi%12);
      assert.ok(new Set(pitches).size>=3,`${scaleId}/${seed}: useful harmonic movement remains`);
      assert.ok(pitches.some(pc=>pc!==0),`${scaleId}/${seed}: accompaniment is not an unchanging tonic pedal`);
      const before=verticalBurden(source),after=verticalBurden(result);
      for(const key of ['clash','severe']){totals.before[key]+=before[key];totals.after[key]+=after[key];}
    }
  }
  assert.ok(totals.before.clash>0&&totals.before.severe>0,'the paired corpus contains actual original clashes');
  assert.ok(totals.after.clash<totals.before.clash*.7,JSON.stringify(totals));
  assert.ok(totals.after.severe<totals.before.severe*.6,JSON.stringify(totals));
});
