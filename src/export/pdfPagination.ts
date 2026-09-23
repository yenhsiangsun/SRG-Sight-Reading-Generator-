import type {ScoreLayout} from '../notation/scoreGeometry';

export const PDF_PAGE = {width: 210, height: 297, margin: 15, scoreTop: 45, scoreBottom: 280} as const;
export interface ScorePdfPage {sourceY: number; sourceHeight: number; width: number; height: number; firstSystem: number; lastSystem: number}

/** Never divide a system: both hands, beams and octave lines stay on one page. */
export function paginateScore(layout: Pick<ScoreLayout, 'width' | 'systems'>): ScorePdfPage[] {
  const systems = layout.systems;
  if (!systems?.length || !Number.isFinite(layout.width) || layout.width <= 0) throw new Error('Invalid PDF score layout');
  const availableWidth = PDF_PAGE.width - 2 * PDF_PAGE.margin;
  const availableHeight = PDF_PAGE.scoreBottom - PDF_PAGE.scoreTop;
  const baseScale = availableWidth / layout.width;
  const pages: ScorePdfPage[] = [];
  for (let first = 0; first < systems.length;) {
    let last = first;
    while (last + 1 < systems.length && (systems[last + 1].bottom - systems[first].top) * baseScale <= availableHeight) last++;
    const sourceY = systems[first].top, sourceHeight = systems[last].bottom - sourceY;
    if (!Number.isFinite(sourceHeight) || sourceHeight <= 0) throw new Error('Invalid PDF system height');
    const scale = Math.min(baseScale, availableHeight / sourceHeight);
    pages.push({sourceY, sourceHeight, width: layout.width * scale, height: sourceHeight * scale, firstSystem: first, lastSystem: last});
    first = last + 1;
  }
  return pages;
}

export function scorePixelRatio(width: number, height: number) {
  // Keep each individual canvas within older iPad canvas limits.
  return Math.min(3, 4096 / Math.ceil(width), 4096 / Math.ceil(height), Math.sqrt(12_000_000 / (Math.ceil(width) * Math.ceil(height))));
}
