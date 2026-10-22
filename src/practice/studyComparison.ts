import type {ExerciseData} from '../music';
import type {ExerciseSettings} from '../hooks/useExercise';

export interface StudySnapshot {
  exercise:ExerciseData;settings:ExerciseSettings;bpm:number;id:string;position:number;number:number;
}
export interface StudyComparison {previous:StudySnapshot|null;showingPrevious:boolean}

/** Session memory only: no browser storage or automatic favorite. Copy the
 * serializable study so later edits cannot change the piece being compared. */
export function makeStudySnapshot(snapshot:StudySnapshot):StudySnapshot {
  const copy:StudySnapshot=JSON.parse(JSON.stringify(snapshot));
  copy.position=Number.isFinite(snapshot.position)?Math.max(0,snapshot.position):0;
  return copy;
}

/** Swapping never composes a new study. Retain the original completion ID and
 * tempo when the caller restores it, even if its render counter changes. */
export function swapStudyComparison(state:StudyComparison,current:StudySnapshot|null){
  if(!state.previous||!current)return null;
  return {restore:state.previous,state:{previous:current,showingPrevious:!state.showingPrevious}};
}
