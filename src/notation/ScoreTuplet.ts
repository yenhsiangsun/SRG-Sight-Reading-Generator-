import {Stem, Tuplet, type StaveNote} from 'vexflow';

/** Single-voice triplets follow the beam side, with the number close to it. */
export class ScoreTuplet extends Tuplet {
  get location() {return this.options.location;}

  override getYPosition() {
    const notes = this.getNotes() as StaveNote[];
    const first = notes[0], last = notes[notes.length - 1];
    const above = this.location === Tuplet.LOCATION_TOP;
    const bracketY = this.options.bracketed ? super.getYPosition() : undefined;
    const centerX = this.options.bracketed ? (first.getTieLeftX() + last.getTieRightX()) / 2
      : (first.getStemX() + last.getStemX()) / 2;
    const halfWidth = this.textElement.getWidth() / 2;
    const halfHeight = this.textElement.getHeight() / 2;
    let y: number;
    if (bracketY !== undefined) {
      // Tuplet.draw offsets the text baseline from the inherited bracket line.
      // Compare actual glyph ink here, then move bracket and text by only the
      // required clearance; a clear bracket retains its exact inherited y.
      const baseline = bracketY + halfHeight + (above ? -1 : 1) * this.options.textYOffset;
      const metrics = this.textElement.getTextMetrics();
      y = baseline + (metrics.actualBoundingBoxDescent - metrics.actualBoundingBoxAscent) / 2;
    } else {
      const firstY = first.getStemExtents().topY, lastY = last.getStemExtents().topY;
      const slope = (lastY - firstY) / Math.max(1, last.getStemX() - first.getStemX());
      // Read the sloping beam directly at the number, instead of the tallest stem
      // in the group. Keep six pixels of air beyond the beam's five-pixel thickness.
      const edgeY = (firstY + lastY) / 2 + (above ? -1 : 1) * Math.abs(slope) * halfWidth;
      y = edgeY + (above ? -1 : 1) * (halfHeight + 11);
      // A digit must not straddle a staff line when a short stem ends inside it.
      const stave = first.checkStave();
      y = above ? Math.min(y, stave.getYForLine(0) - halfHeight - 4)
        : Math.max(y, stave.getYForLine(4) + halfHeight + 4);
    }
    const originalY = y;
    for (const note of notes) for (const modifier of note.getModifiers()) {
      if (!modifier.isRendered()) continue;
      const box = modifier.getBoundingBox();
      if (box.getW() <= 0 || box.getH() <= 0 || box.getX() > centerX + halfWidth + 3 || box.getX() + box.getW() < centerX - halfWidth - 3) continue;
      if (above && box.getY() < y + halfHeight) y = Math.min(y, box.getY() - halfHeight - 4);
      if (!above && box.getY() + box.getH() > y - halfHeight) y = Math.max(y, box.getY() + box.getH() + halfHeight + 4);
    }
    if (bracketY !== undefined) return bracketY + (y - originalY);
    // Tuplet.draw adds textYOffset toward the outside. Account for it here.
    return y + (above ? 1 : -1) * this.options.textYOffset;
  }
}

export function chooseTupletSide(notes: readonly StaveNote[]) {
  const sounded = notes.filter(note => !note.isRest());
  const direction = sounded.reduce((sum, note) => sum + note.getStemDirection(), 0);
  return direction < 0 ? Tuplet.LOCATION_BOTTOM : Tuplet.LOCATION_TOP;
}

export function tupletSpace(tuplets: readonly ScoreTuplet[], side: 'above' | 'below') {
  return tuplets.some(tuplet => tuplet.location === (side === 'above' ? Stem.UP : Stem.DOWN)) ? 28 : 0;
}
