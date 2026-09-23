import type {Clef, ExerciseData, MeasureData, TimeSignature} from '../music';
import {notePitches} from '../music/notePitches';
import {ledgerCount, planOctaveLines} from './octaveLines';

const states: {clef: Clef;shift:number}[] = [
  {clef:'treble',shift:0}, {clef:'bass',shift:0},
  {clef:'treble',shift:1}, {clef:'bass',shift:-1},
];

export function usesMixedStaff(exercise: ExerciseData) {
  if (exercise.lowerMeasures) return false;
  // Preserve the previous renderer for saved pipa studies without this new setting.
  return exercise.staffMode === 'mixed' || (exercise.staffMode === undefined &&
    exercise.soundProfile === 'Pipa' && ['treble','bass'].includes(exercise.clef));
}

/** Plan clef and octave displacement together over the entire phrase.
 * Prefer at most two ledger lines when the pitches allow it, even on an offbeat.
 * Clef/ottava changes cost more inside a beam group, so nearby pitches retain
 * their context. Extreme register changes may split a beam rather than leave
 * an unreadable pitch. No note, chord, rest, or time value is rewritten.
 */
export function planMixedStaff(measures: readonly MeasureData[], initial: Clef = 'treble', fallback: TimeSignature = '4/4') {
  const events = measures.flatMap((measure,bar) => {
    const meter = measure.timeSignature ?? fallback;
    const lengths = meter.endsWith('/4') ? Array(measure.totalUnits/4).fill(4) as number[] : measure.beamGroups;
    const boundaries = [0];
    for (const length of lengths) boundaries.push(boundaries.at(-1)! + length);
    return measure.events.map((note,index) => ({note,bar,index,boundary:boundaries.includes(note.startUnits)}));
  });
  const parents: number[][] = [];
  let costs = states.map(state => (state.clef === initial ? 0 : 4) + (state.shift ? 18 : 0));
  events.forEach(({note,boundary},index) => {
    const pitches = notePitches(note);
    const ledgers = states.map(state => pitches.map(pitch => ledgerCount(pitch.key,state.clef,state.shift)));
    const worst = ledgers.map(counts => Math.max(0,...counts));
    const limit = Math.max(2,Math.min(...worst));
    const previousNote = events[index-1]?.note;
    const insideBeam = !boundary && !!previousNote && !previousNote.rest && !note.rest &&
      ['8','16'].includes(previousNote.duration) && ['8','16'].includes(note.duration);
    const parent: number[] = [];
    const next = states.map((state,current) => {
      const alternatives = states.map((previous,from) => {
        if (note.rest && current !== from) return Infinity;
        const clefCost = state.clef === previous.clef ? 0 : (insideBeam ? 64 : 20);
        const octaveCost = state.shift === previous.shift ? 0 : (insideBeam ? 34 : 14);
        return costs[from] + clefCost + octaveCost;
      });
      const best = alternatives.indexOf(Math.min(...alternatives));
      parent.push(best);
      if (worst[current] > limit) return Infinity;
      const emission = note.rest ? 0 : worst[current]**2*3 +
        ledgers[current].reduce((sum,count) => sum+count,0) + (state.shift ? 18 : 0);
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
  return usesMixedStaff(exercise) ? planMixedStaff(measures,exercise.clef,exercise.timeSignature) : {
    clefs:measures.map(measure => measure.events.map(() => exercise.clef)),
    shifts:planOctaveLines(measures,exercise.clef),
  };
}
