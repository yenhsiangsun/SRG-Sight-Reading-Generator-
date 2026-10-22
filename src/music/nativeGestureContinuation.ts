import type {Difficulty,MeasureData} from '../music';
import type {PhraseSpan} from './phrasePlan';
import type {HarmonyBar} from './phraseHarmony';
import type {DialogueTarget} from './thematicDialogue';
import type {RangeBoundPlan} from './rangeBoundContinuation';
import {planStudyMelody,type StudyForm,type StudyPhrase} from './studyMelody';
import {metricPosition} from './meterFeel';
import {PITCH_DIFFICULTY} from './pitchDifficulty';
import {pitchClass,type ScalePitch,type Tonality} from './scales';

interface Member {index:number;degree:number}
interface Placement {shift:number;members:Member[];midi:number[];cost:number;parent:number}
export interface NativeGesturePlan extends RangeBoundPlan {
  source:{form:StudyForm;phrases:StudyPhrase[];eventDegrees:number[]};
  sourceIdentity:{index:number;phrase:number;sourceDegree:number;placedDegree:number;shift:number}[];
  cadenceChanges:{index:number;before:number;after:number;reason:'phrase-release'|'final-approach'}[];
}

/** Independent, unregistered continuation strategy. Keep every sounded event
 * of the existing graded whole-study guide at its native rhythm position,
 * including phrases containing rests. There is no pulse projection or borrowed
 * rest-free window. Complete phrase translations are solved jointly, and a
 * whole register proposal is rejected if it cannot fit. Only the declared
 * modal releases/ending may change source degree intervals before the solver.
 * Guide fidelity is not a claim that the solver realizes every soft target. */
