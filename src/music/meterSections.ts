import type {RhythmLevel, TimeSignature} from '../music';

export interface MeterSection {
  startBar: number;
  /** Exclusive, matching Array.slice and the study's phrase boundaries. */
  endBar: number;
  meter: TimeSignature;
}

/** Actual contiguous meter sections, shared by rhythmic and melodic planning. */
export function meterSections(meters: readonly TimeSignature[]): MeterSection[] {
  const sections: MeterSection[] = [];
  meters.forEach((meter, bar) => {
    const previous = sections.at(-1);
    if (previous?.meter === meter) previous.endBar = bar + 1;
    else sections.push({startBar: bar, endBar: bar + 1, meter});
  });
  return sections;
}

const sectionWeights: Record<RhythmLevel, readonly number[]> = {
  simple: [.08, .27, .65],
  medium: [.25, .5, .25],
  complex: [.65, .3, .05],
};

/**
 * Give each new pulse time to establish itself before changing again. These
 * choices deliberately depend on rhythmic settings alone, never pitch grade.
 * The caller validates the selected meters and the 1–32 bar limit.
 */
export function planMixedMeterSequence(
  startMeter: TimeSignature, selectedMeters: readonly TimeSignature[],
  measureCount: number, rhythmLevel: RhythmLevel,
): TimeSignature[] {
  const available = [...new Set(selectedMeters)];
  if (available.length < 2 || measureCount < 2) return Array(measureCount).fill(startMeter);
  let unseen = available.filter(meter => meter !== startMeter);
  const nextMeter = (current: TimeSignature): TimeSignature => {
    const candidates = unseen.length ? unseen : available.filter(meter => meter !== current);
    const next = candidates[Math.floor(Math.random() * candidates.length)];
    unseen = unseen.filter(meter => meter !== next);
    return next;
  };
  // Very short examples cannot contain two full phrases, but must still teach
  // the requested change. Longer studies never isolate a single-meter bar.
  if (measureCount <= 3) return [
    ...Array(measureCount - 1).fill(startMeter), nextMeter(startMeter),
  ];

  const sequence: TimeSignature[] = [];
  let current = startMeter;
  while (sequence.length < measureCount) {
    const remaining = measureCount - sequence.length;
    if (sequence.length && remaining <= 4) {
      sequence.push(...Array(remaining).fill(current));
      break;
    }
    const next = nextMeter(current);
    // Reserve a full receiving section, and three bars for a new 3/8 feel
    // whenever space permits: one 3/8 bar has only one large pulse.
    let lengths = [2, 3, 4].filter(length => remaining - length >=
      (next === '3/8' && remaining >= 5 ? 3 : 2));
    if (current === '3/8' && lengths.some(length => length >= 3)) lengths = lengths.filter(length => length >= 3);
    const weights = lengths.map(length => current === '3/8'
      ? (length === 4 ? (rhythmLevel === 'simple' ? .8 : .55) : .45)
      : sectionWeights[rhythmLevel][length - 2]);
    let draw = Math.random() * weights.reduce((sum, weight) => sum + weight, 0);
    const length = lengths.find((_, index) => (draw -= weights[index]) <= 0) ?? lengths.at(-1)!;
    sequence.push(...Array(length).fill(current));
    current = next;
  }
  return sequence;
}
