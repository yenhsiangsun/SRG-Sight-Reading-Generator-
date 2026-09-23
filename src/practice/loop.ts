import type {ExerciseData} from '../music';
import {measureTimeline} from '../audio/tempo';

export function loopWindow(exercise: ExerciseData, bpm: number, first: number, last: number) {
  if (!Number.isFinite(bpm) || bpm <= 0 || !Number.isInteger(first) || !Number.isInteger(last) || first < 1 || last < first || last > exercise.measures.length) throw new Error('Invalid loop range');
  const bars = measureTimeline(exercise, bpm);
  const start = bars[first - 1].start, end = bars[last - 1].start + bars[last - 1].duration;
  // Four count-in pulses, using the denominator beat of the selected first bar.
  const lead = 4 * bars[first - 1].unit * bars[first - 1].secondsPerUnit;
  return {start, end, lead, cycle: end - start + lead};
}

export function loopPosition(window: ReturnType<typeof loopWindow>, elapsed: number) {
  return window.start + Math.max(0, Math.min(window.end - window.start, ((Math.max(0, elapsed) % window.cycle) - window.lead)));
}
