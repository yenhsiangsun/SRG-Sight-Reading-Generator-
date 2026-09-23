import type {ExerciseData} from '../music';
import {beatUnits, openingMeter} from '../audio/tempo';

export function tempoInputRange(exercise: ExerciseData) {
  const factor = 4 / beatUnits(openingMeter(exercise));
  return {min: 48 * factor, max: 400};
}

/** Conservative sight-reading targets, not an instrument's technical speed limit. */
export function practiceTempoRange(exercise: ExerciseData) {
  // Pitch difficulty is not a rhythm skill rating. Keep the same density-based
  // speed guard for all pitch levels, including easy pitches + complex rhythms.
  const notesPerSecond = 7;
  const staffs = [exercise.measures, ...(exercise.lowerMeasures ? [exercise.lowerMeasures] : [])];
  let shortest = 4;
  for (const staff of staffs) {
    for (const bar of staff) {
      const sounded = bar.events.filter(note => !note.rest);
      if (sounded.length) shortest = Math.min(shortest, bar.totalUnits / sounded.length);
      // A sustained run matters; one short note or an unrelated leap should not cap the whole study.
      let run = 0;
      for (const note of bar.events) {
        run = !note.rest && note.durationUnits <= 1 ? run + 1 : 0;
        if (run >= 4) shortest = Math.min(shortest, 1);
      }
    }
  }
  const coordination = exercise.grandMode === 'two-hand' ? .8 : 1;
  const factor = 4 / beatUnits(openingMeter(exercise));
  // Evaluate every bar in the same note-value units, including mixed meters and both hands.
  // Keep at least two choices above the requested floor, even for dense two-hand scores.
  const max = factor * Math.max(49, Math.floor(Math.min(160,
    notesPerSecond * coordination * shortest * 60 / 4)));
  const min = 48 * factor;
  return {min, max};
}

export function selectPracticeTempo(exercise: ExerciseData, previous: number, random = Math.random) {
  const {min, max} = practiceTempoRange(exercise);
  const choices = Array.from({length: max - min + 1}, (_, i) => min + i).filter(bpm => bpm !== previous);
  return choices[Math.min(choices.length - 1, Math.max(0, Math.floor(random() * choices.length)))] ?? min;
}

