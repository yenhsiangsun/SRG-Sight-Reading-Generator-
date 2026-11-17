import type {ExerciseData,PracticeOptions} from '../music';
import {composeExercise} from './composeExercise';
import {supportsMusicalIntent} from './musicalIntent';
import {isPluckedProfile} from './pluckedDevelopment';
import {composePluckedPhraseStudy,type PhraseStudyFocus} from './pluckedPhraseCandidate';
import {melodicVoice} from './exerciseQuality';

export const PLUCKED_RECIPES=['A','B-melody','B-rhythm','B-combined'] as const;
export type PluckedRecipe=typeof PLUCKED_RECIPES[number];
/** Session-only rotation. Saved scores, preferences and progress are untouched. */
export interface PluckedRecipeBag {context:string;used:PluckedRecipe[];last?:PluckedRecipe}
export function supportsAutomaticPlucked(options:PracticeOptions):boolean{
  return supportsMusicalIntent(options)&&isPluckedProfile(options.instrumentProfile);
}
function recipeContext(o:PracticeOptions,grand?:'mono'|'two-hand'):string{
  // Random tonality and tempo do not reset the user's practice rotation.
  return JSON.stringify([o.instrumentProfile,o.clef,grand??'',o.difficulty,o.rhythmLevel,o.measures,o.timeSignature,
    o.range.min,o.range.max,o.pitchFocus??'balanced',o.rhythmFocus??'balanced']);
}
export function choosePluckedRecipe(options:PracticeOptions,grand?:'mono'|'two-hand',bag?:PluckedRecipeBag,random:()=>number=Math.random):PluckedRecipe|undefined{
  if(!supportsAutomaticPlucked(options))return undefined;
  const previous=bag?.context===recipeContext(options,grand)?bag:undefined;
  const used=previous?.used??[],available=PLUCKED_RECIPES.filter(id=>!used.includes(id));
  // A newly opened context begins with the accepted B. At cycle boundaries,
  // exclude the last accepted recipe so two identical priorities do not abut.
  const choices=available.filter(id=>previous?available.length!==4||id!==previous.last:id!=='A');
  return choices[Math.min(choices.length-1,Math.floor(random()*choices.length))];
}
/** Commit once after a score is accepted; retries, failures, preview and resume
 * never advance this bag. A complete cycle contains A once and each B once. */
export function rememberPluckedRecipe(options:PracticeOptions,grand:'mono'|'two-hand'|undefined,recipe:PluckedRecipe,bag?:PluckedRecipeBag):PluckedRecipeBag{
  const context=recipeContext(options,grand),used=bag?.context===context?bag.used:[];
  const next=[...used.filter(id=>id!==recipe),recipe];
  return{context,used:next.length===PLUCKED_RECIPES.length?[]:next,last:recipe};
}
/** Preserve A and B as independently reproducible engines. Passing a recipe
 * consumes no selection draw, so the listened B samples still reproduce. */
export function composeAutomaticStudy(options:PracticeOptions,grand?:'mono'|'two-hand',recipe?:PluckedRecipe):ExerciseData{
  if(!supportsAutomaticPlucked(options))return composeExercise(options,grand);
  const selected=recipe??choosePluckedRecipe(options,grand)!;
  if(selected==='A')return composeExercise(options,grand);
  return composePluckedPhraseStudy(options,grand,selected.slice(2) as PhraseStudyFocus);
}

/** Prefer a fresh complete melody over an accidental long pitch plateau.
 * Rhythmic repeated-tone ideas, held notes and retained A remain legitimate.
 * This only ranks the existing bounded retry pool; it never rewrites music. */
export function scorePluckedStagnation(exercise:ExerciseData,recipe?:PluckedRecipe):number{
  if(recipe!=='B-melody'&&recipe!=='B-combined')return 0;
  let previous:number|undefined,run=0,longest=0;
  for(const bar of melodicVoice(exercise))for(const note of bar.events){
    if(note.rest){previous=undefined;run=0;continue;}
    run=note.midi===previous?run+1:1;previous=note.midi;longest=Math.max(longest,run);
  }
  return longest<7?0:Math.min(.99,.85+(longest-7)*.015);
}
