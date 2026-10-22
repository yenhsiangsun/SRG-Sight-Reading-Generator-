import type {Difficulty,MeasureData} from '../music';
import type {RhythmBarPlan} from './phraseRhythm';
import type {PhraseSpan} from './phrasePlan';
import type {HarmonyBar} from './phraseHarmony';
import {pulseGroups,metricPosition} from './meterFeel';
import {melodicRandom} from './melodicContours';
import {PITCH_DIFFICULTY} from './pitchDifficulty';
import {pitchClass,type ScalePitch,type Tonality} from './scales';

export interface DialogueTarget {index:number;midi:number;weight:number;fixed?:boolean;preferredStep?:number;stepWeight?:number}
interface Block {bar:number;start:number;units:number;notes:RhythmBarPlan['notes']}
const mod=(n:number)=>(n%12+12)%12;

/** Internal audition candidate. Two-bar units are developed as complete
 * themes; this does not claim a historical period form or a national genre. */
export function dialoguePhrases(count:number):PhraseSpan[] {
  const result:PhraseSpan[]=[];
  for(let start=0;start<count;start+=2)result.push({startBar:start,endBar:Math.min(count-1,start+1),
    role:start===0?'opening':start+2>=count?'closing':start===2?'answer':'development'});
  return result;
}

function blocksOf(plan:readonly RhythmBarPlan[]) {
  const result:Block[]=[];
  for(const [barIndex,bar] of plan.entries()) {
    let start=0,end=0,notes:RhythmBarPlan['notes']=[];
    for(const group of pulseGroups({timeSignature:bar.meter,groups:[]})) {
      notes.push(...bar.notes.filter(n=>n.startUnits>=end-1e-7&&n.startUnits<end+group-1e-7));end+=group;
      if(notes.length&&Math.abs(notes.at(-1)!.startUnits+notes.at(-1)!.units-end)<1e-7) {
        result.push({bar:barIndex,start,units:end-start,notes});start=end;notes=[];
      }
    }
  }
  return result;
}

/** Recall the ordered two-bar rhythmic theme using existing pulse blocks,
 * then recall its first half during development. No new duration/tuplet/rest
 * is introduced. A varied response tail avoids copying an entire finished bar. */
export function dialogueRhythm(plan:RhythmBarPlan[]):RhythmBarPlan[] {
  if(plan.length<8||plan.length%2)return plan;
  const blocks=blocksOf(plan),template=blocks.filter(b=>b.bar<2);
  const movable=blocks.filter(b=>b.bar>=2&&b.bar<plan.length-1&&b.notes.every(n=>!n.rest&&!n.tuplet));
  const available=new Set(movable),result=plan.map(bar=>({...bar,notes:bar.notes.map(n=>({...n}))}));
  const same=(a:Block,b:Block)=>a.units===b.units&&plan[a.bar].meter===plan[b.bar].meter;
  for(const destination of movable) {
    const phase=Math.floor(destination.bar/2),referenceBar=phase>=2&&phase<plan.length/2-1?0:destination.bar%2;
    const reference=template.find(b=>b.bar===referenceBar&&b.start===destination.start&&same(b,destination));
    const pool=[...available].filter(b=>same(b,destination));
    if(!pool.length)continue;
    const varyingTail=destination.bar===3&&destination.start+destination.units===plan[3].notes.reduce((sum,n)=>sum+n.units,0);
    const target=reference?.notes??destination.notes;
    const score=(block:Block)=>{
      const count=Math.abs(block.notes.length-target.length);
      const rhythm=block.notes.reduce((sum,n,i)=>sum+Math.abs(n.units-(target[Math.min(i,target.length-1)]?.units??n.units)),0);
      const exact=count===0&&rhythm===0;
      return count*3+rhythm+(varyingTail&&exact?5:0)+(block===destination ? .15 : 0);
    };
    pool.sort((a,b)=>score(a)-score(b)||a.bar-b.bar||a.start-b.start);
    const source=pool[0];available.delete(source);
    const bar=result[destination.bar];
    bar.notes=bar.notes.filter(n=>n.startUnits<destination.start-1e-7||n.startUnits>=destination.start+destination.units-1e-7)
      .concat(source.notes.map(n=>({...n,startUnits:destination.start+n.startUnits-source.start}))).sort((a,b)=>a.startUnits-b.startUnits);
  }
  return result;
}

const vocabulary:Record<Difficulty,readonly (readonly number[])[]>={
  beginner:[[0,1,2,3,2,1,0,1],[0,1,0,2,3,2,1,0],[0,-1,0,1,2,1,0,-1]],
  intermediate:[[0,2,4,3,1,2,3,1],[0,2,1,3,4,2,1,2],[0,-2,1,3,2,4,2,0]],
  advanced:[[0,4,1,5,2,6,4,2],[0,3,6,2,5,1,4,2],[0,-3,2,5,1,4,6,2]],
};

/** No studyMelody figure generator is called here. One original two-bar
 * pulse theme supplies the answer, sequenced fragments and returning close.
 * Weak subdivisions connect the actual pulse anchors in the selected scale. */
