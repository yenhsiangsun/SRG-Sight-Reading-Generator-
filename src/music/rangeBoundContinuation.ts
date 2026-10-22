import type {Difficulty,MeasureData} from '../music';
import type {PhraseSpan} from './phrasePlan';
import type {HarmonyBar} from './phraseHarmony';
import type {DialogueTarget} from './thematicDialogue';
import {buildContinuationTheme} from './thematicContinuation';
import {melodicRandom} from './melodicContours';
import {metricPosition,pulseGroups} from './meterFeel';
import {PITCH_DIFFICULTY} from './pitchDifficulty';
import {pitchClass,type ScalePitch,type Tonality} from './scales';

const mod=(n:number)=>(n%12+12)%12;
interface Member {index:number;degree:number}
interface Placement {shift:number;members:Member[];midi:number[];cost:number;parent:number}
export interface RangeBoundPlan {
  targets:DialogueTarget[];
  proposalsTried:number;
  themeBudgetPitches:number;
  themeDegrees:number[];
  phraseShifts:number[];
  openingIdentity:{index:number;degree:number}[];
}
function stretch(points:readonly number[],position:number) {
  const p=Math.max(0,Math.min(1,position))*(points.length-1),i=Math.floor(p);
  return points[i]+(points[Math.min(i+1,points.length-1)]-points[i])*(p-i);
}

/** Isolated candidate, deliberately not registered in the production strategy
 * selector. Feasibility is decided for a complete phrase journey before the
 * melody solver sees targets. No note is clipped, and no hard range/leap rule
 * is relaxed. The original B04 theme constructor and transformations remain
 * frozen; only whole-plan proposal budgets and placement are changed here. */
