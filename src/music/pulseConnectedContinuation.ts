import type {Difficulty,GeneratedNote,MeasureData} from '../music';
import type {DialogueTarget} from './thematicDialogue';
import type {PhraseSpan} from './phrasePlan';
import type {ScalePitch} from './scales';
import {metricPosition,pulseGroups} from './meterFeel';
import {PITCH_DIFFICULTY} from './pitchDifficulty';
import {planRangeBoundContinuation,type RangeBoundPlan} from './rangeBoundContinuation';

interface Slot {index:number;bar:number;note:GeneratedNote;time:number;pulse:ReturnType<typeof metricPosition>}
interface Connection {
  bar:number;pulse:number;ordinal:number;phrase:number;kind:'passing'|'neighbor-return';
  indices:number[];before:number[];after:number[];changedIndices:number[];
}
export interface PulseConnectedPlan {
  targets:DialogueTarget[];
  skeleton:RangeBoundPlan;
  anchorIdentity:{index:number;midi:number}[];
  plateauGroups:number;
  legalGestureGroups:number;
  connectedGroups:Connection[];
  retainedPlateauGroups:number;
  guardedReason?:'base-path-not-scalar';
}

/** Only an isolated planning candidate. Repetition can be a rhythmic gesture:
 * two-note cells, articulated cells, gaps and phrase releases are preserved.
 * Whole-pulse scalar gestures are proposed before the melody solver, using
 * the next structural anchor rather than random pitch noise. */
