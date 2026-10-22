import type {Difficulty,MeasureData} from '../music';
import type {RhythmBarPlan} from './phraseRhythm';
import type {PhraseSpan} from './phrasePlan';
import type {HarmonyBar} from './phraseHarmony';
import {pulseGroups,metricPosition} from './meterFeel';
import {melodicRandom} from './melodicContours';
import {planStudyMelody,type StudyTarget} from './studyMelody';
import {pitchClass,type ScalePitch,type Tonality} from './scales';
import {dialoguePhrases,dialogueRhythm,dialogueTargets} from './thematicDialogue';
import {continuationPhrases,continuationRhythm,continuationTargets,continuationHarmony} from './thematicContinuation';
import {planNativeGestureContinuation} from './nativeGestureContinuation';
import {connectPulseTargets} from './pulseConnectedContinuation';

export const STUDY_STRATEGIES=['continuous-line','sentence-growth'] as const;
export const EXPERIMENTAL_STUDY_STRATEGIES=['thematic-dialogue','thematic-continuation'] as const;
export type StudyStrategy=typeof STUDY_STRATEGIES[number]|typeof EXPERIMENTAL_STUDY_STRATEGIES[number]|'phrase-variation';
type StrategyTarget=StudyTarget&{fixed?:boolean};
interface Block {bar:number;start:number;units:number;notes:RhythmBarPlan['notes']}
const mod=(n:number)=>(n%12+12)%12;
function identity(plan:readonly RhythmBarPlan[]) {
  let hash=2166136261;
  const text=plan.map(bar=>`${bar.meter}:${bar.notes.map(n=>`${n.startUnits}/${n.units}/${+n.rest}`).join(',')}`).join('|');
  for(let i=0;i<text.length;i++)hash=Math.imul(hash^text.charCodeAt(i),16777619)>>>0;
  return hash;
}

/** The strategy is chosen before pitch, from time alone. Pitch grade, added
 * accidentals and the instrument cannot quietly change the rhythm strategy. */
export function selectStudyStrategy(plan:readonly RhythmBarPlan[]):StudyStrategy {
  return STUDY_STRATEGIES[identity(plan)%STUDY_STRATEGIES.length];
}

export function strategyPhrases(count:number,strategy:StudyStrategy):PhraseSpan[] {
  if(strategy==='thematic-continuation'||strategy==='phrase-variation')return continuationPhrases(count);
  if(strategy==='thematic-dialogue')return dialoguePhrases(count);
  const lengths:number[]=[];
  let remaining=count;
  if(strategy==='sentence-growth'&&count>=8){lengths.push(2,2);remaining-=4;}
  while(remaining>0) {
    const wanted=strategy==='continuous-line'&&remaining===8?3:4;
    let length=Math.min(wanted,remaining);
    if(remaining-length===1)length--;
    if(length<1)length=remaining;
    lengths.push(length);remaining-=length;
  }
  let start=0;
  return lengths.map((length,index)=>{
    const phrase:PhraseSpan={startBar:start,endBar:start+length-1,
      role:index===0?'opening':index===lengths.length-1?'closing':
        index===lengths.length-2&&lengths.length>3?'answer':'development'};
    start+=length;return phrase;
  });
}

/** Move complete, readable pulse blocks. Sustained notes that span two pulses
 * are never cut. Rests/tuplets and the first/final bar stay at their safe places.
 * The whole-study duration inventory is identical; this changes syntax, not tier. */
