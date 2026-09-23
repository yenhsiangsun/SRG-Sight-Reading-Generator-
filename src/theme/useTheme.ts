import { useCallback, useRef, useState } from 'react';
import type { SetStateAction } from 'react';
import { defaultTheme, normalizeTheme, readThemePreference, writeThemePreference } from './theme';
import type { ThemeColors } from './theme';

export function useTheme() {
  const [{ theme, storageWarning }, setPreference] = useState(readThemePreference);
  const currentTheme = useRef(theme);

  const setTheme = useCallback((update: SetStateAction<ThemeColors>) => {
    const next = normalizeTheme(typeof update === 'function' ? update(currentTheme.current) : update);
    currentTheme.current = next;
    setPreference({ theme: next, storageWarning: !writeThemePreference(next) });
  }, []);

  const resetTheme = useCallback(() => setTheme({ ...defaultTheme }), [setTheme]);

  return { theme, setTheme, resetTheme, storageWarning };
}
