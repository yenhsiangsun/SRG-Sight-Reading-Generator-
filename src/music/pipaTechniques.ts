import type {ExerciseData, GeneratedNote, NotePitch, PitchRange} from '../music';
import {buildPitchMaterial, describeTonality} from './scales';
import {notePitches} from './notePitches';
import {metricPosition} from './meterFeel';
import {pipaChordFingering} from './pipaFingering';

const consonant = (a: number, b: number) => [0,3,4,5,7,8,9].includes(Math.abs(a-b)%12);

export function validPipaTechnique(note: GeneratedNote): boolean {
  if (note.technique === undefined) return true;
  if (note.rest || note.tuplet || note.articulation || note.durationUnits < 2) return false;
  const pitches = notePitches(note);
  switch (note.technique) {
    case 'pipa-roll': return pitches.length === 1 && pitches[0].midi >= 57 && note.durationUnits >= 4;
    case 'pipa-brush': return pitches.length >= 2 && !!pipaChordFingering(pitches);
    case 'pipa-arpeggio': return pitches.length >= 3 && note.durationUnits >= 4 && !!pipaChordFingering(pitches);
    case 'pipa-open-double': return pitches.length === 2 && !!pipaChordFingering(pitches)?.some(p => p.fret === 0);
    default: return false;
  }
}

/** Sparse decorations of an already composed phrase, never a replacement melody.
 * Original timing, melody, pitch range and modal material stay intact. Techniques
 * that cannot be played in the selected register are simply omitted.
 */
export function addPipaTechniques(exercise: ExerciseData, range: PitchRange, random = Math.random): ExerciseData {
  if (exercise.soundProfile !== 'Pipa') return exercise;
  const tonality = exercise.tonality ?? describeTonality(exercise.keySignature,'major');
  const material: NotePitch[] = buildPitchMaterial(tonality,range).pitches.map(p => ({...p,key:`${p.key.toLowerCase()}/${p.octave}`}));
  const replacements = new Map<GeneratedNote, GeneratedNote>();
  const staffs = [exercise.measures, ...(exercise.lowerMeasures ? [exercise.lowerMeasures] : [])];
  const events = staffs.flatMap(staff => staff.flatMap((measure,bar) => measure.events.map(note => ({note,measure,bar}))));
  const melodyEnd = events.filter(item => !item.note.rest).sort((a,b) => a.bar-b.bar || a.note.startUnits-b.note.startUnits).at(-1);
  const marked = new Set<number>();
  const used = new Set<GeneratedNote['technique']>();
  const assign = (note: GeneratedNote, technique: GeneratedNote['technique'], chord?: NotePitch[]) => {
    const result = {...note,technique,...(chord ? {chord} : {})};
    delete result.articulation;
    if (!validPipaTechnique(result)) return false;
    replacements.set(note,result); used.add(technique); return true;
  };
  const voicings = (note: GeneratedNote, bar: number, size: number): NotePitch[][] => {
    const anchor = {key:note.key,octave:note.octave,midi:note.midi!};
    const center = exercise.harmonyPlan?.[bar];
    const pool = material.filter(p => p.midi < anchor.midi && anchor.midi-p.midi <= 24 &&
      (!center || center.pitches.includes(p.midi%12)) && consonant(p.midi,anchor.midi));
    const result: NotePitch[][] = [];
    const visit = (chord: NotePitch[], from: number) => {
      if (chord.length === size) {
        const fingering = pipaChordFingering(chord);
        if (fingering?.some(p => p.fret === 0)) result.push(chord.slice().sort((a,b) => a.midi-b.midi));
        return;
      }
      for (let i=from;i<pool.length;i++) if (chord.every(p => consonant(p.midi,pool[i].midi))) visit([...chord,pool[i]],i+1);
    };
    if (material.some(p => p.midi === anchor.midi)) visit([anchor],0);
    return result;
  };
  // A quiet, rolled cadence only where three adjacent strings genuinely fit.
  if (melodyEnd && melodyEnd.note.durationUnits >= 4 && random() < .5) {
    const choices = voicings(melodyEnd.note,melodyEnd.bar,3);
    if (choices.length && assign(melodyEnd.note,'pipa-arpeggio',choices[Math.floor(random()*choices.length)])) marked.add(Math.floor(melodyEnd.bar/2));
  }
  const eligible = events.filter(({note,measure}) => !note.rest && !note.tuplet && note.durationUnits >= 2 &&
    metricPosition(measure,note.startUnits,exercise.timeSignature).onPulse).map(item => ({...item,rank:random()})).sort((a,b) => a.rank-b.rank);
  const limit = Math.max(1,Math.ceil(exercise.measures.length / (exercise.difficulty === 'beginner' ? 4 : 3)));
  for (const {note,bar} of eligible) {
    if (replacements.size >= limit) break;
    if (marked.has(Math.floor(bar/2)) || replacements.has(note)) continue;
    const available: Array<GeneratedNote['technique']> = [];
    if (!note.chord && note.durationUnits >= 4 && note.midi! >= 57) available.push('pipa-roll');
    const doubles = voicings(note,bar,2);
    if (doubles.length) available.push('pipa-open-double');
    if (note.chord && pipaChordFingering(note.chord)) available.push('pipa-brush');
    else if (doubles.length && exercise.difficulty !== 'beginner') available.push('pipa-brush');
    const choices = available.filter(kind => !used.has(kind));
    const list = choices.length ? choices : available;
    if (!list.length) continue;
    const technique = list[Math.floor(random()*list.length)];
    const chord = technique === 'pipa-open-double' || technique === 'pipa-brush' ?
      technique === 'pipa-brush' && note.chord ? note.chord : doubles[Math.floor(random()*doubles.length)] : undefined;
    if (assign(note,technique,chord)) marked.add(Math.floor(bar/2));
  }
  const decorate = (measures: ExerciseData['measures']) => measures.map(bar => ({...bar,events:bar.events.map(n => replacements.get(n) ?? n)}));
  return {...exercise,measures:decorate(exercise.measures),...(exercise.lowerMeasures ? {lowerMeasures:decorate(exercise.lowerMeasures)} : {})};
}
