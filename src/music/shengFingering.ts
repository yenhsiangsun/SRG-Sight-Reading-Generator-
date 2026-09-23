/** User-supplied 三十六簧加鍵方笙 chart, 1=C, sounding G3–F#6.
 * Each array follows the physical buttons from left to right in the supplied image.
 * Do not transpose this layout onto tenor/bass or traditional sheng models.
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
export function canPlayShengChord(pitches: readonly number[]): boolean {
  if (pitches.length < 1 || pitches.length > 4 || new Set(pitches).size !== pitches.length) return false;
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
