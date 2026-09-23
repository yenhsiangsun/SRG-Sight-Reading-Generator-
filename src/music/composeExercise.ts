import {createPracticeRhythmPlan, generatePracticeExercise, type ExerciseData, type PracticeOptions} from '../music';
import {generateGrandExercise} from './grandStaff';
import {selectPhraseRhythmPlan} from './phraseRhythm';
import {addModalPhrasing} from './modalPhrasing';
import {reviewExercise, validateGeneratedExercise} from './exerciseQuality';

/** Rhythm, rests, meter and the final landing are fixed before auditioning pitch
 * candidates. Three attempts maximum keeps generation bounded on phones/tablets. */
export function composeExercise(options: PracticeOptions, grandMode?: 'mono'|'two-hand'): ExerciseData {
  const rhythm=createPracticeRhythmPlan(options);
  const lower=grandMode==='two-hand'?selectPhraseRhythmPlan(rhythm.map(bar=>bar.meter),options.rhythmLevel):undefined;
  let best:ExerciseData|undefined, bestPenalty=Infinity, validationError:unknown;
  for(let attempt=0;attempt<3;attempt++) {
    const raw=grandMode?generateGrandExercise(options,grandMode,rhythm,lower):generatePracticeExercise(options,rhythm);
    const candidate=addModalPhrasing(raw,options.range,options.allowAccidentals);
    try {validateGeneratedExercise(candidate,options.range,options.allowAccidentals);}
    catch(error) {validationError=error;continue;}
    const {penalty}=reviewExercise(candidate,options.range,options.allowAccidentals);
    if(penalty<bestPenalty){best=candidate;bestPenalty=penalty;}
    if(penalty===0)break;
  }
  if(!best)throw validationError??new Error('無法生成符合設定的樂譜。');
  return best;
}
