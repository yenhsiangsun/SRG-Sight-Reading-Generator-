import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

const {addModalPhrasing}=loadModule('src/music/modalPhrasing.ts');
const {planMelodicContours}=loadModule('src/music/melodicContours.ts');
const {buildPitchMaterial,pitchClass}=loadModule('src/music/scales.ts');
const levels=['beginner','intermediate','advanced'];
const base={instrument:'Sheng',clef:'treble',keySignature:'C',timeSignature:'4/4',rhythmLevel:'complex',measures:8,tempo:80,
  range:{min:55,max:90},allowAccidentals:false,mixedMeters:false,meters:['4/4','6/8','7/8'],tonic:'C',scaleId:'major'};
const sounded=ex=>ex.measures.flatMap(m=>m.events).filter(n=>!n.rest);
const plansFor=ex=>planMelodicContours(ex.measures,buildPitchMaterial(ex.tonality,base.range).pitches,pitchClass(ex.tonality.tonic),ex.difficulty);

test('melodies occupy all adjacent pairs, remain a minority and vary their actual two-bar contour',()=>{
  const engine=loadModule('src/music.ts',8161);
  for(const difficulty of levels) {
    const starts=Array(7).fill(0),rules=new Set();
    for(let sample=0;sample<140;sample++) {
      const raw=engine.generatePracticeExercise({...base,difficulty,measures:16});
      const plans=plansFor(raw), shaped=addModalPhrasing(raw,base.range,false), notes=sounded(shaped);
      assert.equal(plans.length,2,'four of sixteen bars have an explicit contour');
      assert.notEqual(plans[0].startBar,plans[1].startBar-8,'successive blocks rotate the phrase position');
      assert.notEqual(plans[0].rule,plans[1].rule,'successive blocks use different shapes');
      for(const plan of plans) {
        starts[plan.startBar%8]++;rules.add(plan.rule);
        for(const target of plan.targets)if(target.fixed)assert.equal(notes[target.index].midi,target.midi,'the planned line must survive modal shaping');
        const first=shaped.measures[plan.startBar].events.filter(n=>!n.rest).map(n=>n.midi);
        const second=shaped.measures[plan.endBar].events.filter(n=>!n.rest).map(n=>n.midi);
        assert.notDeepEqual(first,second,'a line does not duplicate a bar');
      }
    }
    assert.ok(starts.every(n=>n>=10 && n<85),JSON.stringify({difficulty,starts}));
    assert.equal(rules.size,difficulty==='beginner'?4:6);
  }
});

test('after modal phrasing, pitch grades retain clearly distinct leaps AND melodic spans',()=>{
  const engine=loadModule('src/music.ts',716);
  const stats=levels.map(difficulty=>{
    let distance=0,large=0,count=0,phraseDistance=0,phraseCount=0,span=0,phrases=0;
    for(const scaleId of ['major','natural-minor','dorian'])for(let i=0;i<40;i++) {
      const raw=engine.generatePracticeExercise({...base,difficulty,scaleId});
      const ex=addModalPhrasing(raw,base.range,false),notes=sounded(ex);
      for(let n=1;n<notes.length;n++){const d=Math.abs(notes[n].midi-notes[n-1].midi);distance+=d;large+=d>=7;count++;}
      for(const plan of plansFor(raw)) {
        const line=plan.targets.map(t=>notes[t.index].midi);
        span+=Math.max(...line)-Math.min(...line);phrases++;
        for(let n=1;n<line.length;n++){phraseDistance+=Math.abs(line[n]-line[n-1]);phraseCount++;}
      }
    }
    return {meanLeap:distance/count,large:large/count,phraseLeap:phraseDistance/phraseCount,span:span/phrases};
  });
  assert.ok(stats[0].meanLeap<2.6 && stats[0].large<.05,JSON.stringify(stats));
  assert.ok(stats[1].meanLeap>stats[0].meanLeap+1 && stats[2].meanLeap>stats[1].meanLeap+2,JSON.stringify(stats));
  assert.ok(stats[2].large>stats[1].large+.2,JSON.stringify(stats));
  for(let i=1;i<3;i++) {
    assert.ok(stats[i].phraseLeap>stats[i-1].phraseLeap+.25,JSON.stringify(stats));
    assert.ok(stats[i].span>stats[i-1].span+3,JSON.stringify(stats));
  }
});

test('rhythm tiers visibly separate note density, sixteenths and offbeat onsets in /4 and /8',()=>{
  const engine=loadModule('src/music.ts',5728);
  for(const timeSignature of ['3/4','4/4','3/8','6/8','7/8']) {
    const stats=['simple','medium','complex'].map(rhythmLevel=>{
      let count=0,sixteenths=0,offbeat=0,units=0;
      for(let i=0;i<60;i++) {
        const ex=engine.generatePracticeExercise({...base,difficulty:'beginner',timeSignature,rhythmLevel});
        for(const bar of ex.measures) {
          units+=bar.totalUnits;
          for(const n of bar.events)if(!n.rest){count++;sixteenths+=n.durationUnits===1;offbeat+=n.startUnits%2!==0;}
        }
      }
      return {density:count/units*4,sixteenths:sixteenths/count,offbeat:offbeat/count};
    });
    const label=JSON.stringify({timeSignature,stats});
    assert.ok(stats[1].sixteenths>stats[0].sixteenths+.12,label);
    assert.ok(stats[2].sixteenths>stats[1].sixteenths+.24,label);
    assert.ok(stats[2].density>stats[1].density+.3,label);
    assert.ok(stats[2].offbeat>stats[1].offbeat+.13,label);
    if(timeSignature.endsWith('/8'))assert.ok(stats[0].sixteenths>.15,'simple /8 still practices sixteenths');
  }
});

test('modal shaping does not consume shared randomness or change timing at any difficulty',()=>{
  const harness=`
    import {generatePracticeExercise} from '../music';
    import {addModalPhrasing} from '../music/modalPhrasing';
    export function run(options, shape) {
      const raw=generatePracticeExercise(options);
      const result=shape?addModalPhrasing(raw,options.range,false):raw;
      return {raw,result,next:generatePracticeExercise(options)};
    }
  `;
  const timing=ex=>JSON.stringify(ex.measures.map(m=>m.events.map(({key:_key,midi:_midi,octave:_octave,...time})=>time)));
  for(const difficulty of levels) {
    const options={...base,difficulty,mixedMeters:true};
    const shaped=loadModule('src/hooks/useExercise.ts',911,harness).run(options,true);
    const plain=loadModule('src/hooks/useExercise.ts',911,harness).run(options,false);
    assert.equal(JSON.stringify(shaped.raw),JSON.stringify(plain.raw),'source remains unchanged');
    assert.equal(timing(shaped.result),timing(plain.result));
    assert.equal(JSON.stringify(shaped.next),JSON.stringify(plain.next),'future random draws remain identical');
  }
});
