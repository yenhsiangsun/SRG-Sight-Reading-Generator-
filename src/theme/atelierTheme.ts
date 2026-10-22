import type {CSSProperties} from 'react';
import {themeStyleFromState, type ThemeColors} from './theme';

const warmStudio: ThemeColors = {
  primary: '#244b3e',
  accent: '#b18b52',
  background: '#f5f2e9',
  surface: '#fffdf7',
};
/** One fixed, contrast-checked studio palette across the full practice flow.
 * Notation surfaces keep their explicit white paper and black engraving. */
export const studioThemeStyle: CSSProperties = themeStyleFromState(warmStudio);
