import type {MeasureData, TimeSignature} from '../music';

// Twelve ticks per sixteenth keep thirds and dotted values exact internally.
export const rhythmTicks = (units: number) => Math.round(units * 12);
export const addRhythmUnits = (a: number, b: number) => (rhythmTicks(a) + rhythmTicks(b)) / 12;
const validUnits = (units: number) => Number.isFinite(units) && Math.abs(units * 12 - rhythmTicks(units)) < 1e-7;

/** Shared by engraving and saved-score validation. Triplets occupy one whole quarter beat. */
export function assertMeasureRhythm(measure: MeasureData, meter: TimeSignature) {
  const [top, bottom] = meter.split('/').map(Number), total = top * 16 / bottom;
  let ticks = 0, tripletNotes = 0;
  for (const note of measure.events) {
    if (!validUnits(note.startUnits) || !validUnits(note.durationUnits) || note.durationUnits <= 0 || rhythmTicks(note.startUnits) !== ticks)
      throw new Error('音符記譜時值與播放時值不一致。');
    if (note.tuplet !== undefined && note.tuplet !== 3) throw new Error('不支援的連音格式。');
    if (note.measureRest && (!note.rest || measure.events.length !== 1 || note.dots !== 0 || note.tuplet))
      throw new Error('整小節休止符格式錯誤。');
    if (note.tuplet === 3) {
      if (bottom !== 4 || note.duration !== '8' || note.dots !== 0 || (tripletNotes === 0 && ticks % 48 !== 0))
        throw new Error('三連音必須完整佔一個四分音符拍。');
      tripletNotes = (tripletNotes + 1) % 3;
    } else if (tripletNotes !== 0) throw new Error('三連音組不完整。');
    const base = {w:16,h:8,q:4,'8':2,'16':1}[note.duration];
    const written = note.measureRest ? total : base * (2 - 2 ** -note.dots) * (note.tuplet ? 2 / 3 : 1);
    if (!validUnits(written) || rhythmTicks(written) !== rhythmTicks(note.durationUnits))
      throw new Error('音符記譜時值與播放時值不一致。');
    ticks += rhythmTicks(note.durationUnits);
  }
  if (tripletNotes || ticks !== rhythmTicks(total) || measure.totalUnits !== total) throw new Error('小節拍數不符合拍號。');
}
