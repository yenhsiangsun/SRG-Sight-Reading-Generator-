import type {PracticeOptions} from '../music';
import {rhythmFocuses} from '../practice/focus';
import type {RhythmBarPlan} from './phraseRhythm';
import type {PhraseSpan} from './phrasePlan';
import {pulseGroups} from './meterFeel';
import {rhythmTicks} from './rhythmTiming';

type Options=Pick<PracticeOptions,'instrumentProfile'|'rhythmLevel'|'rhythmFocus'|'pitchFocus'|'range'>;
const activity=(plan:readonly RhythmBarPlan[])=>{
  const notes=plan.flatMap(b=>b.notes).filter(n=>!n.rest);
  return {attacks:notes.length,shortShare:notes.filter(n=>n.units<=1).length/Math.max(1,notes.length)};
};

/** One occasional sustained gesture, planned before pitches. Never merge
 * already composed melody notes or dilute an entire complex rhythm palette.
 * All pitch grades share the same gate and candidates. */
export function addPipaRollRhythm(plan:RhythmBarPlan[],options:Options,phrases:readonly PhraseSpan[],random:()=>number=Math.random):RhythmBarPlan[] {
  if(options.instrumentProfile!=='Pipa'||options.rhythmLevel!=='complex'||plan.length<4||options.range.max<57||
    rhythmFocuses(options.rhythmFocus)[0]!=='balanced'||options.pitchFocus&&options.pitchFocus!=='balanced')return plan;
  // Existing interior holds already provide a chance; do not add another one.
  if(plan.slice(1,-1).some(b=>b.notes.some(n=>!n.rest&&!n.tuplet&&n.units>=4)))return plan;
  const endings=new Set(phrases.map(p=>p.endBar)),before=activity(plan),candidates:RhythmBarPlan[][]=[];
  for(let bar=1;bar<plan.length-1;bar++){
    if(endings.has(bar))continue;
    const source=plan[bar],groups=pulseGroups({timeSignature:source.meter,groups:[]});
    let groupStart=0;
    for(const pulse of groups){
      // In a compound pulse keep the remaining eighth subdivision audible;
      // an occasional complete dotted-quarter hold is also a natural gesture.
      const windows=pulse===6?[[0,4],[2,4],...(groups.length>1?[[0,6]]:[])]:[[0,4]];
      for(const [offset,units]of windows){
        const start=groupStart+offset,end=start+units;
        const members=source.notes.filter(n=>rhythmTicks(n.startUnits)>=rhythmTicks(start)&&rhythmTicks(n.startUnits)<rhythmTicks(end));
        if(members.length<2||members.some(n=>n.rest||n.tuplet||n.units>=4)||
          rhythmTicks(members[0].startUnits)!==rhythmTicks(start)||
          rhythmTicks(members.at(-1)!.startUnits+members.at(-1)!.units)!==rhythmTicks(end))continue;
        const first=source.notes.indexOf(members[0]),last=source.notes.indexOf(members.at(-1)!);
        const hold={units,startUnits:start,duration:'q' as const,dots:units===6?1:0,rest:false};
        const candidate=plan.map((b,i)=>i===bar?{...b,notes:[...b.notes.slice(0,first),hold,...b.notes.slice(last+1)]}:b);
        const after=activity(candidate);
        // An expressive hold is not bought by turning the study into an
        // easier tier: retain at least90% of its attacks and most subdivisions.
        if(after.attacks>=before.attacks*.9&&after.shortShare>=.55&&after.shortShare>=before.shortShare-.1)candidates.push(candidate);
      }
      groupStart+=pulse;
    }
  }
  if(!candidates.length||random()>=.55)return plan;
  return candidates[Math.min(candidates.length-1,Math.floor(random()*candidates.length))];
}
