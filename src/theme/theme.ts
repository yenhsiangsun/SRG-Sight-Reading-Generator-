import type { CSSProperties } from 'react';

export type ThemeColors = {
  primary: string;
  accent: string;
  background: string;
  surface: string;
};

export type ThemeColorKey = keyof ThemeColors;

export const THEME_STORAGE_KEY = 'sight-reading-theme-v2';

export const defaultTheme: ThemeColors = {
  primary: '#254d44',
  accent: '#d1b67d',
  background: '#f7f7f2',
  surface: '#ffffff',
};

export const themePresets = [
  { id: 'forest', colors: defaultTheme },
  { id: 'ocean', colors: { primary: '#245b88', accent: '#deb879', background: '#f1f6fb', surface: '#ffffff' } },
  { id: 'lavender', colors: { primary: '#69518a', accent: '#d9af92', background: '#f6f3fa', surface: '#ffffff' } },
  { id: 'rose', colors: { primary: '#994f63', accent: '#d5b273', background: '#fbf3f3', surface: '#fffdfc' } },
  { id: 'sand', colors: { primary: '#75573d', accent: '#bc9255', background: '#f7f3eb', surface: '#fffdf7' } },
  { id: 'midnight', colors: { primary: '#a4cdbb', accent: '#e5bc82', background: '#111827', surface: '#1e293b' } },
] as const;

function normalizeHex(value: unknown): string | undefined {
  if (typeof value !== 'string' || !/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(value)) return;
  const digits = value.slice(1).toLowerCase();
  return '#' + (digits.length === 3 ? [...digits].map(digit => digit + digit).join('') : digits);
}

/** Only saved source colors are trusted; text and borders are always derived. */
export function normalizeTheme(value: unknown): ThemeColors {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...defaultTheme };
  const source = value as Record<string, unknown>;
  const theme = { ...defaultTheme };
  for (const key of Object.keys(theme) as ThemeColorKey[]) {
    theme[key] = normalizeHex(source[key]) ?? defaultTheme[key];
  }
  return theme;
}

type Rgb = [number, number, number];

function rgb(hex: string): Rgb {
  return [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16)) as Rgb;
}

function mix(base: string, tint: string, amount: number): string {
  const start = rgb(base);
  return '#' + rgb(tint).map((channel, index) =>
    Math.round(start[index] + (channel - start[index]) * amount).toString(16).padStart(2, '0'),
  ).join('');
}

function luminance(hex: string): number {
  const channels = rgb(hex).map(channel => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(first: string, second: string): number {
  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function neutralInk(background: string): string {
  return contrast('#000000', background) >= contrast('#ffffff', background) ? '#000000' : '#ffffff';
}

function readableInk(desired: string, backgrounds: string[], fallback: string): string {
  for (let step = 0; step <= 100; step++) {
    const candidate = mix(desired, fallback, step / 100);
    if (backgrounds.every(background => contrast(candidate, background) >= 4.5)) return candidate;
  }
  return fallback;
}

// Very bright or dark user colors must not push a tinted panel across the
// foreground's contrast boundary, especially around middle-gray surfaces.
function readableTint(surface: string, tint: string, amount: number, ink: string): string {
  for (let step = 10; step >= 0; step--) {
    const candidate = mix(surface, tint, amount * step / 10);
    if (contrast(ink, candidate) >= 4.5) return candidate;
  }
  return surface;
}

export function themeStyleFromState(value: ThemeColors): CSSProperties & Record<`--theme-${string}`, string> {
  const theme = normalizeTheme(value);
  const ink = neutralInk(theme.surface);
  const soft = readableTint(theme.surface, theme.primary, 0.08, ink);
  const accentSoft = readableTint(theme.surface, theme.accent, 0.12, ink);
  const panels = [theme.surface, soft, accentSoft];
  const text = readableInk(mix(theme.primary, ink, 0.72), panels, ink);
  const muted = readableInk(mix(theme.surface, ink, 0.55), panels, ink);
  const pageInk = neutralInk(theme.background);

  return {
    '--theme-primary': theme.primary,
    '--theme-accent': theme.accent,
    '--theme-background': theme.background,
    '--theme-surface': theme.surface,
    '--theme-text': text,
    '--theme-muted': muted,
    '--theme-page-text': readableInk(mix(theme.primary, pageInk, 0.72), [theme.background], pageInk),
    '--theme-page-muted': readableInk(mix(theme.background, pageInk, 0.55), [theme.background], pageInk),
    '--theme-primary-text': neutralInk(theme.primary),
    '--theme-accent-text': neutralInk(theme.accent),
    '--theme-primary-ink': readableInk(theme.primary, panels, ink),
    '--theme-line': mix(theme.surface, ink, 0.22),
    '--theme-soft': soft,
    '--theme-accent-soft': accentSoft,
    '--theme-primary-hover': theme.primary,
  };
}

export function readThemePreference(): { theme: ThemeColors; storageWarning: boolean } {
  try {
    const raw = globalThis.localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === null) return { theme: { ...defaultTheme }, storageWarning: false };
    try {
      return { theme: normalizeTheme(JSON.parse(raw)), storageWarning: false };
    } catch {
      return { theme: { ...defaultTheme }, storageWarning: false };
    }
  } catch {
    return { theme: { ...defaultTheme }, storageWarning: true };
  }
}

export function writeThemePreference(theme: ThemeColors): boolean {
  try {
    globalThis.localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(normalizeTheme(theme)));
    return true;
  } catch {
    return false;
  }
}
