import {Articulation, Modifier, StaveNote, Stem} from 'vexflow';

/** The five separated rays used for a five-finger pipa roll.
 * Reuse articulation spacing; draw paths so the sign works in SVG and PDF
 * without relying on the device's Chinese or music-symbol font fallback.
 */
export class PipaRollMark extends Articulation {
  constructor() { super('ah'); this.setPosition(Modifier.Position.ABOVE); }
  draw() {
    const context = this.checkContext();
    const note = this.checkAttachedNote() as StaveNote;
    const x = note.getModifierStartXY(Modifier.Position.ABOVE,this.checkIndex()).x;
    const top = note.hasStem() && note.getStemDirection() === Stem.UP ? note.getStemExtents().topY : Math.min(...note.getYs());
    const y = Math.min(note.checkStave().getYForTopText(this.textLine),top-17);
    this.setRendered();
    context.save(); context.setLineWidth(1.4);
    context.beginPath();
    for (let i=0;i<5;i++) {
      const angle=-Math.PI/2+i*2*Math.PI/5;
      context.moveTo(x+3*Math.cos(angle),y+3*Math.sin(angle));
      context.lineTo(x+7*Math.cos(angle),y+7*Math.sin(angle));
    }
    context.stroke(); context.restore();
  }
}
