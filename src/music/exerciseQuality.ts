import type {ExerciseData, GeneratedNote, MeasureData, PitchRange} from '../music';
import {PITCH_DIFFICULTY} from './pitchDifficulty';
import {assertMeasureRhythm} from './rhythmTiming';
import {buildPitchMaterial, describeTonality} from './scales';
import {midiFromKey} from './notePitches';
import type {PitchFocus} from '../practice/focus';

export interface ExerciseQuality {penalty: number; repeatedBars: number; repeatedNotes: number; leapRuns: number; rapidLeapContinuations: number}

/** A grand monophonic staff is one line, not two melodies separated by rests. */
export function melodicVoice(exercise: ExerciseData): MeasureData[] {
  if(exercise.grandMode!=='mono' || !exercise.lowerMeasures)return exercise.measures;
  return exercise.measures.map((bar,b)=>({...bar,events:bar.events.map((n,i)=>n.rest?exercise.lowerMeasures![b].events[i]:n)}));
}

/** A small preference between legal candidates, never a pitch correction. Only
 * connected fast arrivals within a planned phrase count. Chord arpeggios, breath
 * gaps and the final preparation/approach/tonic retain their existing freedom.
 * Piano accompaniment is deliberately not treated as a second singing line. */
function rapidLeapContinuations(exercise: ExerciseData): number {
  if(!exercise.phrasePlan?.length || !exercise.harmonyPlan?.length)return 0;
  const voice=melodicVoice(exercise);
  const cadence=new Set(voice.flatMap(bar=>bar.events).filter(note=>!note.rest).slice(-3));
  const phraseStarts=new Set(exercise.phrasePlan.map(phrase=>phrase.startBar));
  let previous:{note:GeneratedNote;time:number}[]=[],offset=0,count=0;
  for(const [barIndex,bar] of voice.entries()) {
    if(phraseStarts.has(barIndex))previous=[];
    for(const note of bar.events) {
      if(note.rest){previous=[];continue;}
      const time=offset+note.startUnits;
      if(previous.length===2 && !cadence.has(note)) {
        const [a,b]=previous,leap=b.note.midi!-a.note.midi!,continuation=note.midi!-b.note.midi!;
        const connected=Math.abs(a.time+a.note.durationUnits-b.time)<1e-7 && Math.abs(b.time+b.note.durationUnits-time)<1e-7;
        const chord=exercise.harmonyPlan[barIndex]?.pitches;
        if(connected && Math.abs(leap)>=7 && Math.abs(continuation)>=3 && leap*continuation>0 &&
          b.note.durationUnits<=2 && note.durationUnits<=2 && chord?.length &&
          ![a.note,b.note,note].every(pitch=>chord.includes(pitch.midi!%12)))count++;
      }
      previous=[...previous,{note,time}].slice(-2);
    }
    offset+=bar.totalUnits;
  }
  return count;
}

/** Checks only undesirable excess, not average interval size. An advanced
 * candidate must not win merely because it is the easiest or smoothest one. */
export function reviewExercise(exercise: ExerciseData, range: PitchRange, allowAccidentals: boolean, pitchFocus?:PitchFocus): ExerciseQuality {
  const result:ExerciseQuality={penalty:0,repeatedBars:0,repeatedNotes:0,leapRuns:0,rapidLeapContinuations:0};
  const tonal = !allowAccidentals && exercise.tonality?.scaleId!=='atonal';
  // Recurring accompaniment figures are useful harmonic support. Audition
  // melodic variety in the lead, rather than rewarding a second busy melody.
  const voices=[melodicVoice(exercise)];
  const available=buildPitchMaterial(exercise.tonality??describeTonality(exercise.keySignature,'major'),range).pitches.length;
  for(const voice of voices) {
    let previousBar='', previous:GeneratedNote|undefined, samePitch=1, leapRun=0;
    for(const bar of voice) {
      const fingerprint=(bar.timeSignature??exercise.timeSignature)+':'+bar.events.map(n=>`${n.rest?'r':n.midi}/${n.durationUnits}`).join(',');
      if(fingerprint===previousBar)result.repeatedBars++;
      previousBar=fingerprint;
      for(const note of bar.events)if(!note.rest) {
        if(previous) {
          const distance=Math.abs(note.midi!-previous.midi!);
          samePitch=distance===0?samePitch+1:1;
          if(samePitch>3 && available>1)result.repeatedNotes++;
          leapRun=distance>={beginner:5,intermediate:7,advanced:12}[exercise.difficulty]?leapRun+1:0;
          // Isolated difficult intervals remain welcome. Four or more consecutive
          // wide leaps are a local overload, not a reason to flatten the whole score.
          if(tonal && leapRun>3)result.leapRuns++;
        }
        previous=note;
      }
    }
  }
  if(tonal && pitchFocus!=='leaps')result.rapidLeapContinuations=rapidLeapContinuations(exercise);
  // Even several awkward connections weigh less than one existing leap-run
  // flag. This breaks otherwise equal candidates without flattening all leaps.
  result.penalty=result.repeatedBars*8+result.repeatedNotes*2+result.leapRuns+Math.min(.75,result.rapidLeapContinuations*.15);
  return result;
}

/** Structural faults are never traded off against a musical preference score. */
export function validateGeneratedExercise(exercise: ExerciseData, range: PitchRange, allowAccidentals: boolean) {
  const classes=buildPitchMaterial(exercise.tonality??describeTonality(exercise.keySignature,'major'),range).pitchClasses;
  for(const staff of [exercise.measures,exercise.lowerMeasures??[]])for(const bar of staff) {
    assertMeasureRhythm(bar,bar.timeSignature??exercise.timeSignature);
    for(const note of bar.events)if(!note.rest) {
      if(!Number.isInteger(note.midi) || note.midi!<range.min || note.midi!>range.max)throw new Error('生成音高超出自訂音域。');
      if(midiFromKey(note.key)!==note.midi || Number(note.key.split('/')[1])!==note.octave)throw new Error('記譜音高與播放音高不一致。');
      if(!allowAccidentals && !classes.includes(note.midi!%12))throw new Error('生成音高不屬於目前調式。');
    }
  }
  const voices=[melodicVoice(exercise),...(exercise.grandMode==='two-hand'&&exercise.lowerMeasures?[exercise.lowerMeasures]:[])];
  for(const voice of voices) {
    const notes=voice.flatMap(m=>m.events).filter(n=>!n.rest);
    for(let i=1;i<notes.length;i++)if(Math.abs(notes[i].midi!-notes[i-1].midi!)>PITCH_DIFFICULTY[exercise.difficulty].maxLeap)
      throw new Error('生成音程超出所選視譜難度。');
  }
  if(exercise.lowerMeasures && exercise.lowerMeasures.length!==exercise.measures.length)throw new Error('大譜表上下聲部小節數不同。');
  if(exercise.lowerMeasures)exercise.measures.forEach((bar,i)=>{
    const lower=exercise.lowerMeasures![i];
    if(!lower || lower.timeSignature!==bar.timeSignature || lower.totalUnits!==bar.totalUnits)throw new Error('大譜表上下聲部拍號不同步。');
  });
}
