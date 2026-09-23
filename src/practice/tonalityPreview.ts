import {SCALES} from '../music/scales';
import type {RandomTonality} from '../music/randomTonality';

export function getTonalityPreview(search: string, enabled: boolean): RandomTonality | undefined {
  if (!enabled) return undefined;
  const id = new URLSearchParams(search).get('previewScale');
  return SCALES.some(scale => scale.id === id) ? {tonic: 'C', scaleId: id!} : undefined;
}

export function withoutTonalityPreview(href: string): string {
  const url = new URL(href);
  url.searchParams.delete('previewScale');
  return url.pathname + url.search + url.hash;
}
