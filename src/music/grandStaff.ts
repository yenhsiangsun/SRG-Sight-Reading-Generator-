import { createPracticeRhythmPlan, generatePracticeExercise, type ExerciseData, type PracticeOptions } from '../music';
import type {RhythmBarPlan} from './phraseRhythm';
import {pulseGroups} from './meterFeel';

/** A recurring accompaniment vocabulary belongs to the actual pulse: a dotted
 * quarter in compound meters, quarter pulses in /4 and 2+2+3 in 7/8.
 * Each tier grows more active without giving the bass a second lead rhythm. */
export function createGrandAccompanimentRhythmPlan(meters:readonly RhythmBarPlan['meter'][],level:PracticeOptions['rhythmLevel']):RhythmBarPlan[] {
  const variant=level==='simple'?0:Math.floor(Math.random()*3);
  return meters.map((meter,bar)=>{
    const groups=pulseGroups({timeSignature:meter,groups:[]}),units:number[]=[];
    for(let i=0;i<groups.length;i++) {
      if(level==='simple') {
        // The existing 5/4 grouping is 3+2: half, quarter | half.
        if(meter.endsWith('/4')&&groups[i]===4&&groups[i+1]===4&&(meter!=='5/4'||i!==2)){units.push(8);i++;}
        else units.push(groups[i]);
        continue;
      }
      const pulse=groups[i],phase=(Math.floor(bar/2)+i+variant)%3,final=bar===meters.length-1&&i===groups.length-1;
      if(final){units.push(pulse);continue;}
      if(level==='medium')units.push(...(pulse===6?(phase===0?[6]:phase===1?[4,2]:[2,4]):phase===0?[2,2]:[4]));
      else units.push(...(pulse===6?(i===0?[4,2]:phase===0?[2,1,1,2]:[2,2,2]):i===0?[4]:phase===0?[1,1,2]:[2,2]));
    }
    let startUnits=0;
    return {meter,notes:units.map(units=>{
      const note={units,startUnits,duration:units===8?'h' as const:units>=4?'q' as const:units===2?'8' as const:'16' as const,
        dots:units===6?1:0,rest:false};
      startUnits+=units;return note;
    })};
  });
}

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
  const accompaniment = lowerPlan ?? createGrandAccompanimentRhythmPlan(rhythmPlan.map(bar=>bar.meter),options.rhythmLevel);
  const lowerMeasures = generatePracticeExercise({...options,clef:'bass',range:{min:options.range.min,max:59},
    rhythmFocus:'balanced',allowAccidentals:false},accompaniment).measures;
  return {...upper, lowerMeasures, grandMode:'two-hand'};
}