export function connectPulseTargets(measures:MeasureData[],pitches:ScalePitch[],difficulty:Difficulty,
  phrases:readonly PhraseSpan[],skeleton:RangeBoundPlan):PulseConnectedPlan|undefined {
  const slots:Slot[]=[];let time=0,ordinal=0;
  const groups:{bar:number;pulse:number;ordinal:number;members:Slot[]}[]=[];
  measures.forEach((bar,b)=>{
    const counts=pulseGroups(bar).length;
    bar.events.forEach(note=>{
      if(note.rest)return;
      const pulse=metricPosition(bar,note.startUnits),slot={index:slots.length,bar:b,note,time:time+note.startUnits,pulse};slots.push(slot);
      let group=groups.find(g=>g.bar===b&&g.pulse===pulse.group);
      if(!group){group={bar:b,pulse:pulse.group,ordinal:ordinal+pulse.group,members:[]};groups.push(group);}
      group.members.push(slot);
    });
    time+=bar.totalUnits;ordinal+=counts;
  });
  if(slots.length!==skeleton.targets.length||!slots.length)return;
  const degreeOf=new Map(pitches.map((p,i)=>[p.midi,i])),maxLeap=PITCH_DIFFICULTY[difficulty].maxLeap;
  const protectedIndices=new Set(skeleton.targets.flatMap(t=>t.fixed?[t.index]:[]));
  slots.filter(s=>s.pulse.onPulse).forEach(s=>protectedIndices.add(s.index));
  for(const phrase of phrases){const last=slots.findLastIndex(s=>s.bar<=phrase.endBar);if(last>=0)protectedIndices.add(last);}
  const anchorIdentity=[...protectedIndices].sort((a,b)=>a-b).map(index=>({index,midi:skeleton.targets[index].midi}));
  const result:PulseConnectedPlan={targets:skeleton.targets.map(t=>({...t})),skeleton,anchorIdentity,plateauGroups:0,
    legalGestureGroups:0,connectedGroups:[],retainedPlateauGroups:0};
  const valid=(targets:readonly DialogueTarget[])=>targets.every((t,i)=>{
    const degree=degreeOf.get(t.midi);if(degree===undefined)return false;
    if(!i)return true;
    const previous=degreeOf.get(targets[i-1].midi);if(previous===undefined||Math.abs(t.midi-targets[i-1].midi)>maxLeap)return false;
    return slots[i].note.duration!=='32'||slots[i-1].note.duration!=='32'||Math.abs(degree-previous)<=1;
  });
  // Preserve the baseline when its soft 32nd-note guide itself needs the
  // existing solver's scalar correction; do not add constraints to that path.
  if(!valid(result.targets)){result.guardedReason='base-path-not-scalar';return result;}
  const opportunities:Connection[]=[];
  for(const group of groups) {
    const members=group.members,first=members[0],last=members.at(-1)!,next=slots[last.index+1];
    if(members.length<3||!first.pulse.onPulse||!next?.pulse.onPulse||
      Math.abs(last.note.startUnits+last.note.durationUnits-first.pulse.start-first.pulse.units)>1e-7||
      Math.abs(last.time+last.note.durationUnits-next.time)>1e-7||
      members.some((s,i)=>s.note.articulation||s.note.technique||s.note.chord||
        i>0&&(protectedIndices.has(s.index)||Math.abs(members[i-1].time+members[i-1].note.durationUnits-s.time)>1e-7)))continue;
    const pi=phrases.findIndex(p=>first.bar>=p.startBar&&first.bar<=p.endBar);
    if(pi<0||next.bar>phrases[pi].endBar)continue;
    const original=members.map(s=>skeleton.targets[s.index].midi),a=degreeOf.get(original[0])!,b=degreeOf.get(skeleton.targets[next.index].midi)!;
    if(!original.every(midi=>midi===original[0]))continue;
    // A three-note rhythmic repetition is retained unless it continues an
    // already longer run. This is not a requirement that every repeat move.
    if(members.length===3&&skeleton.targets[first.index-1]?.midi!==original[0]&&skeleton.targets[next.index].midi!==original[0])continue;
    result.plateauGroups++;
    const candidates:{kind:Connection['kind'];degrees:number[]}[]=[];
    if(a!==b) {
      candidates.push({kind:'passing',degrees:members.map(s=>Math.round(a+(b-a)*s.pulse.offset/s.pulse.units))});
    } else {
      const later=slots.slice(next.index+1).find(s=>s.bar<=phrases[pi].endBar&&s.pulse.onPulse&&skeleton.targets[s.index].midi!==original[0]);
      const earlier=slots.slice(0,first.index).findLast(s=>s.pulse.onPulse&&skeleton.targets[s.index].midi!==original[0]);
      const direction=later?Math.sign(skeleton.targets[later.index].midi-original[0]):earlier?Math.sign(original[0]-skeleton.targets[earlier.index].midi):1;
      for(const sign of [direction,-direction]) {
        const degrees=members.map(()=>a);degrees[Math.floor(members.length/2)]=a+sign;
        candidates.push({kind:'neighbor-return',degrees});
      }
    }
    for(const candidate of candidates) {
      if(candidate.degrees.some(d=>!pitches[d]))continue;
      const after=candidate.degrees.map(d=>pitches[d].midi),changedIndices=members.filter((_s,i)=>after[i]!==original[i]).map(s=>s.index);
      if(!changedIndices.length)continue;
      const proposed=result.targets.map(t=>({...t}));members.forEach((s,i)=>{proposed[s.index].midi=after[i];});
      if(!valid(proposed)||anchorIdentity.some(anchor=>proposed[anchor.index].midi!==anchor.midi))continue;
      opportunities.push({bar:group.bar,pulse:group.pulse,ordinal:group.ordinal,phrase:pi,kind:candidate.kind,
        indices:members.map(s=>s.index),before:original,after,changedIndices});break;
    }
  }
  result.legalGestureGroups=opportunities.length;
  for(const [pi,phrase] of phrases.entries()) {
    const eligible=opportunities.filter(g=>g.phrase===pi),limit=Math.min(difficulty==='beginner'?1:2,Math.ceil(eligible.length/2));
    for(let pick=0;pick<limit;pick++) {
      const desired=phrase.startBar+(phrase.endBar-phrase.startBar+1)*(pick===0?.35:.7);
      const available=eligible.filter(g=>!result.connectedGroups.some(previous=>previous.bar===g.bar||Math.abs(previous.ordinal-g.ordinal)<2))
        .sort((a,b)=>Math.abs(a.bar+a.pulse/pulseGroups(measures[a.bar]).length-desired)-Math.abs(b.bar+b.pulse/pulseGroups(measures[b.bar]).length-desired)||a.ordinal-b.ordinal);
      const chosen=available[0];if(!chosen)break;
      const proposed=result.targets.map(t=>({...t}));chosen.indices.forEach((index,i)=>{proposed[index].midi=chosen.after[i];});
      if(!valid(proposed))continue;
      result.targets=proposed;result.connectedGroups.push(chosen);
    }
  }
  result.retainedPlateauGroups=result.plateauGroups-result.connectedGroups.length;
  result.targets=result.targets.map((t,i)=>({...t,preferredStep:i?degreeOf.get(t.midi)!-degreeOf.get(result.targets[i-1].midi)!:t.preferredStep}));
  return result;
}

export function planPulseConnectedContinuation(...args:Parameters<typeof planRangeBoundContinuation>):PulseConnectedPlan|undefined {
  const skeleton=planRangeBoundContinuation(...args);if(!skeleton)return;
  return connectPulseTargets(args[0],args[1],args[3],args[4],skeleton);
}
export function pulseConnectedContinuationTargets(...args:Parameters<typeof planRangeBoundContinuation>) {
  return planPulseConnectedContinuation(...args)?.targets;
}
