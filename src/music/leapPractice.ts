import type {ExerciseData,PitchRange} from '../music';
import {buildPitchMaterial,describeTonality} from './scales';
import {melodicVoice} from './exerciseQuality';
import {PITCH_DIFFICULTY} from './pitchDifficulty';

/** A few deliberate interval exercises, preserving rhythm and both neighboring
 * leap limits. Keep the final preparation, approach and landing together. */
export function addLeapPractice(exercise:ExerciseData,range:PitchRange):ExerciseData {
  const material=buildPitchMaterial(exercise.tonality??describeTonality(exercise.keySignature,'major'),range).pitches;
  const max=PITCH_DIFFICULTY[exercise.difficulty].maxLeap;
  const voice=melodicVoice(exercise).map(bar=>({...bar,events:bar.events.map(n=>({...n}))}));
  const notes=voice.flatMap(b=>b.events).filter(n=>!n.rest);
  for(let i=2;i<notes.length-3;i+=4){
    const previous=notes[i-1].midi!,next=notes[i+1].midi!;
    const target=material.filter(p=>Math.abs(p.midi-previous)>=4&&Math.abs(p.midi-previous)<=max&&Math.abs(p.midi-next)<=max)
      .sort((a,b)=>Math.abs(a.midi-notes[i].midi!)-Math.abs(b.midi-notes[i].midi!))[0];
    if(target)Object.assign(notes[i],{midi:target.midi,key:`${target.key.toLowerCase()}/${target.octave}`,octave:target.octave});
  }
  if(exercise.grandMode==='mono'&&exercise.lowerMeasures){
    const staff=(upper:boolean)=>voice.map(bar=>({...bar,events:bar.events.map(n=>!n.rest&&((n.midi??60)>=60)===upper?n:
      {...n,rest:true,key:upper?'b/4':'d/3',octave:upper?4:3,midi:undefined})}));
    return {...exercise,measures:staff(true),lowerMeasures:staff(false)};
  }
  return {...exercise,measures:voice};
}
