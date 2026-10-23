import type {CSSProperties} from 'react';
import {themeStyleFromState} from './theme';

/** Curated light palettes only; no user-supplied colors enter the studio. */
export const STUDIO_PALETTES = {
  wood: {primary:'#70503c',accent:'#b89a71',background:'#f5efe6',surface:'#fffaf2'},
  linen: {primary:'#6b604d',accent:'#baa984',background:'#f4f1e8',surface:'#fffdf6'},
  blue: {primary:'#476272',accent:'#a5b2b8',background:'#eef2f3',surface:'#fbfdfe'},
  forest: {primary:'#294b38',accent:'#9ba786',background:'#f5f3ea',surface:'#fffdf4'},
} as const;
export type StudioPaletteId = keyof typeof STUDIO_PALETTES;
export const STUDIO_PALETTE_IDS = Object.keys(STUDIO_PALETTES) as StudioPaletteId[];
export const STUDIO_PALETTE_KEY = 'tonecraft-studio-palette-v1';
export function isStudioPaletteId(value:unknown):value is StudioPaletteId {
  return typeof value==='string'&&Object.hasOwn(STUDIO_PALETTES,value);
}
export function studioPaletteStyle(id:StudioPaletteId):CSSProperties {
  const palette=STUDIO_PALETTES[id];
  return themeStyleFromState({...palette,accent:palette.primary});
}
