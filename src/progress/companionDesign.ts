export type CompanionDesign = 'classic' | 'storybook';
export const COMPANION_DESIGN_KEY = 'sight-reading-companion-design-v1';

export function normalizeCompanionDesign(value: unknown): CompanionDesign {
  return value === 'storybook' ? value : 'classic';
}

/** Cosmetic preference is separate from earned rewards, so switching costs nothing. */
export function createCompanionDesignStore(storage: () => Pick<Storage, 'getItem' | 'setItem'> | undefined) {
  const listeners = new Set<() => void>();
  const read = () => {
    try { return normalizeCompanionDesign(storage()?.getItem(COMPANION_DESIGN_KEY)); }
    catch { return 'classic' as const; }
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
