import type {Difficulty,MeasureData,PracticeOptions} from '../music';
import type {RhythmBarPlan} from './phraseRhythm';
import type {PhraseSpan} from './phrasePlan';
import type {HarmonyBar} from './phraseHarmony';
import {pitchClass,type ScalePitch,type Tonality} from './scales';
import {melodicRandom} from './melodicContours';
import {pulseGroups} from './meterFeel';
import {PITCH_DIFFICULTY} from './pitchDifficulty';
import {planStudyMelody} from './studyMelody';
import {planStrategyTargets,type StudyStrategy} from './phraseStrategy';

const supported=['major','natural-minor','major-pentatonic','minor-pentatonic'];
const mod=(n:number)=>(n%12+12)%12;
/** Small, independent development strategies. They are variation techniques,
 * not composer-name styles; further syntax can be added without replacing the solver. */
export const MOTIVIC_DEVELOPMENTS=[
  {id:'related-tail',develop:(motif:readonly number[])=>motif.map((degree,i)=>i===motif.length-1?-degree:degree)},
  {id:'contrary-middle',develop:(motif:readonly number[])=>motif.map(degree=>-degree)},
] as const;
export function supportsMotivicStudy(options:PracticeOptions,grandMode?:string) {
  return !grandMode&&!options.mixedMeters&&options.measures>=4&&options.measures<=16&&
    ['3/4','4/4','6/8'].includes(options.timeSignature)&&supported.includes(options.scaleId??'major')&&
    (options.rhythmFocus===undefined||options.rhythmFocus==='balanced');
}

/** Recall only a short opening cell, never a finished bar. Equal duration
 * inventories preserve the selected subdivision/dot budget; incompatible
 * cells, rests and tuplets retain the existing rhythm instead. */
export function linkMotivicRhythm(plan:RhythmBarPlan[],phrases:readonly PhraseSpan[]):RhythmBarPlan[] {
  if(phrases.length<2||!plan.length)return plan;
  const first=plan[0],groups=pulseGroups({timeSignature:first.meter,groups:[]});
  const total=groups.reduce((sum,n)=>sum+n,0),span=groups.length>=4?groups[0]+groups[1]:groups[0];
  if(span>=total)return plan;
  const prefix=(bar:RhythmBarPlan)=>bar.notes.filter(n=>n.startUnits<span);
  const valid=(notes:RhythmBarPlan['notes'])=>notes.length>=2&&notes.every(n=>!n.rest&&!n.tuplet)&&
    Math.abs(notes.at(-1)!.startUnits+notes.at(-1)!.units-span)<1e-7;
  const motif=prefix(first);
  if(!valid(motif))return plan;
  const inventory=(notes:RhythmBarPlan['notes'])=>notes.map(n=>n.units).sort((a,b)=>a-b).join(',');
  const entries=new Set(phrases.slice(1).filter(p=>p.role==='answer'||p.role==='closing').map(p=>p.startBar));
  return plan.map((bar,index)=>{
    const current=prefix(bar);
    if(!entries.has(index)||bar.meter!==first.meter||!valid(current)||inventory(current)!==inventory(motif))return bar;
    return {...bar,notes:[...motif.map(note=>({...note})),...bar.notes.slice(current.length)]};
  });
}

/** Phrase releases and their preparation use the same grammar as the melody.
 * Pentatonic centers are open/modal supports, not borrowed dominant triads. */
export function phraseDirectedHarmony(base:readonly HarmonyBar[],phrases:readonly PhraseSpan[],tonality:Tonality):HarmonyBar[] {
  if(!base.length||!supported.includes(tonality.scaleId)||tonality.tonic===null)return [...base];
  const home=pitchClass(tonality.tonic),classes=tonality.notes.map(pitchClass);
  const western=classes.length===7,result=base.map(bar=>({...bar,pitches:[...bar.pitches]}));
  const chord=(root:number):number[]=>{
    const index=classes.indexOf(root);
    if(western)return [root,classes[(index+2)%7],classes[(index+4)%7]];
    return [root,...[7,4,3,5,9,8].filter(i=>classes.includes(mod(root+i))).slice(0,1).map(i=>mod(root+i))];
  };
  for(const [index,phrase] of phrases.entries()) {
    const closed=phrase.role==='closing'||phrase.role==='answer';
    const open=classes.includes(mod(home+7))?mod(home+7):home;
    const root=closed?home:open;
    result[phrase.endBar]={root,pitches:chord(root),role:closed?'arrive':'depart'};
    if(western&&closed&&phrase.endBar>phrase.startBar) {
      // Natural minor keeps its actual minor dominant; no raised leading tone.
      const preparation=mod(home+7);
      result[phrase.endBar-1]={root:preparation,pitches:chord(preparation),role:'prepare'};
    } else if(!western&&index===phrases.length-1&&phrase.endBar>phrase.startBar) {
      result[phrase.endBar-1]={...result[phrase.endBar-1],role:'prepare'};
    }
  }
  return result;
}

export interface MotivicTarget {
  index:number;midi:number;weight:number;fixed?:boolean;preferredStep?:number;stepWeight?:number;
}

/** A small phrase blueprint, before the legal pitch path is solved. An answer
 * remembers the opening rhythm/interval gesture; development changes only its
 * tail or direction. Transpose the whole gesture into range, never clip notes.
 * These are related short phrases, not claims to implement full period/rondo form. */
