/** User-supplied 三十六簧加鍵方笙 chart, 1=C, sounding G3–F#6.
 * Each array follows the physical buttons from left to right in the supplied image.
 * Do not transpose this layout onto alto/tenor/bass or traditional sheng models.
 */
export const SHENG_FINGER_ROWS = {
  leftPinky: [89],
  leftMiddle: [83, 78, 72, 65],
  leftRing: [59],
  rightRing: [60],
  rightMiddle: [66, 71, 77, 84],
  rightPinky: [90],
  leftIndex: [87, 81, 76, 70, 63, 57],
  rightIndex: [58, 64, 69, 75, 82, 88],
  leftThumb: [85, 79, 74, 68, 61, 55],
  rightThumb: [56, 62, 67, 73, 80, 86],
} as const;

const buttons = new Map<number, {finger:string;position:number}>(Object.entries(SHENG_FINGER_ROWS).flatMap(([finger, pitches]) =>
  pitches.map((midi, position) => [midi, {finger, position}] as const)));

export function shengButton(midi: number) { return buttons.get(midi); }

/** Conservative practice policy: at most two contiguous buttons per finger.
 * Rare three-button fingerings are deliberately not generated without a confirmed technique.
 */
function canPlaySopranoChord(pitches: readonly number[]): boolean {
  const fingers = new Map<string, number[]>();
  for (const midi of pitches) {
    const button = shengButton(midi);
    if (!button) return false;
    const positions = fingers.get(button.finger) ?? [];
    positions.push(button.position);
    fingers.set(button.finger, positions);
  }
  return [...fingers.values()].every(positions => positions.length === 1 ||
    (positions.length === 2 && Math.abs(positions[0] - positions[1]) === 1));
}

/** Named instrument models, not transpositions of the soprano's fixed fingers.
 * Lower shengs use the whole-tone button layout documented by composer/player
 * Wang Chenwei: https://wangchenwei.wordpress.com/essays/diyinsheng/ (fig. 2).
 * Piano-keyboard shengs and other layouts need their own profiles.
 */
export const SHENG_HARMONY_PROFILES = {
  Sheng: {min:55, max:90, layout:'soprano-36'},
  'Alto Sheng': {min:48, max:83, layout:'whole-tone-buttons'},
  'Tenor Sheng': {min:43, max:78, layout:'whole-tone-buttons'},
  'Bass Sheng': {min:36, max:67, layout:'whole-tone-buttons'},
} as const;
export type ShengInstrument = keyof typeof SHENG_HARMONY_PROFILES;

export function isShengInstrument(instrument: string | undefined): instrument is ShengInstrument {
  return instrument !== undefined && Object.hasOwn(SHENG_HARMONY_PROFILES,instrument);
}

/** Left-to-right columns in fig. 2; octaves are separate physical rows.
 * Fingers are movable on this layout, unlike the soprano's assigned finger rows.
 * Keep absolute pitch classes: a tenor starting at G2 is not an alto shifted down.
 */
export function shengKeyboardButton(midi: number, instrument: ShengInstrument) {
  const profile = SHENG_HARMONY_PROFILES[instrument];
  if (!profile || profile.layout !== 'whole-tone-buttons' || !Number.isInteger(midi) || midi < profile.min || midi > profile.max) return undefined;
  const pc = midi % 12, hand = pc % 2 === 0 ? 'left' : 'right';
  return {hand, row:Math.floor(midi/12), column:hand === 'left' ? pc/2 : (11-pc)/2} as const;
}

/** Conservative practice subset, not the physical limit of every lower sheng:
 * at most two independently pressed keys per hand, in a compact area spanning
 * at most two column steps and two adjacent octave rows. No finger sharing,
 * linkage keys or long reaches are assumed. Exact reach varies by instrument.
 */
function canPlayKeyboardChord(pitches: readonly number[], instrument: ShengInstrument): boolean {
  const buttons = pitches.map(midi => shengKeyboardButton(midi,instrument));
  if (buttons.some(button => !button)) return false;
  return ['left','right'].every(hand => {
    const keys = buttons.filter(button => button!.hand === hand);
    return keys.length <= 2 && (keys.length < 2 ||
      (Math.abs(keys[0]!.column-keys[1]!.column) <= 2 && Math.abs(keys[0]!.row-keys[1]!.row) <= 1));
  });
}

/** Same model-aware check is used by generation and saved-score validation.
 * Omitted instrument retains the original 36-key soprano API for old callers.
 */
export function canPlayShengChord(pitches: readonly number[], instrument: string = 'Sheng'): boolean {
  if (!isShengInstrument(instrument) || pitches.length < 1 || pitches.length > 4 ||
    new Set(pitches).size !== pitches.length || pitches.some(midi => !Number.isInteger(midi))) return false;
  const profile = SHENG_HARMONY_PROFILES[instrument];
  if (pitches.some(midi => midi < profile.min || midi > profile.max)) return false;
  return profile.layout === 'soprano-36' ? canPlaySopranoChord(pitches) : canPlayKeyboardChord(pitches,instrument);
}

/** Musical/breath-management policy in addition to button reach. Dense low
 * thirds and large low chords are deliberately omitted from practice material.
 */
export function isShengPracticeVoicing(pitches: readonly number[], instrument: string): boolean {
  if (!canPlayShengChord(pitches,instrument)) return false;
  if (instrument === 'Sheng') return true;
  const sorted = [...pitches].sort((a,b) => a-b);
  if (sorted[0] < 48 && sorted.length > 2) return false;
  return sorted.every((midi,index) => index === 0 || sorted[index-1] >= 48 || midi-sorted[index-1] >= 7);
}
