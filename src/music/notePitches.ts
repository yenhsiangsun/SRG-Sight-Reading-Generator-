import type {ExerciseData, GeneratedNote, NotePitch} from '../music';

export function midiFromKey(key: string): number {
  const match = key.match(/^([a-g])([#b]*)\/(-?\d+)$/i);
  if (!match) throw new Error('Invalid written pitch');
  const natural = {c:0,d:2,e:4,f:5,g:7,a:9,b:11}[match[1].toLowerCase()]!;
  return (Number(match[3])+1)*12 + natural + [...match[2]].reduce((sum, sign) => sum + (sign === '#' ? 1 : -1), 0);
}

/** Legacy single-note scores and new chords share one source of sounding pitches. */
export function notePitches(note: GeneratedNote): NotePitch[] {
  if (note.rest) return [];
  return note.chord ?? [{key:note.key, octave:Number(note.key.split('/')[1]), midi:note.midi ?? midiFromKey(note.key)}];
}

export function hasPolyphony(exercise: ExerciseData) {
  return (!!exercise.lowerMeasures && exercise.grandMode !== 'mono') ||
    [...exercise.measures, ...(exercise.lowerMeasures ?? [])].some(bar => bar.events.some(note => notePitches(note).length > 1));
}

/** The existing microphone detector is monophonic. Assess the retained melody
 * on single-part studies, displaying that same version while in test mode.
 * Independent piano/Yangqin hands remain unsupported by this detector.
 */
export function forMonophonicAssessment(exercise: ExerciseData): ExerciseData {
  if (!hasPolyphony(exercise) || (exercise.lowerMeasures && exercise.grandMode !== 'mono')) return exercise;
  const melody = (measures: ExerciseData['measures']) => measures.map(bar => ({...bar,events:bar.events.map(note => {
    if (!note.chord) return note;
    const single = {...note}; delete single.chord; return single;
  })}));
  return {...exercise,measures:melody(exercise.measures),...(exercise.lowerMeasures ? {lowerMeasures:melody(exercise.lowerMeasures)} : {})};
}
