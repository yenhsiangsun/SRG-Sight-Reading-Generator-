import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

const base={compositionStyle:'auto',instrument:'Sheng',instrumentProfile:'Sheng',clef:'treble',difficulty:'intermediate',keySignature:'C',tonic:'C',scaleId:'major',timeSignature:'4/4',rhythmLevel:'complex',measures:8,tempo:80,range:{min:55,max:90},allowAccidentals:false,mixedMeters:false,meters:['4/4','6/8']};
const styles=['classical','lyrical','pentatonic'];
const levels=['simple','medium','complex'];
const stats=plan=>{
  const notes=plan.flatMap(b=>b.notes).filter(n=>!n.rest),units=plan.flatMap(b=>b.notes).reduce((s,n)=>s+n.units,0);
  return {density:notes.length/units*4,shortShare:notes.filter(n=>n.units<=1).length/notes.length,
    challengeBars:plan.filter(b=>b.notes.filter(n=>!n.rest&&n.units===1).length>=4).length};
};

test('every ordinary grammar and form keeps complex rhythm throughout the score, not only at its climax',()=>{
  const api=loadModule('src/music/musicalIntent.ts');
  for(const compositionStyle of styles)for(const timeSignature of ['4/4','6/8'])for(const measures of [4,8,12,16])for(const variant of [.1,.35,.6,.85]){
    const options={...base,compositionStyle,timeSignature,measures,scaleId:compositionStyle==='pentatonic'?'major-pentatonic':'major'};
    const plans=levels.map(rhythmLevel=>api.planMusicalIntent({...options,rhythmLevel},()=>variant));
    const values=plans.map(p=>stats(p.rhythm)),label=`${compositionStyle}/${timeSignature}/${measures}/${variant}`;
    assert.ok(values[1].density>values[0].density+.35,label+' medium must add motion');
    // Note count alone is not difficulty: require both more attacks and a
    // separate, much higher share of short subdivisions (including short forms).
    assert.ok(values[2].density>values[1].density*1.15,label+' complex must stay above medium');
    assert.ok(values[2].shortShare>.55,label+' complex needs sustained subdivision');
    assert.ok(values[2].shortShare>values[1].shortShare+.18,label+' subdivision tiers');
    assert.ok(values[2].challengeBars>=Math.floor((measures-1)*.65),label+' challenge across bars');
    assert.deepEqual(JSON.parse(JSON.stringify(plans[0].phrases)),JSON.parse(JSON.stringify(plans[2].phrases)),'rhythm grade preserves the form');
    assert.deepEqual(JSON.parse(JSON.stringify(plans[0].harmony)),JSON.parse(JSON.stringify(plans[2].harmony)),'rhythm grade preserves the harmonic route');
    assert.ok(plans[0].rhythm.some(b=>b.notes.some(n=>n.units>=(timeSignature==='4/4'?8:6)&&!n.rest)),'beginner retains long notes');
  }
});

test('all meters, forms and tiers have exact bar time, readable pulses and bounded short gaps',()=>{
  const {planMusicalIntent}=loadModule('src/music/musicalIntent.ts');
  const {assertMeasureRhythm}=loadModule('src/music/rhythmTiming.ts');
  const {pulseGroups}=loadModule('src/music/meterFeel.ts');
  for(const compositionStyle of styles)for(const timeSignature of ['2/4','3/4','4/4','5/4','3/8','6/8','7/8','9/8','12/8'])for(const rhythmLevel of levels)for(const variant of [.1,.35,.6,.85]){
    const plan=planMusicalIntent({...base,compositionStyle,timeSignature,rhythmLevel,scaleId:compositionStyle==='pentatonic'?'major-pentatonic':'major'},()=>variant);
    const [top,bottom]=timeSignature.split('/').map(Number),totalUnits=top*16/bottom;
    for(const bar of plan.rhythm){
      const events=bar.notes.map(n=>({...n,durationUnits:n.units}));
      assertMeasureRhythm({events,totalUnits},timeSignature);
      const rest=bar.notes.reduce((s,n)=>s+(n.rest?n.units:0),0);
      assert.ok(rest<=(rhythmLevel==='simple'?Math.max(4,totalUnits/4):totalUnits/4),'new subdivisions retain a bounded phrase breath');
      for(let i=1;i<events.length;i++)assert.ok(!(events[i].rest&&events[i-1].rest),'no adjacent gaps');
      if(rhythmLevel==='complex'){
        let start=0;
        for(const units of pulseGroups({timeSignature,groups:[]})){
          const crossing=bar.notes.filter(n=>n.startUnits<start&&n.startUnits+n.units>start);
          assert.ok(!crossing.length||bar===plan.rhythm.at(-1),'complex interior figures respect actual pulse boundaries');
          start+=units;
        }
      }
    }
    if(plan.rhythm[0].notes[0].rest){
      assert.equal(plan.opening?.weak,true,'only an explicit short delayed entrance may omit the first melody attack');
      assert.ok(plan.rhythm[0].notes[0].units<=2);
      assert.equal(plan.rhythm[0].notes[1].rest,false);
    }
    assert.equal(plan.rhythm.at(-1).notes.at(-1).rest,false);
    if(rhythmLevel==='simple')assert.ok(plan.rhythm.flatMap(b=>b.notes).filter(n=>n.tuplet).length<=3);
  }
});

test('completed new studies keep distinct rhythm grades across pitch grades, piano hands and narrow ranges',()=>{
  const timing=ex=>JSON.stringify(ex.measures.map(b=>b.events.map(n=>[n.startUnits,n.durationUnits,n.rest,n.tuplet])));
  const {validateGeneratedExercise}=loadModule('src/music/exerciseQuality.ts');
  const {createPlaybackEvents}=loadModule('src/audio/PlaybackController.ts');
  const {beatUnits}=loadModule('src/audio/tempo.ts');
  for(const compositionStyle of styles)for(const timeSignature of ['4/4','6/8'])for(const instrumentProfile of ['Sheng','Piano','Yangqin']){
    let reference;
    for(const difficulty of ['beginner','intermediate','advanced']){
      const {composeExercise}=loadModule('src/music/composeExercise.ts',77101);
      const piano=instrumentProfile!=='Sheng',range=piano?{min:48,max:79}:{min:60,max:79};
      const o={...base,compositionStyle,timeSignature,difficulty,instrumentProfile,instrument:piano?'Piano':'Sheng',range,scaleId:compositionStyle==='pentatonic'?'major-pentatonic':'major'};
      const exercise=composeExercise(o,piano?'two-hand':undefined);
      validateGeneratedExercise(exercise,range,false);
      reference??=timing(exercise);assert.equal(timing(exercise),reference,'pitch grade cannot simplify rhythm');
      const notes=exercise.measures.flatMap(b=>b.events).filter(n=>!n.rest);
      assert.ok(notes.filter(n=>n.durationUnits<=1).length/notes.length>.5);
      assert.ok(notes.filter(n=>n.duration==='32').length<=4,'rare 32nds remain a single four-note group');
      assert.equal(notes.at(-1).midi%12,0,'retain the home ending');
      const total=exercise.measures.reduce((s,b)=>s+b.totalUnits,0);
      assert.equal(createPlaybackEvents(exercise,80).duration,total/beatUnits(timeSignature)*60/80);
      if(piano){
        assert.ok(exercise.lowerMeasures.every(b=>b.events.every(n=>n.duration!=='32')));
        assert.ok(exercise.lowerMeasures.flatMap(b=>b.events).length<notes.length,'the bass leaves room for the denser melody');
      }
    }
  }
});
