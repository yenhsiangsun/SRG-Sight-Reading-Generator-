export type CompanionDesign = 'classic' | 'storybook';
export const COMPANION_DESIGN_KEY = 'sight-reading-companion-design-v1';

export function normalizeCompanionDesign(value: unknown): CompanionDesign {
  // Keep classic artwork in the renderer, but the public preference is forest-only.
  void value;
  return 'storybook';
}

/** Cosmetic preference is separate from earned rewards, so switching costs nothing. */
export function createCompanionDesignStore(storage: () => Pick<Storage, 'getItem' | 'setItem'> | undefined) {
  const listeners = new Set<() => void>();
  const read = () => {
    try {
      const target = storage();
      const raw = target?.getItem(COMPANION_DESIGN_KEY);
      const normalized = normalizeCompanionDesign(raw);
      if (raw !== normalized) target?.setItem(COMPANION_DESIGN_KEY, normalized);
      return normalized;
    }
    catch { return 'storybook' as const; }
  };
  let value = read();
  const update = (next: CompanionDesign) => {
    if (value === next) return;
    value = next;
    listeners.forEach(listener => listener());
  };
  return {
    getSnapshot: () => value,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    set(next: CompanionDesign) {
      const normalized = normalizeCompanionDesign(next);
      try { storage()?.setItem(COMPANION_DESIGN_KEY, normalized); } catch { /* Keep the choice for this session. */ }
      update(normalized);
    },
    refresh: () => update(read()),
  };
}
