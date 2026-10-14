import type {ExerciseData} from '../music';
import {planMusicalSlurs} from './slurPhrasing';

/** Reopen an existing exercise with the corrected phrasing, without rerolling
 * its notes, rhythm, dynamics, techniques, hairpins or tempo. Scores that did
 * not have phrase slurs remain exactly as saved. */
export function refreshSlurPhrasing(exercise:ExerciseData,enabled=true):ExerciseData {
  if(!enabled||!exercise.phrasePlan?.length||!exercise.expressionSpans?.some(span=>span.kind==='slur'))return exercise;
  const slurStaves=[...new Set(exercise.expressionSpans.filter(span=>span.kind==='slur').map(span=>span.staff))];
  const expressionSpans=[...exercise.expressionSpans.filter(span=>span.kind!=='slur'),
    ...slurStaves.flatMap(staff=>planMusicalSlurs(exercise,staff))];
  if(JSON.stringify(expressionSpans)===JSON.stringify(exercise.expressionSpans))return exercise;
  return {...exercise,expressionSpans};
}
