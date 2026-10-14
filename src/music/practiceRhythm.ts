import type {RhythmLevel, RhythmPattern} from '../music';
import {focusedComposition, type RhythmFocus} from '../practice/focus';
import {addRhythmUnits} from './rhythmTiming';

interface EighthRhythmTemplate {
  tuplet?: 3;
  units: number[];
  /** Simple, medium, complex: rhythm level controls subdivision, not pitch difficulty. */
  weights: [number, number, number];
}

/** A pulse has a role in the bar, rather than being an unrelated random cell. */
export type EighthPulseRole = 'launch' | 'carry' | 'answer' | 'settle';

const EIGHTH_RHYTHMS: Record<number, EighthRhythmTemplate[]> = {
  4: [
    {units: [2, 2], weights: [12, 6, .5]},
    {units: [4], weights: [4, 2, .3]},
    {units: [1, 1, 2], weights: [2, 3, 3]},
    {units: [2, 1, 1], weights: [2, 3, 3]},
    {units: [3, 1], weights: [0, 2, 3]},
    {units: [1, 3], weights: [0, .5, 5]},
    {units: [1, 1, 1, 1], weights: [0, .7, 9]},
  ],
  6: [
    {units: [2, 2, 2], weights: [12, 6, .5]},
    {units: [4, 2], weights: [6, 2, .3]},
    {units: [2, 4], weights: [4, 1, .3]},
    {units: [6], weights: [2, 1, .2]},
    {units: [1, 1, 2, 2], weights: [3, 3, 1]},
    {units: [2, 1, 1, 2], weights: [3, 3, 1]},
    {units: [2, 2, 1, 1], weights: [3, 3, 1]},
    {units: [1, 1, 1, 1, 2], weights: [0, 1.2, 4]},
    {units: [1, 1, 2, 1, 1], weights: [0, 1.2, 4]},
    {units: [2, 1, 1, 1, 1], weights: [0, 1.2, 4]},
    {units: [1, 1, 1, 1, 1, 1], weights: [0, .2, 10]},
    {units: [3, 1, 2], weights: [0, 2, 3]},
    {units: [2, 3, 1], weights: [0, 2, 3]},
    {units: [1, 3, 2], weights: [0, .3, 5]},
    {units: [2, 1, 3], weights: [0, .3, 5]},
    {units: [3, 1, 1, 1], weights: [0, 0, 3]},
    {units: [1, 1, 1, 3], weights: [0, 0, 4]},
    // Two dotted eighths suggest a competing duple division; reserve this for rare complex practice.
    {units: [3, 3], weights: [0, 0, .15]},
  ],
};

/** Whole group templates retain readable eighth-note divisions and exact bar lengths. */
export function createGroupComposition(groupUnits: number, level: RhythmLevel, eighthMeter: boolean, allowTuplets = true,
  role?: EighthPulseRole, enteringMeter = false): RhythmPattern[] {
  const index = {simple: 0, medium: 1, complex: 2}[level];
  const templates = (eighthMeter ? EIGHTH_RHYTHMS[groupUnits] : QUARTER_RHYTHMS).filter(t=>
    (allowTuplets || !t.tuplet) && (!enteringMeter || groupUnits!==6 ||
      // Establish the three-eighth division before dotted syncopations obscure it.
      // A held whole pulse is useful later, but not as the only entry gesture.
      t.units.length>1 && !t.units.includes(3)));
  const weights = templates.map(template=>template.weights[index]);
  if(eighthMeter && role) {
    // Retain each tier's subdivision budget. Only redistribute where the long
    // and short notes fall within a group of equal sixteenth-note density.
    const density = (template:EighthRhythmTemplate)=>template.units.filter(units=>units===1).length;
    const shaped=templates.map((template,i)=>weights[i]*pulseShapeWeight(template.units,role));
    for(const count of new Set(templates.map(density))) {
      const matching=templates.map((template,i)=>density(template)===count?i:-1).filter(i=>i>=0);
      const original=matching.reduce((sum,i)=>sum+weights[i],0), adjusted=matching.reduce((sum,i)=>sum+shaped[i],0);
      for(const i of matching)weights[i]=adjusted?shaped[i]*original/adjusted:0;
    }
  }
  let draw = Math.random() * weights.reduce((sum, weight) => sum + weight, 0);
  const chosen = templates.find((_,i) => {
    draw -= weights[i];
    return draw < 0;
  }) ?? templates[0];
  return chosen.units.map(units => ({
    ...(chosen.tuplet ? {tuplet: chosen.tuplet} : {}),
    units, weight: 1, dots: units === 3 || units === 6 ? 1 : 0,
    duration: units === 1 ? '16' : units <= 3 ? '8' : 'q',
  }));
}

