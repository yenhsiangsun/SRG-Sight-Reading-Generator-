import {generatePracticeExercise, type ExerciseData, type PracticeOptions} from '../music';
import {generateGrandExercise,createGrandAccompanimentRhythmPlan} from './grandStaff';
import {coordinateGrandStaff} from './grandAccompaniment';
import {planMusicalIntent} from './musicalIntent';
import {addModalPhrasing} from './modalPhrasing';
import {planBreathing,instrumentMotionPenalty} from './instrumentPlayability';
import {addRareThirtySeconds} from './rareRhythm';
import {validateGeneratedExercise,reviewExercise} from './exerciseQuality';
import {settleGrandPhraseRhythm} from './grandPhraseRelease';
import {addPipaRollRhythm} from './pipaRollRhythm';

/** An explicit, reversible entry point. Legacy composition consumes no new
 * random draws; every new candidate shares one prior form/rhythm/harmony plan. */
export function composeIntentExercise(options:PracticeOptions,grandMode?:'mono'|'two-hand'):ExerciseData {
  const intent=planMusicalIntent(options);
  const withRollOpportunity=addPipaRollRhythm(intent.rhythm,options,intent.phrases);
  const rhythm=addRareThirtySeconds(planBreathing(withRollOpportunity,options.instrumentProfile,intent.phrases),options.rhythmLevel,options.rhythmFocus);
  intent.rhythm=rhythm;
  const lower=grandMode==='two-hand'?createGrandAccompanimentRhythmPlan(rhythm.map(b=>b.meter),options.rhythmLevel):undefined;
  let best:ExerciseData|undefined,penalty=Infinity,lastError:unknown;
  for(let attempt=0;attempt<3;attempt++){
    const raw=grandMode?generateGrandExercise(options,grandMode,rhythm,lower):generatePracticeExercise(options,rhythm);
    raw.phrasePlan=intent.phrases.map(({startBar,endBar,role})=>({startBar,endBar,role}));raw.musicalIntent=intent;
    const shaped=addModalPhrasing(raw,options.range,false,intent.harmony,true,options.instrumentProfile);
    const candidate=coordinateGrandStaff(shaped,options.range,false,false);
    try{validateGeneratedExercise(candidate,options.range,false);}catch(error){lastError=error;continue;}
    const cost=reviewExercise(candidate,options.range,false).penalty+instrumentMotionPenalty(candidate,options.instrumentProfile);
    if(cost<penalty){best=candidate;penalty=cost;}
    if(cost===0)break;
  }
  if(!best)throw lastError??new Error('目前音域無法完成這段樂句，請調整音域。');
  // Do this after choosing the original complete candidate, so accompaniment
  // breathing cannot perturb the RNG or select a different upper melody.
  const relaxed=settleGrandPhraseRhythm(best);
  if(relaxed===best)return best;
  const coordinated=coordinateGrandStaff(relaxed,options.range,false,false);
  try{validateGeneratedExercise(coordinated,options.range,false);return coordinated;}
  catch{return best;} // A narrow register keeps its already legal original.
}
