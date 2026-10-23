import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

const plain=x=>JSON.parse(JSON.stringify(x));
const rhythm=b=>JSON.stringify(b.events.map(n=>[n.durationUnits,n.rest,n.tuplet]));
const melody=ex=>plain(ex.measures.map(b=>b.events.map(n=>[n.midi,n.durationUnits,n.rest])));
const base={instrument:'Sheng',instrumentProfile:'Sheng',clef:'treble',difficulty:'intermediate',keySignature:'C',tonic:'C',scaleId:'major',timeSignature:'4/4',rhythmLevel:'medium',measures:8,tempo:80,range:{min:60,max:84},allowAccidentals:false,mixedMeters:false,meters:['4/4']};
const bridge=`export {composeExercise} from './composeExercise';export {coordinateGrandStaff} from './grandAccompaniment';export {addInstrumentHarmony} from './instrumentHarmony';export {addPerformanceMarks} from './performanceMarks';export {addPipaTechniques} from './pipaTechniques';export {validateGeneratedExercise} from './exerciseQuality';`;

test('the retained explicit grammar composer keeps its distinct journeys for comparison',()=>{
  const scores=['classical','lyrical','pentatonic'].map(compositionStyle=>
    loadModule('src/music/intentComposition.ts',63011).composeIntentExercise({...base,compositionStyle,scaleId:compositionStyle==='pentatonic'?'major-pentatonic':'major'}));
  for(let a=0;a<scores.length;a++)for(let b=a+1;b<scores.length;b++){
    const changed=scores[a].measures.flatMap((bar,i)=>rhythm(bar)!==rhythm(scores[b].measures[i])?[i]:[]);
    assert.ok(changed.length>=5,'differences must reach most of the song');
    assert.ok(changed.some(i=>i>=4&&i<7),'the later development must differ too');
    assert.notEqual(rhythm(scores[a].measures.at(-1)),rhythm(scores[b].measures.at(-1)),'each character retains its own arrival');
  }
  const classical=scores[0];
  for(const phrase of classical.phrasePlan){
    assert.notEqual(rhythm(classical.measures[phrase.startBar]),rhythm(classical.measures[phrase.startBar+2]),'continuation must develop the presentation');
  }
});

test('completed phrases approach their resting pitch by a real scale step after all music processing',()=>{
  const cases=[
    {compositionStyle:'classical',seed:63011},
    {compositionStyle:'lyrical',seed:65003,timeSignature:'3/4',keySignature:'D',tonic:'D'},
    {compositionStyle:'pentatonic',seed:67003,timeSignature:'6/8',scaleId:'major-pentatonic',keySignature:'G',tonic:'G'},
    {compositionStyle:'classical',seed:69001,instrument:'Piano',instrumentProfile:'Piano',range:{min:48,max:84}},
    {compositionStyle:'lyrical',seed:71011,instrument:'Erhu',instrumentProfile:'Erhu',range:{min:62,max:86}},
    {compositionStyle:'classical',seed:73013,instrumentProfile:'Alto Sheng',range:{min:48,max:83},difficulty:'advanced'},
  ];
  for(const c of cases){
    const api=loadModule('src/music/__development.ts',c.seed,bridge),o={...base,...c};
    let ex=api.composeExercise(o,c.instrument==='Piano'?'two-hand':undefined);const core=melody(ex);
    ex.soundProfile=o.instrumentProfile;
    ex=api.coordinateGrandStaff(ex,o.range,false,false);ex=api.addInstrumentHarmony(ex,o.range);
    ex=api.addPerformanceMarks(ex);ex=api.addPipaTechniques(ex,o.range);
    api.validateGeneratedExercise(ex,o.range,false);
    assert.deepEqual(melody(ex),core,'harmony and expression must preserve the planned melodic line');
    const root=ex.musicalIntent.harmony[0].root;
    for(const phrase of ex.musicalIntent.phrases){
      const notes=ex.measures.slice(phrase.startBar,phrase.endBar+1).flatMap(b=>b.events.filter(n=>!n.rest));
      assert.ok(notes.length>=2);
      assert.ok(Math.abs(notes.at(-1).midi-notes.at(-2).midi)<=3,`${c.compositionStyle}: cadence should resolve by a modal neighbour`);
      if(phrase.cadence==='home')assert.equal(notes.at(-1).midi%12,root);
    }
  }
});

test('new studies automatically choose a whole grammar while retaining old internal fields only for score compatibility',()=>{
  const results=[];
  for(const compositionStyle of ['classical','lyrical','pentatonic']){
    const values=[],memory=new Map();let cursor=0;
    const react={useState(initial){const i=cursor++;if(!(i in values))values[i]=typeof initial==='function'?initial():initial;
      return [values[i],next=>{values[i]=typeof next==='function'?next(values[i]):next;}];}};
    const localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,String(v))};
    const api=loadModule('src/hooks/useExercise.ts',63011,undefined,{react},{localStorage,window:{matchMedia:()=>({matches:false})}});
    const render=()=>{cursor=0;return api.useExercise({tonic:'C',scaleId:compositionStyle==='pentatonic'?'major-pentatonic':'major'});};
    const state=render();
    const settings={...state.settings,compositionStyle,difficulty:'Intermediate',rhythmLevel:'Moderate',rangeMinMidi:48,rangeMaxMidi:84};
    assert.equal(state.generateFrom(settings,80,80),80);
    const current=render().current;assert.ok(current);
    assert.equal(current.settings.compositionStyle,'auto');
    assert.ok((compositionStyle==='pentatonic'?['pentatonic']:['classical','lyrical']).includes(current.exercise.musicalIntent.grammar));
    assert.equal(current.exercise.lowerMeasures.length,8);
    assert.deepEqual(plain(current.exercise.harmonyPlan),plain(current.exercise.musicalIntent.harmony));
    results.push(current.exercise);
  }
  assert.deepEqual(plain(results[0]),plain(results[1]),'an obsolete character choice cannot lock newly generated practice');
  assert.notEqual(JSON.stringify(results[0].measures.slice(4).map(rhythm)),JSON.stringify(results[2].measures.slice(4).map(rhythm)),'five-tone material retains its coherent modal grammar');
});
