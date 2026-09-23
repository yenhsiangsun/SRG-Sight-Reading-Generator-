import { createPracticeRhythmPlan, generatePracticeExercise, type ExerciseData, type PracticeOptions } from '../music';
import {selectPhraseRhythmPlan, type RhythmBarPlan} from './phraseRhythm';

/** Both hands share bar boundaries and meters; each owns a complete rhythmic voice. */
export function generateGrandExercise(options: PracticeOptions, mode: 'mono' | 'two-hand' = 'two-hand',
  rhythmPlan = createPracticeRhythmPlan(options), lowerPlan?: RhythmBarPlan[]): ExerciseData {
  if (mode === 'mono') {
    const melody = generatePracticeExercise({...options, clef:'treble'},rhythmPlan);
    const staff = (upper:boolean) => melody.measures.map(measure=>({...measure,events:measure.events.map(note=>{
      const keep=!note.rest && ((note.midi ?? 60)>=60)===upper;
      return keep?{...note}:{...note,rest:true,key:upper?'b/4':'d/3',octave:upper?4:3,midi:undefined};
    })}));
    return {...melody,measures:staff(true),lowerMeasures:staff(false),grandMode:'mono'};
  }
  if (options.range.min > 58 || options.range.max < 61) {
    throw new Error('大譜表需要中央 C 兩側的音域：最低音請不高於 B♭3，最高音請不低於 C♯4。');
  }
  const upper = generatePracticeExercise({...options, clef:'treble', range:{min:60,max:options.range.max}},rhythmPlan);
  const accompaniment = lowerPlan ?? selectPhraseRhythmPlan(rhythmPlan.map(bar=>bar.meter),options.rhythmLevel);
  const lowerMeasures = generatePracticeExercise({...options,clef:'bass',range:{min:options.range.min,max:59},
    rhythmFocus:'balanced',allowAccidentals:false},accompaniment).measures;
  return {...upper, lowerMeasures, grandMode:'two-hand'};
}
