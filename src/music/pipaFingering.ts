import type {NotePitch} from '../music';

// Standard sounding open strings, bass to treble: A2, D3, E3, A3.
// Reference: https://www.easonmusicschool.com/how-to-tune-zhongruan-liuqin-and-pipa/
const openStrings = [45, 50, 52, 57];
const position = (pitch: NotePitch) => pitch.octave * 7 + 'cdefgab'.indexOf(pitch.key[0].toLowerCase());

export function isPipaHarmony(pitches: readonly NotePitch[]) {
  if (pitches.length !== 2) return false;
  const interval = Math.abs(pitches[0].midi - pitches[1].midi);
  const written = Math.abs(position(pitches[0]) - position(pitches[1]));
  return (written === 2 && [3,4].includes(interval)) || (written === 3 && interval === 5) ||
    (written === 4 && interval === 7) || (written === 5 && [8,9].includes(interval));
}

/** A deliberately small, reachable subset: adjacent strings, at most four
 * semitones between stopped frets, 16/29-fret practice limits. Open strings
 * require no left-hand finger. This does not model every pipa technique.
 */
export function pipaDoubleStopFingering(pitches: readonly NotePitch[]) {
  if (!isPipaHarmony(pitches)) return null;
  for (let string = 0; string < openStrings.length - 1; string++) {
    for (const pair of [pitches, [pitches[1], pitches[0]]]) {
      const frets = pair.map((pitch, index) => pitch.midi - openStrings[string + index]);
      if (!frets.every((fret, index) => fret >= 0 && fret <= (string + index < 2 ? 16 : 29))) continue;
      if (frets.every(fret => fret > 0) && Math.abs(frets[0] - frets[1]) > 4) continue;
      return pair.map((pitch, index) => ({midi:pitch.midi, string:4-string-index, fret:frets[index]}));
    }
  }
  return null;
}