function pulseShapeWeight(units:readonly number[],role:EighthPulseRole) {
  const first=units[0],last=units.at(-1)!;
  if(role==='launch')return first>=4?3:first===2?1.8:last>=4?.45:.8;
  if(role==='answer')return last>=4?3.5:last===2?1.7:first>=4?.5:.8;
  if(role==='settle')return units.length===1?4:last>=4?4:last===2?1.5:.65;
  return units.every(n=>n===2)?3:units.length===1?.25:first>=4||last>=4?.55:1.5;
}

// Complete quarter-beat shapes make medium and complex genuinely different.
// Even beginner pitches can use every complex shape, including offbeat entries.
const QUARTER_RHYTHMS: EighthRhythmTemplate[] = [
  {units: [4], weights: [7, 5, .4]},
  {units: [2, 2], weights: [5, 7, .8]},
  {units: [1, 1, 2], weights: [0, 2, 3]},
  {units: [2, 1, 1], weights: [0, 2, 3]},
  {units: [1, 2, 1], weights: [0, 0, 6]},
  {units: [3, 1], weights: [0, 2, 3]},
  {units: [1, 3], weights: [0, .5, 5]},
  {units: [1, 1, 1, 1], weights: [0, .7, 9]},
  {units: [4/3, 4/3, 4/3], tuplet: 3, weights: [0.5, 1.7, 4]},
];

export interface PracticeRhythmNote extends Omit<RhythmPattern, 'weight'> {
  startUnits: number;
  rest: boolean;
}

/** Plan time and silence before drawing any pitches. Pitch/accidental choices
 * cannot change the available rhythms or consume this planner's random draws. */
export function createPracticeRhythm(groups: readonly number[], level: RhythmLevel, eighthMeter: boolean,
  state: {previousRest: boolean; opening: boolean}, focus: RhythmFocus = 'balanced',
  planned?: readonly (readonly Omit<RhythmPattern, 'weight'>[])[]): PracticeRhythmNote[] {
  const events: PracticeRhythmNote[] = [];
  const totalUnits = groups.reduce((sum, units) => sum + units, 0);
  // In 3/8 this is the bar's strong eighth, not an extra compound-meter beat.
  const tripleGroups = eighthMeter && groups.every(units => units === 6);
  let startUnits = 0, measureRestUnits = 0;
  for (const [groupIndex, beatUnits] of groups.entries()) {
    let beatRestUnits = 0;
    const composition = planned?.[groupIndex] ?? (focus === 'balanced' ? createGroupComposition(beatUnits, level, eighthMeter)
      : focusedComposition(beatUnits, focus, level));
    for (const [index, pattern] of composition.entries()) {
      // In compound-meter practice keep the dotted-quarter arrivals audible.
      // Rests may still occur inside each group; never erase the 3+3 pulse at random.
      const eligible = !(tripleGroups && index === 0) && !state.opening && !state.previousRest &&
        beatRestUnits + pattern.units <= beatUnits / 2 &&
        measureRestUnits + pattern.units <= totalUnits / 4;
      // Keep the existing low-silence policy; only rhythm level affects rests.
      const chance = .25 * ({simple: .6, medium: .85, complex: 1}[level]) * (eighthMeter ? .45 : .6);
      const rest = eligible && Math.random() < chance;
      events.push({duration: pattern.duration, dots: pattern.dots, units: pattern.units, startUnits, rest,
        ...('tuplet' in pattern && pattern.tuplet ? {tuplet: pattern.tuplet} : {})});
      startUnits = addRhythmUnits(startUnits, pattern.units);
      if (rest) {beatRestUnits += pattern.units; measureRestUnits += pattern.units;}
      state.previousRest = rest;
      state.opening = false;
    }
  }
  return events;
}
