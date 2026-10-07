import type {CSSProperties} from 'react';
import {themeStyleFromState, type ThemeColors} from './theme';

const warmStudio: ThemeColors = {
  primary: '#754525',
  accent: '#c49a5a',
  background: '#faf7f0',
  surface: '#fffdf8',
};
/** One fixed, contrast-checked studio palette across the full practice flow.
 * Notation surfaces keep their explicit white paper and black engraving. */
export const studioThemeStyle: CSSProperties = themeStyleFromState(warmStudio);