export function developStrategyRhythm(plan:RhythmBarPlan[],strategy:StudyStrategy):RhythmBarPlan[] {
  if(strategy==='thematic-continuation'||strategy==='phrase-variation')return continuationRhythm(plan);
  if(strategy==='thematic-dialogue')return dialogueRhythm(plan);
  if(plan.length<8)return plan;
  const blocks:Block[]=[];
  for(const [barIndex,bar] of plan.entries()) {
    const groups=pulseGroups({timeSignature:bar.meter,groups:[]});
    let start=0,notes:RhythmBarPlan['notes']=[],units=0;
    for(const group of groups) {
      notes.push(...bar.notes.filter(n=>n.startUnits>=start+units-1e-7&&n.startUnits<start+units+group-1e-7));
      units+=group;
      if(notes.length&&Math.abs(notes.at(-1)!.startUnits+notes.at(-1)!.units-start-units)<1e-7) {
        if(barIndex>0&&barIndex<plan.length-1&&notes.every(n=>!n.rest&&!n.tuplet))
          blocks.push({bar:barIndex,start,units,notes});
        start+=units;units=0;notes=[];
      }
    }
  }
  const result=plan.map(bar=>({...bar,notes:bar.notes.map(n=>({...n}))}));
  const kinds=[...new Set(blocks.map(b=>`${plan[b.bar].meter}/${b.units}`))];
  const priority=(block:Block)=>{
    const progress=(block.bar+block.start/plan[block.bar].notes.reduce((sum,n)=>sum+n.units,0))/plan.length;
    // A long line grows toward a later peak. A sentence recalls two-bar
    // presentation, then compresses activity toward the continuation's climax.
    if(strategy==='continuous-line')return Math.sin(Math.PI*Math.min(1,progress/.85))+.12*(block.start/block.units);
    const position=block.bar<4?(block.bar%2+block.start/block.units/4)/2:
      (block.bar-4+block.start/block.units/4)/Math.max(1,plan.length-4);
    return block.bar<4?.15+position*.35:.5+.5*Math.sin(Math.PI*Math.min(1,position/1.1));
  };
  for(const kind of kinds) {
    const destinations=blocks.filter(b=>`${plan[b.bar].meter}/${b.units}`===kind).sort((a,b)=>priority(a)-priority(b)||a.bar-b.bar||a.start-b.start);
    const material=[...destinations].sort((a,b)=>a.notes.length/a.units-b.notes.length/b.units||
      a.notes[0].units-b.notes[0].units||a.bar-b.bar||a.start-b.start);
    destinations.forEach((destination,index)=>{
      const source=material[index];
      const bar=result[destination.bar];
      bar.notes=bar.notes.filter(n=>n.startUnits<destination.start-1e-7||n.startUnits>=destination.start+destination.units-1e-7)
        .concat(source.notes.map(n=>({...n,startUnits:destination.start+n.startUnits-source.start}))).sort((a,b)=>a.startUnits-b.startUnits);
    });
  }
  return result;
}

export function planStudyStructure(plan:RhythmBarPlan[],forced?:StudyStrategy,sharedPhrases?:readonly PhraseSpan[]) {
  const requested=forced??selectStudyStrategy(plan);
  const strategy=requested.startsWith('thematic-')&&plan.length%2?selectStudyStrategy(plan):requested;
  if(sharedPhrases&&strategy==='phrase-variation')return {strategy,phrases:sharedPhrases.map(p=>({...p})),rhythm:continuationRhythm(plan,sharedPhrases)};
  return {strategy,phrases:strategyPhrases(plan.length,strategy),rhythm:developStrategyRhythm(plan,strategy)};
}

export function shapeStrategyHarmony(harmony:HarmonyBar[],phrases:readonly PhraseSpan[],tonality:Tonality,strategy?:StudyStrategy):HarmonyBar[] {
  return strategy==='thematic-continuation'||strategy==='phrase-variation'?continuationHarmony(harmony,phrases,tonality):harmony;
}

function interpolate(points:readonly number[],position:number) {
  const p=Math.max(0,Math.min(1,position))*(points.length-1),i=Math.floor(p);
  return points[i]+(points[Math.min(i+1,points.length-1)]-points[i])*(p-i);
}

/** An entire two-bar theme and its continuation, rather than four notes at
 * every phrase entrance. Time controls thematic phase through barlines; the
 * existing legal solver chooses notes under real semitone/range constraints. */
