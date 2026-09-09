import { generatePracticeExercise, type ExerciseData, type PracticeOptions } from '../music';

/** Both hands share bar boundaries and meters; each owns a complete rhythmic voice. */
export function generateGrandExercise(options: PracticeOptions, mode: 'mono' | 'two-hand' = 'two-hand'): ExerciseData {
  if (mode === 'mono') {
    const melody = generatePracticeExercise({...options, clef:'treble'});
    const staff = (upper:boolean) => melody.measures.map(measure=>({...measure,events:measure.events.map(note=>{
      const keep=!note.rest && ((note.midi ?? 60)>=60)===upper;
      return keep?{...note}:{...note,rest:true,key:upper?'b/4':'d/3',octave:upper?4:3,midi:undefined};
    })}));
    return {...melody,measures:staff(true),lowerMeasures:staff(false),grandMode:'mono'};
  }
  if (options.range.min > 58 || options.range.max < 61) {
    throw new Error('大譜表需要中央 C 兩側的音域：最低音請不高於 B♭3，最高音請不低於 C♯4。');
  }
  const upper = generatePracticeExercise({...options, clef:'treble', range:{min:60,max:options.range.max}});
  const lowerMeasures = upper.measures.map(measure => {
    const meter = measure.timeSignature ?? upper.timeSignature;
    return generatePracticeExercise({...options, clef:'bass', range:{min:options.range.min,max:59},
      timeSignature:meter, measures:1, mixedMeters:false, rhythmLevel:'simple', allowAccidentals:false,
    }).measures[0];
  });
  return {...upper, lowerMeasures, grandMode:'two-hand'};
}
