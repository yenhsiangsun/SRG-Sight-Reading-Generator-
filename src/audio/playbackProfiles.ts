/** Recorded substitutes change only the playback source. The selected
 * instrument still owns its written range, fingering and transposition. */
export const RECORDED_SUBSTITUTES: Readonly<Record<string, string>> = {
  Erhu: 'Violin',
  Gaohu: 'Violin',
  Zhonghu: 'Viola',
  Sheng: 'Harmonica',
  'Alto Sheng': 'Harmonica',
  'Tenor Sheng': 'Harmonica',
  'Bass Sheng': 'Harmonica',
  'Soprano Suona': 'Oboe',
  'Alto Suona': 'Oboe',
  'Tenor Suona': 'Bassoon',
  'Bass Suona': 'Bassoon',
  'Suona C': 'Oboe',
  'Suona D': 'Oboe',
  'Suona Bb': 'Oboe',
  'Suona G': 'Oboe',
  'Suona A': 'Oboe',
  'Suona F': 'Oboe',
  'Guan G': 'Oboe',
  'Guan F': 'Oboe',
  'Guan A': 'Oboe',
  'Alto Guan': 'Clarinet',
  'Bass Guan': 'Bassoon',
  Liuqin: 'Guitar',
  Zhongruan: 'Guitar',
  Daruan: 'Guitar',
  Sanxian: 'Guitar',
  Yangqin: 'Hammered Dulcimer',
  // The locally approved Pipa recordings remain a development-only override.
  // Their existing library license does not authorize shipping the samples.
  Pipa: 'Guitar',
};

export function getRecordedSoundProfile(instrument: string): string {
  if (/^(?:Bangdi|Qudi) /.test(instrument)) return 'Qudi C';
  if (/^Xindi /.test(instrument)) return 'Flute';
  return RECORDED_SUBSTITUTES[instrument] ?? instrument;
}

export function usesRecordedSubstitute(instrument: string): boolean {
  return Object.hasOwn(RECORDED_SUBSTITUTES, instrument) || /^Xindi /.test(instrument);
}