export function planStrategyTargets(measures:MeasureData[],pitches:ScalePitch[],tonality:Tonality,difficulty:Difficulty,
  phrases:readonly PhraseSpan[],harmony:readonly HarmonyBar[],strategy:StudyStrategy,instrument?:string):StrategyTarget[]|undefined {
  if(strategy==='phrase-variation') {
    const skeleton=planNativeGestureContinuation(measures,pitches,tonality,difficulty,phrases,harmony,instrument);
    return skeleton?connectPulseTargets(measures,pitches,difficulty,phrases,skeleton)?.targets:undefined;
  }
  if(strategy==='thematic-continuation')return continuationTargets(measures,pitches,tonality,difficulty,phrases,harmony);
  if(strategy==='thematic-dialogue')return dialogueTargets(measures,pitches,tonality,difficulty,phrases,harmony);
  if(pitches.length<5||tonality.tonic===null||measures.length<8)return;
  const root=pitchClass(tonality.tonic),offsets:number[]=[];
  let total=0;
  for(const bar of measures){offsets.push(total);total+=bar.totalUnits;}
  const slots=measures.flatMap((bar,b)=>bar.events.flatMap(note=>note.rest?[]:[{note,bar:b,time:offsets[b]+note.startUnits}]));
  if(slots.length<12)return;
  const random=melodicRandom(slots.map(s=>s.note));
  const patterns:Record<Difficulty,number[][]>={
    beginner:[[0,1,2,1,2,3,2,0],[0,1,0,-1,0,2,1,0],[0,-1,-2,-1,0,1,2,1]],
    intermediate:[[0,2,1,3,2,4,3,1],[0,2,4,3,2,1,3,2],[0,-2,1,3,1,4,2,0]],
    advanced:[[0,4,2,5,3,6,4,2],[0,3,6,2,5,1,4,2],[0,-3,2,5,1,6,3,0]],
  };
  const theme=patterns[difficulty][Math.floor(random()*3)],variant=random()<.5?1:-1;
  const twoBars=measures[0].totalUnits*2;
  const foundation=planStudyMelody(measures,pitches,root,difficulty,instrument,phrases);
  const targets=new Map<number,StrategyTarget>(foundation.targets.map(t=>[t.index,{...t}]));
  const themeCenter=theme.reduce((a,b)=>a+b,0)/theme.length;
  const intents=slots.map(slot=>{
    const progress=slot.time/Math.max(1,total),after=slot.time/twoBars;
    const span=strategy==='sentence-growth'&&after>=2?(after>=3?.5:1):2;
    const phase=strategy==='continuous-line'?(slot.time/twoBars)%1:((slot.time/measures[0].totalUnits)%span)/span;
    const motif=interpolate(theme,phase)-themeCenter;
    const arc=strategy==='continuous-line'?interpolate([.12,.3,.52,.9,.7,.38,.12],progress):
      interpolate([.3,.48,.25,.55,.38,.9,.65,.12],progress);
    const development=strategy==='continuous-line'?(after>=1&&after<3?variant*.65:0):
      after>=2?(after>=3?-1:1)*motif*.25:after>=1?variant*.8:0;
    return arc*{beginner:2.4,intermediate:5.5,advanced:8}[difficulty]+motif+development;
  });
  // Keep the original graded figures as local vocabulary. A slower two-bar
  // thematic direction shifts their register; replacing them with a smoothly
  // interpolated curve erased too much of the intermediate/advanced movement.
  const low=Math.min(...intents),high=Math.max(...intents),span=Math.max(1,high-low);
  const degrees=slots.map((_,i)=>{
    const original=foundation.targets[i];
    const at=pitches.findIndex(p=>p.midi===original?.midi);
    return Math.max(0,at)+Math.round(((intents[i]-low)/span-.5)*{beginner:1,intermediate:2,advanced:3}[difficulty]);
  });
  // Fit the entire guide as a unit, never clamp individual output notes.
  const minimum=Math.min(...degrees),maximum=Math.max(...degrees),width=maximum-minimum;
  const scale=Math.min(1,(pitches.length-1)/Math.max(1,width));
  const roots=pitches.flatMap((p,i)=>p.midi%12===root?[i]:[]);
  if(!roots.length)return;
  const start=Math.max(0,Math.min(pitches.length-1-width*scale,minimum));
  for(const [index,slot] of slots.entries()) {
    const degree=Math.round(start+(degrees[index]-minimum)*scale),position=metricPosition(measures[slot.bar],slot.note.startUnits);
    const original=foundation.targets[index];
    // Interior gestures retain graded motion; the new long arc supplies the
    // thematic destination instead of flattening every tier to one smooth arch.
    targets.set(index,{...original,index,midi:pitches[degree].midi,weight:position.onPulse?3.3:2.6});
    if(original&&slot.note.duration==='32')targets.set(index,{...original,weight:2.6});
  }
  const entryClasses=[0,3,4,7].filter(n=>tonality.notes.some(note=>mod(pitchClass(note)-root)===n));
  const entry=entryClasses[Math.floor(random()*entryClasses.length)];
  const near=(pc:number,desired:number)=>pitches.filter(p=>p.midi%12===pc).sort((a,b)=>Math.abs(a.midi-desired)-Math.abs(b.midi-desired))[0];
  const first=near(mod(root+entry),targets.get(0)!.midi);
  if(first)targets.set(0,{index:0,midi:first.midi,weight:5,fixed:true});
  for(const phrase of phrases) {
    const last=slots.findLastIndex(s=>s.bar<=phrase.endBar);
    if(last<1)continue;
    const final=last===slots.length-1,closed=final||phrase.role==='answer';
    const pc=closed?root:(harmony[phrase.endBar]?.root??root),target=near(pc,targets.get(last)!.midi);
    if(!target)continue;
    targets.set(last,{index:last,midi:target.midi,weight:6,fixed:final});
    if(final) {
      const degree=pitches.indexOf(target),neighbors=[degree-1,degree+1].filter(i=>pitches[i]&&Math.abs(pitches[i].midi-target.midi)<=3);
      const approach=neighbors[Math.floor(random()*neighbors.length)];
      if(approach!==undefined)targets.set(last-1,{index:last-1,midi:pitches[approach].midi,weight:5,fixed:true});
    }
  }
  return [...targets.values()];
}
