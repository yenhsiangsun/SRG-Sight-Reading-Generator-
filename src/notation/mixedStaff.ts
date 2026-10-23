import type {Clef, ExerciseData, MeasureData, TimeSignature} from '../music';
import {notePitches} from '../music/notePitches';
import {ledgerCount, planOctaveLines} from './octaveLines';
import {normalizeMixedClefs} from './mixedClefs';
import type {PhraseSpan} from '../music/phrasePlan';

const defaultStates: {clef: Clef;shift:number}[] = [
  {clef:'treble',shift:0}, {clef:'bass',shift:0},
  {clef:'treble',shift:1}, {clef:'bass',shift:-1},
];

export function usesMixedStaff(exercise: ExerciseData) {
  if (exercise.lowerMeasures) return false;
  // Preserve the previous renderer for saved pipa studies without this new setting.
  return exercise.staffMode === 'mixed' || (exercise.staffMode === undefined &&
    exercise.soundProfile === 'Pipa' && ['treble','bass'].includes(exercise.clef));
}

/** Keep the written register stable across a phrase. Brief, readable third
 * ledger lines (four on a brief eighth or shorter) are preferable to switching
 * clef for a passing note. Costs use sounding duration, so a dense
 * sixteenth-note figure cannot outvote its phrase.
 * Large register changes still override continuity; no musical data is edited.
 */
export function planMixedStaff(measures: readonly MeasureData[], initial: Clef = 'treble', fallback: TimeSignature = '4/4', allowedClefs?: readonly Clef[], phrases?: readonly Pick<PhraseSpan,'startBar'|'endBar'>[]) {
  const selected = normalizeMixedClefs(allowedClefs);
  // Keep the original states AND their ordering for existing treble/bass scores.
  const states: {clef: Clef;shift:number}[] = selected.length === 2 && selected[0] === 'treble' && selected[1] === 'bass'
    ? defaultStates
    : [
      ...selected.map(clef => ({clef,shift:0})),
      ...selected.filter(clef => clef !== 'bass').map(clef => ({clef,shift:1})),
      ...selected.filter(clef => clef !== 'treble').map(clef => ({clef,shift:-1})),
    ];
  const phraseStarts = new Set(phrases?.map(phrase => phrase.startBar) ?? []);
  const events = measures.flatMap((measure,bar) => {
    const meter = measure.timeSignature ?? fallback;
    const lengths = meter.endsWith('/4') ? Array(measure.totalUnits/4).fill(4) as number[] : measure.beamGroups;
    const boundaries = [0];
    for (const length of lengths) boundaries.push(boundaries.at(-1)! + length);
    const phraseStart = phraseStarts.size ? phraseStarts.has(bar) : bar%4===0 ||
      bar>0 && meter !== (measures[bar-1].timeSignature??fallback);
    return measure.events.map((note,index) => ({note,bar,index,boundary:boundaries.includes(note.startUnits),phraseStart:index===0&&phraseStart}));
  });
  const parents: number[][] = [];
  let costs = states.map(state => (state.clef === initial ? 0 : 4) + (state.shift ? 18 : 0));
  let awaitingPhrase = true, silence = 0;
  events.forEach(({note,boundary,phraseStart},index) => {
    if(phraseStart)awaitingPhrase=true;
    const pitches = notePitches(note);
    const ledgers = states.map(state => pitches.map(pitch => ledgerCount(pitch.key,state.clef,state.shift)));
    const worst = ledgers.map(counts => Math.max(0,...counts));
    const limit = Math.max(note.durationUnits<=2?4:3,Math.min(...worst));
    const previousNote = events[index-1]?.note;
    // Defer a phrase entrance through opening silence; a breath is also a
    // natural place to introduce the register of the following passage.
    const entrance = awaitingPhrase || silence>=4;
    if(note.rest)silence+=note.durationUnits;
    else {awaitingPhrase=false;silence=0;}
    const insideBeam = !boundary && !!previousNote && !previousNote.rest && !note.rest &&
      ['8','16','32'].includes(previousNote.duration) && ['8','16','32'].includes(note.duration);
    const parent: number[] = [];
    const next = states.map((state,current) => {
      const alternatives = states.map((previous,from) => {
        if (note.rest && current !== from) return Infinity;
        const clefCost = state.clef === previous.clef ? 0 : entrance ? 24 : insideBeam ? 180 : 80;
        const octaveCost = state.shift === previous.shift ? 0 : entrance ? 18 : insideBeam ? 70 : 48;
        return costs[from] + clefCost + octaveCost;
      });
      const best = alternatives.indexOf(Math.min(...alternatives));
      parent.push(best);
      if (worst[current] > limit) return Infinity;
      const duration = note.durationUnits/4;
      const emission = note.rest ? 0 : duration*(worst[current]**2*3 +
        ledgers[current].reduce((sum,count) => sum+count,0) + (state.shift ? 18 : 0));
      return alternatives[best] + emission;
    });
    parents.push(parent); costs = next;
  });
  let chosen = costs.indexOf(Math.min(...costs));
  const plan = Array<number>(events.length);
  for (let i=events.length-1;i>=0;i--) {plan[i]=chosen;chosen=parents[i][chosen];}
  const clefs = measures.map(measure => measure.events.map(() => initial));
  const shifts = measures.map(measure => measure.events.map(() => 0));
  const first = events.findIndex(event => !event.note.rest);
  const last = events.findLastIndex(event => !event.note.rest);
  events.forEach(({bar,index},i) => {
    const state = states[plan[i]];
    clefs[bar][index] = state.clef;
    shifts[bar][index] = i>=first && i<=last ? state.shift : 0;
  });
  return {clefs,shifts};
}

export function planSingleStaff(exercise: ExerciseData, measures: readonly MeasureData[]) {
  return usesMixedStaff(exercise) ? planMixedStaff(measures,exercise.clef,exercise.timeSignature,exercise.mixedClefs,
    exercise.phrasePlan??exercise.musicalIntent?.phrases) : {
    clefs:measures.map(measure => measure.events.map(() => exercise.clef)),
    shifts:planOctaveLines(measures,exercise.clef),
  };
}