export function planNativeGestureContinuation(measures:MeasureData[],pitches:ScalePitch[],tonality:Tonality,
  difficulty:Difficulty,phrases:readonly PhraseSpan[],harmony:readonly HarmonyBar[],instrument?:string):NativeGesturePlan|undefined {
  if(measures.length<8||measures.length%2||pitches.length<5||tonality.tonic===null||!phrases.length||
    !['major','natural-minor','major-pentatonic','minor-pentatonic'].includes(tonality.scaleId)||
    measures.some(bar=>bar.timeSignature!==measures[0].timeSignature))return;
  const slots=measures.flatMap((bar,b)=>bar.events.flatMap(note=>note.rest?[]:[{note,bar:b}]));
  if(slots.length<12)return;
  const root=pitchClass(tonality.tonic),maxLeap=PITCH_DIFFICULTY[difficulty].maxLeap;
  const degreeOf=new Map(pitches.map((p,i)=>[p.midi,i]));
  const anchor=pitches.reduce((best,p,i)=>Math.abs(p.midi-slots[0].note.midi!)<Math.abs(pitches[best].midi-slots[0].note.midi!)?i:best,0);
  const budgets=[...new Set([pitches.length,Math.max(5,Math.ceil(pitches.length*.8)),Math.max(5,Math.ceil(pitches.length*.6))])];
  for(const [proposal,budget] of budgets.entries()) {
    const offset=Math.max(0,Math.min(pitches.length-budget,anchor-Math.floor(budget/2)));
    const source=planStudyMelody(measures,pitches.slice(offset,offset+budget),root,difficulty,instrument,phrases);
    const guide=new Map(source.targets.map(t=>[t.index,degreeOf.get(t.midi)]));
    if(slots.some((_,index)=>guide.get(index)===undefined))continue;
    const layers:Placement[][]=[];
    for(const [pi,phrase] of phrases.entries()) {
      const final=pi===phrases.length-1;
      const members:Member[]=slots.flatMap((s,index)=>s.bar>=phrase.startBar&&s.bar<=phrase.endBar?[{index,degree:guide.get(index)!}]:[]);
      if(!members.length){layers.push([]);break;}
      const low=Math.min(...members.map(m=>m.degree)),high=Math.max(...members.map(m=>m.degree));
      const placements:Placement[]=[];
      for(let shift=-low;shift<=pitches.length-1-high;shift++) {
        const midi=members.map(m=>pitches[m.degree+shift].midi);
        if(pi===0&&![0,3,4,7].includes((midi[0]-root+12)%12))continue;
        const releasePC=final?root:harmony[phrase.endBar]?.root??root;
        const release=pitches.filter(p=>p.midi%12===releasePC).sort((a,b)=>Math.abs(a.midi-midi.at(-1)!)-Math.abs(b.midi-midi.at(-1)!))[0];
        if(final&&!release)continue;
        if(release)midi[midi.length-1]=release.midi;
        if(final&&release&&midi.length>=2) {
          const home=degreeOf.get(release.midi)!,previous=midi.length>2?midi.at(-3):undefined;
          const approach=[home-1,home+1].filter(i=>pitches[i]&&Math.abs(pitches[i].midi-release.midi)<=3&&
            (previous===undefined||Math.abs(pitches[i].midi-previous)<=maxLeap))
            .sort((a,b)=>Math.abs(pitches[a].midi-midi.at(-2)!)-Math.abs(pitches[b].midi-midi.at(-2)!))[0];
          if(approach===undefined)continue;
          midi[midi.length-2]=pitches[approach].midi;
        }
        if(midi.some((n,i)=>i>0&&Math.abs(n-midi[i-1])>maxLeap))continue;
        let cost=Math.abs(shift)*.05,parent=-1;
        if(pi>0) {
          let best=Infinity;
          layers[pi-1].forEach((previous,i)=>{
            const distance=Math.abs(previous.midi.at(-1)!-midi[0]);
            if(distance>maxLeap||!Number.isFinite(previous.cost))return;
            const next=previous.cost+cost+distance*.12;
            if(next<best){best=next;parent=i;}
          });
          cost=best;
        }
        if(Number.isFinite(cost))placements.push({shift,members,midi,cost,parent});
      }
      layers.push(placements);if(!placements.length)break;
    }
    if(layers.length!==phrases.length||layers.some(layer=>!layer.length))continue;
    const last=layers.at(-1)!;let selected=last.reduce((best,p,i)=>p.cost<last[best].cost?i:best,0);
    const placed:Placement[]=[];
    for(let i=layers.length-1;i>=0;i--){const p=layers[i][selected];placed.unshift(p);selected=p.parent;}
    const targets:DialogueTarget[]=new Array(slots.length),sourceIdentity:NativeGesturePlan['sourceIdentity']=[],cadenceChanges:NativeGesturePlan['cadenceChanges']=[];
    placed.forEach((p,pi)=>p.members.forEach((m,i)=>{
      const degree=degreeOf.get(p.midi[i])!,previous=i?p.midi[i-1]:placed[pi-1]?.midi.at(-1);
      const ending=i===p.members.length-1;
      targets[m.index]={index:m.index,midi:p.midi[i],weight:ending?7:metricPosition(measures[slots[m.index].bar],slots[m.index].note.startUnits).onPulse?4.8:3.3,
        preferredStep:previous===undefined?undefined:degree-degreeOf.get(previous)!,stepWeight:{beginner:2.4,intermediate:2,advanced:1.7}[difficulty]};
      sourceIdentity.push({index:m.index,phrase:pi,sourceDegree:m.degree,placedDegree:degree,shift:p.shift});
      if(degree!==m.degree+p.shift)cadenceChanges.push({index:m.index,before:pitches[m.degree+p.shift].midi,after:p.midi[i],
        reason:ending?'phrase-release':'final-approach'});
    }));
    if(Array.from(targets).some(t=>!t))continue;
    targets[0]={...targets[0],fixed:true};targets[targets.length-1]={...targets.at(-1)!,fixed:true};targets[targets.length-2]={...targets.at(-2)!,fixed:true};
    return {targets,proposalsTried:proposal+1,themeBudgetPitches:budget,
      // Structural compatibility for the frozen pulse connector. Here the
      // material is a full native opening phrase, not a two-bar pulse theme.
      themeDegrees:placed[0].members.map(m=>m.degree),phraseShifts:placed.map(p=>p.shift),
      openingIdentity:sourceIdentity.filter(m=>slots[m.index].bar<2).map(m=>({index:m.index,degree:m.placedDegree})),
      source:{form:source.form,phrases:source.phrases.map(p=>({...p})),eventDegrees:slots.map((_,i)=>guide.get(i)!)},sourceIdentity,cadenceChanges};
  }
}
