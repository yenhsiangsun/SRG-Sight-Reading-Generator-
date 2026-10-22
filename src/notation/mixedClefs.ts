import type {Clef} from '../music';

export const MIXED_STAFF_CLEFS = ['treble','alto','tenor','bass'] as const;
export const DEFAULT_MIXED_CLEFS = ['treble','bass'] as const;

/** Missing choices are legacy treble/bass; malformed saved choices are not. */
export function validMixedClefs(value: unknown): value is Clef[] | undefined {
  return value === undefined || (Array.isArray(value) && value.length >= 2 && value.length <= 4
    && new Set(value).size === value.length
    && value.every(clef => (MIXED_STAFF_CLEFS as readonly unknown[]).includes(clef)));
}

/** Canonical order gives equal-cost layouts a stable tie-break, without mutation. */
export function normalizeMixedClefs(value?: readonly Clef[]): Clef[] {
  return value && validMixedClefs(value)
    ? MIXED_STAFF_CLEFS.filter(clef => value.includes(clef))
    : [...DEFAULT_MIXED_CLEFS];
}
