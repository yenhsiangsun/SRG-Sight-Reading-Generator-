export interface CompanionPosition { x: number; y: number }
export interface CompanionViewport { width: number; height: number; left: number; top: number }
export const DEFAULT_COMPANION_POSITION: CompanionPosition = {x: 1, y: .18};
const unit = (n: number) => Math.min(1, Math.max(0, n));

export function normalizeCompanionPosition(value: unknown): CompanionPosition {
  if (value && typeof value === 'object' && 'x' in value && 'y' in value &&
      typeof value.x === 'number' && typeof value.y === 'number' && Number.isFinite(value.x) && Number.isFinite(value.y)) {
    return {x: unit(value.x), y: unit(value.y)};
  }
  return {...DEFAULT_COMPANION_POSITION};
}

export function companionGeometry(viewport: CompanionViewport, position: CompanionPosition) {
  const width = viewport.width <= 600 ? 120 : 152;
  const height = viewport.width <= 600 ? 108 : 136;
  const travelX = Math.max(0, viewport.width - width - 24);
  const travelY = Math.max(0, viewport.height - height - 24);
  const left = viewport.left + 12 + unit(position.x) * travelX;
  const top = viewport.top + 12 + unit(position.y) * travelY;
  const bubbleWidth = Math.min(288, viewport.width - 24);
  const bubbleLeft = Math.max(viewport.left + 12, Math.min(left + width / 2 - bubbleWidth / 2, viewport.left + viewport.width - bubbleWidth - 12));
  const above = top - viewport.top > (viewport.height - height) / 2;
  const bubbleHeight = Math.max(0, above ? top - viewport.top - 24 : viewport.top + viewport.height - top - height - 24);
  return {left, top, width, height, travelX, travelY, bubbleWidth, bubbleLeft: bubbleLeft - left, bubbleHeight, above};
}
