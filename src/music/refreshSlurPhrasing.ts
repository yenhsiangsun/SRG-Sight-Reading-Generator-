import type {ExerciseData} from '../music';
import {planMusicalSlurs} from './slurPhrasing';

/** Reopen an existing exercise with the corrected phrasing, without rerolling
 * its notes, rhythm, dynamics, techniques, hairpins or tempo. Scores that did
 * not have phrase slurs remain exactly as saved. */
export function refreshSlurPhrasing(exercise:ExerciseData,enabled=true):ExerciseData {
  if(!enabled||!exercise.phrasePlan?.length||!exercise.expressionSpans?.some(span=>span.kind==='slur'))return exercise;
  const slurs=exercise.expressionSpans.filter(span=>span.kind==='slur');
  const slurStaves=[...new Set(slurs.map(span=>span.staff))];
  const refreshedSlurs=slurStaves.flatMap(staff=>planMusicalSlurs(exercise,staff));
  // Hairpins can be interleaved with already-correct slurs in a saved score.
  // Compare only the phrasing before rebuilding, preserving its exact identity.
  if(JSON.stringify(refreshedSlurs)===JSON.stringify(slurs))return exercise;
  const expressionSpans=[...exercise.expressionSpans.filter(span=>span.kind!=='slur'),...refreshedSlurs];
  return {...exercise,expressionSpans};
}
