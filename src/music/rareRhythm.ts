import type {RhythmLevel} from '../music';
import {rhythmFocuses, type RhythmFocusSelection} from '../practice/focus';
import type {RhythmBarPlan} from './phraseRhythm';
import type {PracticeRhythmNote} from './practiceRhythm';

/** One brief four-note group per whole study, selected AFTER rhythm review so retries cannot
 * increase its probability. Only the melody gets it, never each hand separately. */
export function addRareThirtySeconds(plan:RhythmBarPlan[],level:RhythmLevel,focus:RhythmFocusSelection='balanced',random=Math.random):RhythmBarPlan[] {
  if(level==='simple'||rhythmFocuses(focus)[0]!=='balanced'||random()>=(level==='medium'?.12:.30))return plan;
  const candidates=plan.flatMap((bar,b)=>bar.notes.flatMap((note,n)=>{
    if(note.rest||note.tuplet||note.dots||note.startUnits%2!==0)return [];
    const next=bar.notes[n+1];
    const count=note.units===2?1:note.units===1&&next?.units===1&&!next.rest&&!next.tuplet&&!next.dots&&next.startUnits===note.startUnits+1?2:0;
    // Replace exactly one eighth-note span; never erase a rest, triplet or cadence.
    return count&&!(b===plan.length-1&&n+count>bar.notes.length-2)?[{b,n,count}]:[];
  }));
  if(!candidates.length)return plan;
  const {b,n,count}=candidates[Math.floor(random()*candidates.length)],original=plan[b].notes[n];
  const group:PracticeRhythmNote[]=Array.from({length:4},(_,i)=>({...original,duration:'32',units:.5,startUnits:original.startUnits+i*.5}));
  return plan.map((bar,index)=>index===b?{...bar,notes:[...bar.notes.slice(0,n),...group,...bar.notes.slice(n+count)]}:bar);
}