export function dialogueTargets(measures:MeasureData[],pitches:ScalePitch[],tonality:Tonality,difficulty:Difficulty,
  phrases:readonly PhraseSpan[],harmony:readonly HarmonyBar[]):DialogueTarget[]|undefined {
  if(measures.length<8||measures.length%2||pitches.length<5||tonality.tonic===null)return;
  const slots=measures.flatMap((bar,b)=>bar.events.flatMap(note=>note.rest?[]:[{note,bar:b}]));
  if(slots.length<12)return;
  const random=melodicRandom(slots.map(s=>s.note)),root=pitchClass(tonality.tonic);
  const count=pulseGroups(measures[0]).length*2;
  const choices=vocabulary[difficulty].map(shape=>Array.from({length:count},(_,i)=>shape[Math.round(i*(shape.length-1)/Math.max(1,count-1))]));
  const maxLeap=PITCH_DIFFICULTY[difficulty].maxLeap;
  // Fit a whole theme. Different actual scale gaps (notably pentatonic ones)
  // can reject a theme; never clip a few pitches to pretend it fits.
  const candidates=choices.flatMap(theme=>pitches.flatMap((pitch,anchor)=>{
    if(![0,3,4,7].includes(mod(pitch.midi-root)))return [];
    const path=theme.map(d=>anchor+d);
    if(path.some(i=>!pitches[i])||path.some((p,i)=>i&&Math.abs(pitches[p].midi-pitches[path[i-1]].midi)>maxLeap))return [];
    return [{theme,anchor,cost:Math.abs(anchor-(pitches.length-1)*.4)}];
  })).sort((a,b)=>a.cost-b.cost);
  if(!candidates.length)return;
  const picked=candidates[Math.floor(random()*Math.min(6,candidates.length))];
  const {theme,anchor}=picked,variant=random()<.5?1:-1;
  const intended=slots.map(slot=>{
    const pulse=metricPosition(measures[slot.bar],slot.note.startUnits),unit=Math.floor(slot.bar/2);
    const position=(slot.bar%2)*count/2+pulse.group,progress=pulse.offset/pulse.units;
    const final=unit===measures.length/2-1;
    const fragment=unit>=2&&!final;
    const length=fragment?Math.max(2,Math.ceil(theme.length/2)):theme.length;
    const index=position%length,next=(index+1)%length;
    const shift=unit===0?0:final?0:unit===1?variant:variant*(unit%2?2:1);
    // A response changes the full theme's level, then releases its tail.
    const alteration=unit===1&&position>=count-2?-variant:0;
    return anchor+theme[index]+(theme[next]-theme[index])*progress+shift+alteration;
  });
  // Transpose each complete two-bar gesture as a unit into the available range.
  // If the gesture is too wide, retain the previous safe planner instead.
  for(let unit=0;unit<measures.length/2;unit++) {
    const members=slots.flatMap((s,i)=>Math.floor(s.bar/2)===unit?[i]:[]);
    const low=Math.min(...members.map(i=>intended[i])),high=Math.max(...members.map(i=>intended[i]));
    if(high-low>pitches.length-1)return;
    const shift=low<0?Math.ceil(-low):high>pitches.length-1?Math.floor(pitches.length-1-high):0;
    members.forEach(i=>{intended[i]+=shift;});
  }
  const targets:DialogueTarget[]=slots.map((slot,index)=>{
    const degree=Math.round(intended[index]);
    return {index,midi:pitches[degree].midi,weight:metricPosition(measures[slot.bar],slot.note.startUnits).onPulse?5:3.2,
      preferredStep:index?degree-Math.round(intended[index-1]):undefined,stepWeight:{beginner:2.4,intermediate:2,advanced:1.7}[difficulty]};
  });
  const near=(pc:number,midi:number)=>pitches.filter(p=>p.midi%12===pc).sort((a,b)=>Math.abs(a.midi-midi)-Math.abs(b.midi-midi))[0];
  targets[0]={...targets[0],fixed:true};
  for(const phrase of phrases) {
    const last=slots.findLastIndex(s=>s.bar<=phrase.endBar);
    if(last<1)continue;
    const final=last===slots.length-1;
    // Western supports use actual diatonic chords; modal supports retain the
    // existing centre/open dyad plan. No raised leading tone is manufactured.
    const pc=final?root:harmony[phrase.endBar]?.root??root;
    const release=near(pc,targets[last].midi);
    if(!release)continue;
    targets[last]={index:last,midi:release.midi,weight:7,fixed:final};
    if(final) {
      const home=pitches.indexOf(release),neighbors=[home-1,home+1].filter(i=>pitches[i]&&Math.abs(pitches[i].midi-release.midi)<=3);
      const approach=neighbors[Math.floor(random()*neighbors.length)];
      if(approach!==undefined)targets[last-1]={index:last-1,midi:pitches[approach].midi,weight:6,fixed:true};
    }
  }
  return targets;
}
