import { Accidental, Beam, Dot, Fraction, StaveNote, Voice } from 'vexflow';
import type { Clef, MeasureData, TimeSignature } from '../music';

export function createMeasureNotation(measure: MeasureData, clef: Clef, key: string, meter: TimeSignature) {
  const [numBeats, beatValue] = meter.split('/').map(Number);
  const expectedUnits = numBeats * 16 / beatValue;
  let elapsed = 0;
  for (const note of measure.events) {
    const baseUnits = { w: 16, h: 8, q: 4, '8': 2, '16': 1 }[note.duration];
    const notatedUnits = note.measureRest ? expectedUnits : baseUnits * (2 - 2 ** -note.dots);
    if (note.measureRest && (!note.rest || measure.events.length!==1 || note.dots!==0)) throw new Error('整小節休止符格式錯誤。');
    if (note.startUnits !== elapsed || notatedUnits !== note.durationUnits) {
      throw new Error('音符記譜時值與播放時值不一致。');
    }
    elapsed += note.durationUnits;
  }
  if (elapsed !== expectedUnits || measure.totalUnits !== expectedUnits) throw new Error('小節拍數不符合拍號。');

  const restKeys: Record<Clef, string> = { treble: 'b/4', bass: 'd/3', alto: 'c/4', tenor: 'a/3' };
  const notes = measure.events.map(note => {
    const result = new StaveNote({
      clef, keys: [note.rest ? restKeys[clef] : note.key],
      duration: `${note.duration}${note.rest ? 'r' : ''}`,
      dots: note.dots, autoStem: true,
      alignCenter: note.measureRest,
      durationOverride: note.measureRest ? new Fraction(numBeats,beatValue) : undefined,
    });
    for (let dot = 0; dot < note.dots; dot++) Dot.buildAndAttach([result]);
    return result;
  });
  const voice = new Voice({ numBeats, beatValue }).setStrict(true).addTickables(notes);
  if (!voice.isComplete()) throw new Error('小節拍數不完整。');
  // Called once per bar: accidental state resets at each barline, separately by octave.
  Accidental.applyAccidentals([voice], key);
  // In simple meter expose each quarter beat; compound/asymmetric meters keep their big beats.
  const groups = beatValue === 4 ? Array(numBeats).fill(4) as number[] : measure.beamGroups;
  // Keep a beat readable across internal rests without adding stems to rests.
  const beams = Beam.generateBeams(notes, {
    groups: groups.map(units => new Fraction(units, 16)),
    beamRests: true,
    beamMiddleOnly: true,
    showStemlets: false,
  });
  return { notes, voice, beams };
}
