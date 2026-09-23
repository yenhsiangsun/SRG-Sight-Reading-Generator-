export type RhythmFocus = 'balanced' | 'sixteenths' | 'dotted';

/** Subdivide inside the existing beat groups; never move a barline or beat. */
export function focusedComposition(units: number, focus: RhythmFocus, level: 'simple' | 'medium' | 'complex' = 'medium') {
  const lengths: number[] = [];
  let left = units;
  while (left > 0) {
    if (focus === 'dotted' && left >= 4) {
      lengths.push(3, 1); left -= 4;
    } else if (focus === 'sixteenths' && left >= 2) {
      // Keep some eighths for phrasing, with substantially more sixteenths.
      const density = level === 'simple' ? 0.55 : level === 'medium' ? 0.75 : 0.9;
      lengths.push(...(Math.random() < density ? [1, 1] : [2])); left -= 2;
    } else {
      lengths.push(left >= 2 ? 2 : 1); left -= left >= 2 ? 2 : 1;
    }
  }
  return lengths.map(units => ({units, duration: units === 1 ? '16' as const : '8' as const, dots: units === 3 ? 1 : 0}));
}
