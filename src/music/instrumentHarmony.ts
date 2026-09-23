import type {ExerciseData, GeneratedNote, MeasureData, NotePitch, PitchRange} from '../music';
import {buildPitchMaterial, describeTonality} from './scales';
import {notePitches} from './notePitches';
import {canPlayShengChord} from './shengFingering';
import {pipaDoubleStopFingering} from './pipaFingering';

const consonant = (a: number, b: number) => [0,3,4,5,7,8,9].includes(Math.abs(a-b)%12);
const ordered = (pitches: NotePitch[]) => [...pitches].sort((a,b) => a.midi-b.midi);

function candidates(anchor: NotePitch, pool: NotePitch[], size: number, valid: (pitches: NotePitch[]) => boolean) {
  const neighbors = pool.filter(pitch => pitch.midi !== anchor.midi && Math.abs(pitch.midi-anchor.midi) <= 12);
  const result: NotePitch[][] = [];
  const visit = (current: NotePitch[], start: number) => {
    if (current.length === size) { if (valid(current)) result.push(ordered(current)); return; }
    for (let i=start; i<neighbors.length; i++) {
      const next = neighbors[i];
      if (!current.every(pitch => Math.abs(pitch.midi-next.midi) <= 12 && consonant(pitch.midi,next.midi))) continue;
      visit([...current,next], i+1);
    }
  };
  visit([anchor],0);
  return result;
}

/** Decorate a complete rhythm with occasional instrument-specific chords.
 * Pitch range, original melody, rests, meter, and event durations stay intact.
 */
export function addInstrumentHarmony(exercise: ExerciseData, range: PitchRange, random = Math.random): ExerciseData {
  const instrument = exercise.soundProfile;
  if (!['Piano','Pipa','Sheng'].includes(instrument ?? '')) return exercise;
  if (instrument === 'Piano' && (!exercise.lowerMeasures || exercise.grandMode !== 'two-hand')) return exercise;
  const piano = instrument === 'Piano';
  const tonality = exercise.tonality ?? describeTonality(exercise.keySignature,'major');
  const material = buildPitchMaterial(tonality,range).pitches.map(pitch => ({...pitch,key:`${pitch.key.toLowerCase()}/${pitch.octave}`}));
  const staffs = piano ? [exercise.lowerMeasures!] : [exercise.measures, ...(exercise.lowerMeasures ? [exercise.lowerMeasures] : [])];
  const notes = staffs.flatMap((staff, hand) => staff.flatMap((measure, bar) => measure.events.map((note, index) => ({note, hand, bar, index}))));
  const sounded = notes.filter(item => !item.note.rest);
  const rate = (piano ? {beginner:.22,intermediate:.28,advanced:.32} : {beginner:.10,intermediate:.16,advanced:.20})[exercise.difficulty];
  const target = sounded.length >= 4 ? Math.max(1, Math.floor(sounded.length*rate)) : 0;
  const selected = new Map<GeneratedNote, NotePitch[]>();
  const perBar = new Map<number, number>();
  const eligible = sounded.filter(({note}) => !note.chord && note.durationUnits >= 2 && note.startUnits % 2 === 0)
    .map(item => ({...item, priority:random() + (item.note.startUnits === 0 ? 1 : 0)}))
    .sort((a,b) => b.priority-a.priority);
  for (const item of eligible) {
    if (selected.size >= target) break;
    const {note, bar, hand, index} = item;
    if ((perBar.get(bar) ?? 0) >= (piano ? 2 : 1)) continue;
    const events = staffs[hand][bar].events;
    if (selected.has(events[index-1]) || selected.has(events[index+1])) continue;
    const anchor = notePitches(note)[0];
    // Do not turn a passing chromatic note into an unrelated chord.
    if (!material.some(pitch => pitch.midi === anchor.midi)) continue;
    const melody = piano ? exercise.measures[bar].events.filter(upper => !upper.rest &&
      upper.startUnits < note.startUnits+note.durationUnits && upper.startUnits+upper.durationUnits > note.startUnits &&
      // Short passing notes may move freely; check the attack and sustained melody.
      (upper.startUnits <= note.startUnits || upper.durationUnits >= 4)).flatMap(notePitches) : [];
    const pool = material.filter(pitch => !piano || (pitch.midi >= anchor.midi && pitch.midi <= 64));
    const valid = (chord: NotePitch[]) => {
      if (instrument === 'Sheng') return canPlayShengChord(chord.map(pitch => pitch.midi));
      if (instrument === 'Pipa') return !!pipaDoubleStopFingering(chord);
      const sorted = ordered(chord);
      // Low bass stays open (fifths/octaves); close thirds start at C3.
      if (sorted.some((pitch, i) => i > 0 && sorted[i-1].midi < 48 && pitch.midi-sorted[i-1].midi < 7)) return false;
      const span = sorted.at(-1)!.midi-sorted[0].midi;
      return span <= (exercise.difficulty === 'beginner' ? 7 : 12) &&
        chord.every(pitch => melody.every(upper => pitch.midi < upper.midi && consonant(pitch.midi,upper.midi)));
    };
    const roll = random();
    const size = instrument === 'Pipa' || exercise.difficulty === 'beginner' ? 2 :
      instrument === 'Sheng' && exercise.difficulty === 'advanced' && roll < .06 ? 4 : roll < .65 ? 3 : 2;
    for (let count=size; count>=2; count--) {
      const choices = candidates(anchor,pool,count,valid);
      if (!choices.length) continue;
      selected.set(note,choices[Math.min(choices.length-1,Math.floor(random()*choices.length))]);
      perBar.set(bar,(perBar.get(bar) ?? 0)+1);
      break;
    }
  }
  const decorate = (measures: MeasureData[]) => measures.map(measure => ({...measure,events:measure.events.map(note =>
    selected.has(note) ? {...note,chord:selected.get(note)!} : note)}));
  return {...exercise,measures:piano ? exercise.measures : decorate(exercise.measures),
    ...(exercise.lowerMeasures ? {lowerMeasures:decorate(exercise.lowerMeasures)} : {})};
}
