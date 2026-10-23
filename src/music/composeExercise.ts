import {addRareThirtySeconds} from './rareRhythm';
import {createPracticeRhythmPlan, generatePracticeExercise, type ExerciseData, type PracticeOptions} from '../music';
import {generateGrandExercise,createGrandAccompanimentRhythmPlan} from './grandStaff';
import {coordinateGrandStaff} from './grandAccompaniment';
import {addModalPhrasing} from './modalPhrasing';
import {reviewExercise, validateGeneratedExercise} from './exerciseQuality';
import {planPhraseHarmony} from './phraseHarmony';
import {describeTonality} from './scales';
import {planBreathing, instrumentMotionPenalty} from './instrumentPlayability';
import {addScalePractice} from './scalePractice';
import {addLeapPractice} from './leapPractice';
import {melodicRandom} from './melodicContours';
import {planExercisePhrases} from './phrasePlan';
import {supportsMotivicStudy,linkMotivicRhythm,phraseDirectedHarmony} from './motivicStudy';
import {planStudyStructure,shapeStrategyHarmony,type StudyStrategy} from './phraseStrategy';
import {chooseMacroForm} from './phraseForm';
import {supportsMusicalIntent} from './musicalIntent';
import {composeContrastStudy} from './contrastStudy';
import {addPipaRollRhythm} from './pipaRollRhythm';

/** Rhythm, rests, meter and the final landing are fixed before auditioning pitch
 * candidates. Three attempts maximum keeps generation bounded on phones/tablets. */
export function composeExercise(options: PracticeOptions, grandMode?: 'mono'|'two-hand',strategy?:StudyStrategy): ExerciseData {
  // Human-selected C: carry the longer melodic arc through ordinary studies.
  if(strategy===undefined&&supportsMusicalIntent(options))return composeContrastStudy(options,'long-line',grandMode);
  const motivic=supportsMotivicStudy(options,grandMode);
  // Promote the listened version only in its approved major 4/4 context.
  // Unsupported options draw no new random values and retain the old path.
  const variation=(strategy===undefined||strategy==='phrase-variation')&&motivic&&
    options.timeSignature==='4/4'&&(options.scaleId??'major')==='major';
  const macro=variation?chooseMacroForm(options,()=>Math.random()):undefined;
  const activeStrategy=macro?'phrase-variation':strategy==='phrase-variation'?undefined:strategy;
  const rawRhythm=createPracticeRhythmPlan(options,macro);
  const structure=motivic&&rawRhythm.length>=8?planStudyStructure(rawRhythm,activeStrategy,macro):undefined;
  const phrasePlan=structure?.phrases??planExercisePhrases(rawRhythm);
  const connectedRhythm=structure?.rhythm??(motivic?linkMotivicRhythm(rawRhythm,phrasePlan):rawRhythm);
  const withRollOpportunity=addPipaRollRhythm(connectedRhythm,options,phrasePlan);
  const rhythm=addRareThirtySeconds(planBreathing(withRollOpportunity,options.instrumentProfile,phrasePlan),options.rhythmLevel,options.rhythmFocus);
  const lower=grandMode==='two-hand'?createGrandAccompanimentRhythmPlan(rhythm.map(bar=>bar.meter),options.rhythmLevel):undefined;
  let best:ExerciseData|undefined, bestPenalty=Infinity, validationError:unknown;
  for(let attempt=0;attempt<3;attempt++) {
    const raw=grandMode?generateGrandExercise(options,grandMode,rhythm,lower):generatePracticeExercise(options,rhythm);
    raw.phrasePlan=phrasePlan;
    // Use the fresh pitch candidate's own local stream. Equal note counts no
    // longer imply equal harmony, and no extra draw disturbs either rhythm.
    const identity=melodicRandom(raw.measures.flatMap(bar=>bar.events));
    const baseHarmony=options.allowAccidentals?[]:planPhraseHarmony(describeTonality(options.tonic??options.keySignature,options.scaleId??'major'),
      rhythm.map(bar=>bar.meter),Math.floor(identity()*0x100000000));
    const useBlueprint=motivic&&!options.allowAccidentals&&(!options.pitchFocus||options.pitchFocus==='balanced');
    const harmony=useBlueprint?shapeStrategyHarmony(phraseDirectedHarmony(baseHarmony,phrasePlan,describeTonality(options.tonic??options.keySignature,options.scaleId??'major')),
      phrasePlan,describeTonality(options.tonic??options.keySignature,options.scaleId??'major'),structure?.strategy):baseHarmony;
    const shaped=addModalPhrasing(raw,options.range,options.allowAccidentals,harmony,true,options.instrumentProfile,useBlueprint,structure?.strategy);
    const focused=options.pitchFocus==='scales'?addScalePractice(shaped,options.range):options.pitchFocus==='leaps'?addLeapPractice(shaped,grandMode==='two-hand'?{min:60,max:options.range.max}:options.range):shaped;
    const candidate=coordinateGrandStaff(focused,options.range,options.allowAccidentals,options.pitchFocus==='scales');
    try {validateGeneratedExercise(candidate,options.range,options.allowAccidentals);}
    catch(error) {validationError=error;continue;}
    const penalty=reviewExercise(candidate,options.range,options.allowAccidentals,options.pitchFocus).penalty+instrumentMotionPenalty(candidate,options.instrumentProfile);
    if(penalty<bestPenalty){best=candidate;bestPenalty=penalty;}
    if(penalty===0)break;
  }
  if(!best)throw validationError??new Error('無法生成符合設定的樂譜。');
  return best;
}
