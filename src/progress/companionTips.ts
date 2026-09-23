import type {ExerciseData} from '../music';
import type {practiceCompanionMessages} from '../i18n/practiceCompanionMessages';

export type CompanionTip = Extract<keyof typeof practiceCompanionMessages, `tip${string}`>;
export const generalTips: readonly CompanionTip[] = ['tipScan', 'tipLookAhead', 'tipSlow', 'tipPhrase', 'tipContour', 'tipRecover', 'tipKind', 'tipReflect'];

/** Read the generated score only; never draw from the music generator's random stream. */
export function tipsForScore(exercise: ExerciseData): CompanionTip[] {
  let meter = exercise.timeSignature;
  const meters = exercise.measures.map(measure => (meter = measure.timeSignature ?? meter));
  const events = [...exercise.measures, ...(exercise.lowerMeasures ?? [])].flatMap(measure => measure.events);
  const tips: CompanionTip[] = [];
  if (new Set(meters).size > 1) tips.push('tipMixed');
  if (meters.some(value => value.endsWith('/8'))) tips.push('tipEighth');
  if (exercise.lowerMeasures) tips.push('tipGrand');
  if (events.some(event => !event.rest && event.duration === '16')) tips.push('tipSubdivision');
  if (events.some(event => event.rest)) tips.push('tipRest');
  return [...tips, ...generalTips];
}
