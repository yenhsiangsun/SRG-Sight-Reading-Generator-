import {addRareThirtySeconds} from './rareRhythm';
import {createPracticeRhythmPlan, generatePracticeExercise, type ExerciseData, type PracticeOptions} from '../music';
import {generateGrandExercise} from './grandStaff';
import {selectPhraseRhythmPlan} from './phraseRhythm';
import {addModalPhrasing} from './modalPhrasing';
import {reviewExercise, validateGeneratedExercise} from './exerciseQuality';
import {planPhraseHarmony} from './phraseHarmony';
import {describeTonality} from './scales';
import {planBreathing, instrumentMotionPenalty} from './instrumentPlayability';
import {addScalePractice} from './scalePractice';
import {addLeapPractice} from './leapPractice';

/** Rhythm, rests, meter and the final landing are fixed before auditioning pitch
 * candidates. Three attempts maximum keeps generation bounded on phones/tablets. */
export function composeExercise(options: PracticeOptions, grandMode?: 'mono'|'two-hand'): ExerciseData {
  const rhythm=addRareThirtySeconds(planBreathing(createPracticeRhythmPlan(options),options.instrumentProfile),options.rhythmLevel,options.rhythmFocus);
  const lower=grandMode==='two-hand'?selectPhraseRhythmPlan(rhythm.map(bar=>bar.meter),options.rhythmLevel,'balanced',options.rhythmLevel==='simple'?0:undefined):undefined;
  const harmony=options.allowAccidentals?[]:planPhraseHarmony(describeTonality(options.tonic??options.keySignature,options.scaleId??'major'),
    rhythm.map(bar=>bar.meter),rhythm.reduce((sum,b)=>sum+b.notes.length,0));
  let best:ExerciseData|undefined, bestPenalty=Infinity, validationError:unknown;
  for(let attempt=0;attempt<3;attempt++) {
    const raw=grandMode?generateGrandExercise(options,grandMode,rhythm,lower):generatePracticeExercise(options,rhythm);
    const shaped=addModalPhrasing(raw,options.range,options.allowAccidentals,harmony,true,options.instrumentProfile);
    const candidate=options.pitchFocus==='scales'?addScalePractice(shaped,options.range):options.pitchFocus==='leaps'?addLeapPractice(shaped,grandMode==='two-hand'?{min:60,max:options.range.max}:options.range):shaped;
    try {validateGeneratedExercise(candidate,options.range,options.allowAccidentals);}
    catch(error) {validationError=error;continue;}
    const penalty=reviewExercise(candidate,options.range,options.allowAccidentals).penalty+instrumentMotionPenalty(candidate,options.instrumentProfile);
    if(penalty<bestPenalty){best=candidate;bestPenalty=penalty;}
    if(penalty===0)break;
  }
  if(!best)throw validationError??new Error('無法生成符合設定的樂譜。');
  return best;
}