export function planRangeBoundContinuation(measures:MeasureData[],pitches:ScalePitch[],tonality:Tonality,
  difficulty:Difficulty,phrases:readonly PhraseSpan[],harmony:readonly HarmonyBar[]):RangeBoundPlan|undefined {
  if(measures.length<8||measures.length%2||pitches.length<5||tonality.tonic===null||!phrases.length||
    !['major','natural-minor','major-pentatonic','minor-pentatonic'].includes(tonality.scaleId)||
    measures.some(bar=>bar.timeSignature!==measures[0].timeSignature))return;
  const slots=measures.flatMap((bar,b)=>bar.events.flatMap(note=>note.rest?[]:[{note,bar:b}]));
  if(slots.length<12)return;
  const root=pitchClass(tonality.tonic),maxLeap=PITCH_DIFFICULTY[difficulty].maxLeap;
  const random=melodicRandom(slots.map(s=>s.note)),perBar=pulseGroups(measures[0]).length;
  const anchor=pitches.reduce((best,p,i)=>Math.abs(p.midi-slots[0].note.midi!)<Math.abs(pitches[best].midi-slots[0].note.midi!)?i:best,0);
  const budgets=[...new Set([pitches.length,Math.max(5,Math.ceil(pitches.length*.8)),Math.max(5,Math.ceil(pitches.length*.6))])];
  let proposalsTried=0;
  // Four whole themes at each predeclared register budget, at most twelve.
  // Retrying changes the proposed path, never an already generated melody.
  for(const budget of budgets)for(let proposal=0;proposal<4;proposal++) {
    proposalsTried++;
    const offset=Math.max(0,Math.min(pitches.length-budget,anchor-Math.floor(budget/2)));
    const built=buildContinuationTheme(pitches.slice(offset,offset+budget),tonality,difficulty,perBar*2,random);
    if(!built)continue;
    const theme=built.degrees.map(n=>n+offset),intervals=theme.slice(1).map((n,i)=>n-theme[i]);
    const center=theme.reduce((sum,n)=>sum+n,0)/theme.length,layers:Placement[][]=[];
    for(const [pi,phrase] of phrases.entries()) {
      const length=(phrase.endBar-phrase.startBar+1)*perBar,final=pi===phrases.length-1,nodes:number[]=[];
      if(pi===0) {
        nodes.push(...theme);
        const tail=intervals.slice(Math.floor(intervals.length/2));
        for(let i=nodes.length;i<length;i++)nodes.push(nodes.at(-1)!-tail[(i-theme.length)%tail.length]);
      } else if(final) {
        const returning=built.route===1?theme.map(n=>center*2-n):theme;
        for(let i=0;i<length;i++)nodes.push(stretch(returning,i/Math.max(1,length-1)));
      } else {
        const tail=intervals.slice(0,Math.max(2,Math.ceil(intervals.length/2))),direction=pi%2?-1:1;
        nodes.push(theme.at(-1)!);
        for(let i=1;i<length;i++)nodes.push(nodes.at(-1)!+tail[(i-1)%tail.length]*direction);
      }
      const members:Member[]=slots.flatMap((s,index)=>{
        if(s.bar<phrase.startBar||s.bar>phrase.endBar)return [];
        const pulse=metricPosition(measures[s.bar],s.note.startUnits),at=(s.bar-phrase.startBar)*perBar+pulse.group;
        return [{index,degree:nodes[at]+(nodes[Math.min(at+1,nodes.length-1)]-nodes[at])*pulse.offset/pulse.units}];
      });
      if(!members.length){layers.push([]);break;}
      const low=Math.min(...members.map(m=>m.degree)),high=Math.max(...members.map(m=>m.degree));
      const placements:Placement[]=[];
      // A shift translates the entire phrase, including all of its intervals.
      // An oversized journey is rejected as a whole, not individually folded.
      for(let shift=Math.ceil(-low);shift<=Math.floor(pitches.length-1-high);shift++) {
        const midi=members.map(m=>pitches[Math.round(m.degree+shift)].midi);
        if(pi===0&&![0,3,4,7].includes(mod(midi[0]-root)))continue;
        const releasePC=final?root:harmony[phrase.endBar]?.root??root;
        const release=pitches.filter(p=>p.midi%12===releasePC).sort((a,b)=>Math.abs(a.midi-midi.at(-1)!)-Math.abs(b.midi-midi.at(-1)!))[0];
        if(final&&!release)continue;
        if(release)midi[midi.length-1]=release.midi;
        if(final&&release&&midi.length>=2) {
          const home=pitches.indexOf(release),previous=midi.length>2?midi.at(-3):undefined;
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
    for(let i=layers.length-1;i>=0;i--){const placement=layers[i][selected];placed.unshift(placement);selected=placement.parent;}
    const targets:DialogueTarget[]=new Array(slots.length);
    placed.forEach((placement,pi)=>placement.members.forEach((m,i)=>{
      const strong=metricPosition(measures[slots[m.index].bar],slots[m.index].note.startUnits).onPulse;
      const degree=pitches.findIndex(p=>p.midi===placement.midi[i]),previous=i?placement.midi[i-1]:placed[pi-1]?.midi.at(-1);
      targets[m.index]={index:m.index,midi:placement.midi[i],weight:i===placement.members.length-1?7:strong?4.8:3.3,
        preferredStep:previous===undefined?undefined:degree-pitches.findIndex(p=>p.midi===previous),
        stepWeight:{beginner:2.4,intermediate:2,advanced:1.7}[difficulty]};
    }));
    if(Array.from(targets).some(target=>!target))continue;
    targets[0]={...targets[0],fixed:true};
    targets[targets.length-1]={...targets.at(-1)!,fixed:true};
    targets[targets.length-2]={...targets.at(-2)!,fixed:true};
    return {targets,proposalsTried,themeBudgetPitches:budget,themeDegrees:theme,
      phraseShifts:placed.map(p=>p.shift),openingIdentity:placed[0].members.filter(m=>slots[m.index].bar<2)
        .map(m=>({index:m.index,degree:Math.round(m.degree+placed[0].shift)}))};
  }
}

export function rangeBoundContinuationTargets(...args:Parameters<typeof planRangeBoundContinuation>) {
  return planRangeBoundContinuation(...args)?.targets;
}