export function planMotivicTargets(measures:MeasureData[],pitches:ScalePitch[],tonality:Tonality,
  difficulty:Difficulty,phrases:readonly PhraseSpan[],harmony:readonly HarmonyBar[],instrument?:string,strategy?:StudyStrategy):MotivicTarget[]|undefined {
  if(tonality.tonic===null||!supported.includes(tonality.scaleId)||pitches.length<5||phrases.length<2)return;
  if(strategy) {
    const developed=planStrategyTargets(measures,pitches,tonality,difficulty,phrases,harmony,strategy,instrument);
    if(developed)return developed;
  }
  const slots=measures.flatMap((bar,b)=>bar.events.flatMap(note=>note.rest?[]:[{note,bar:b}]));
  if(!slots.length)return;
  const random=melodicRandom(slots.map(slot=>slot.note)),maxLeap=PITCH_DIFFICULTY[difficulty].maxLeap;
  const scalarMotifs=[[0,1,2,1],[0,2,1,0],[0,1,0,2],[0,-1,0,1],[0,1,2,3],[0,-1,-2,-1]];
  const motifs=difficulty==='beginner'?scalarMotifs:difficulty==='intermediate'?
    [[0,2,1,3],[0,2,4,2],[0,3,1,2],[0,2,3,1]]:[[0,4,2,5],[0,3,6,2],[0,5,2,4],[0,4,1,3]];
  const rapidEntry=phrases.some(phrase=>slots.filter(slot=>slot.bar>=phrase.startBar&&slot.bar<=phrase.endBar).slice(0,4).some(slot=>slot.note.duration==='32'));
  const vocabulary=rapidEntry?[scalarMotifs[0],scalarMotifs[5]]:motifs;
  const motif=vocabulary[Math.floor(random()*vocabulary.length)],variant=random()<.5?0:1;
  const home=pitchClass(tonality.tonic),western=tonality.notes.length===7;
  const foundation=planStudyMelody(measures,pitches,home,difficulty,instrument,phrases);
  // Retain the existing graded whole-phrase arc between structural decisions.
  // Interpolating every filler note toward one small arch flattened all tiers.
  const targets=new Map<number,MotivicTarget>(foundation.targets.map(target=>[target.index,{...target}]));
  const indexNear=(pc:number,desired:number)=>pitches.flatMap((p,i)=>p.midi%12===pc?[i]:[])
    .sort((a,b)=>Math.abs(pitches[a].midi-desired)-Math.abs(pitches[b].midi-desired))[0];
  const homeIndex=indexNear(home,foundation.targets[0]?.midi??(pitches[0].midi+pitches.at(-1)!.midi)/2);
  if(homeIndex===undefined)return;
  let previousEnding=homeIndex;
  for(const [phraseIndex,phrase] of phrases.entries()) {
    const members=slots.flatMap((slot,index)=>slot.bar>=phrase.startBar&&slot.bar<=phrase.endBar?[index]:[]);
    if(members.length<6)return;
    const closed=phrase.role==='closing'||phrase.role==='answer';
    const endPC=closed?home:(harmony[phrase.endBar]?.root??home);
    const ending=indexNear(endPC,pitches[previousEnding].midi);
    if(ending===undefined)return;
    const returning=phrase.role==='answer'||phrase.role==='closing';
    const shape=returning||phraseIndex===0?[...motif]:MOTIVIC_DEVELOPMENTS[variant].develop(motif);
    // Every candidate is a complete, in-range gesture checked in semitones.
    const entries=pitches.flatMap((pitch,anchor)=>{
      const path=shape.map(degree=>anchor+degree);
      if(path.some(i=>!pitches[i])||path.some((i,n)=>n&&Math.abs(pitches[i].midi-pitches[path[n-1]].midi)>maxLeap)||
        Math.abs(pitch.midi-pitches[previousEnding].midi)>maxLeap)return [];
      if(phraseIndex===0&&![0,3,4,7].includes(mod(pitch.midi-home)))return [];
      const last=path.at(-1)!,distance=Math.abs(pitches[last].midi-pitches[ending].midi);
      if(distance>maxLeap*(members.length-shape.length))return [];
      return [{anchor,path,cost:Math.abs(pitch.midi-pitches[previousEnding].midi)+
        (harmony[phrase.startBar]?.pitches.includes(pitch.midi%12)?0:3)}];
    }).sort((a,b)=>a.cost-b.cost);
    if(!entries.length)return;
    const picked=entries[Math.floor(random()*Math.min(phraseIndex===0?3:2,entries.length))];
    picked.path.forEach((degree,i)=>targets.set(members[i],{index:members[i],midi:pitches[degree].midi,weight:5,fixed:true}));
    const remaining=members.slice(shape.length),last=members.at(-1)!;
    // Both Western releases and modal落音 use the existing actual pitch set.
    targets.set(last,{index:last,midi:pitches[ending].midi,weight:6,fixed:true});
    if(closed&&remaining.length>=2) {
      const neighbors=[ending-1,ending+1].filter(i=>pitches[i]&&Math.abs(pitches[i].midi-pitches[ending].midi)<=maxLeap);
      const approach=neighbors[variant%neighbors.length];
      if(approach!==undefined)targets.set(last-1,{index:last-1,midi:pitches[approach].midi,weight:5,fixed:true});
    }
    // Weak Western releases remain open; pentatonic endpoints name a center,
    // with no assumption of a semitone leading tone or dominant resolution.
    if(!western&&!closed)targets.get(last)!.weight=4;
    previousEnding=ending;
  }
  return [...targets.values()];
}
