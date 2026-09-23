import type {Difficulty} from '../music';

/** Pitch settings never filter rhythm patterns or turn notes into rests. */
export const PITCH_DIFFICULTY = {
  beginner: {maxLeap: 7, chromaticChance: .04},
  intermediate: {maxLeap: 12, chromaticChance: .10},
  advanced: {maxLeap: 24, chromaticChance: .18},
} as const;

export function pitchDistanceWeight(distance: number, difficulty: Difficulty) {
  const index = distance === 0 ? 0 : distance <= 2 ? 1 : distance <= 5 ? 2 : distance <= 12 ? 3 : 4;
  return {
    beginner: [.5, 9, 2.4, .35, 0],
    intermediate: [.3, 4, 4.8, 2.3, 0],
    advanced: [.15, 1.8, 3.5, 5, 2.5],
  }[difficulty][index];
}
