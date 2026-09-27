import type {ExerciseData} from '../music';
import type {AssessmentResult} from '../assessment/scoring';
import {measureTimeline} from '../audio/tempo';
import type {RhythmFocus} from './focus';
import {addRhythmUnits} from '../music/rhythmTiming';
import {metricPosition} from '../music/meterFeel';

/** Match the same upper/lower stable time ordering used by the audio and grader. */
export function scoreEvents(exercise: ExerciseData, bpm: number) {
  return [exercise.measures, ...(exercise.lowerMeasures ? [exercise.lowerMeasures] : [])].flatMap((measures,staff) =>
    measureTimeline(exercise,bpm,measures).flatMap((bar,measure) => {
      let units=0;
      return bar.measure.events.flatMap(note => {
        const event={measure,staff,units,time:bar.start+units*bar.secondsPerUnit,note};
        units=addRhythmUnits(units,note.durationUnits);
        return note.rest?[]:[event];
      });
    })).sort((a,b)=>a.time-b.time);
}

export function feedbackNotes(exercise: ExerciseData, bpm: number, result: AssessmentResult | null) {
  if (!result?.reliable) return [];
  const events=scoreEvents(exercise,bpm);
  return result.notes.filter(n=>!n.heard||!n.pitch||!n.rhythm).flatMap(n=>{
    const event=events[n.index];
    return event?[{...event,result:n,kind:!n.heard?'unclear' as const:!n.pitch?'pitch' as const:'rhythm' as const}]:[];
  });
}

export function suggestedPractice(exercise: ExerciseData, bpm: number, result: AssessmentResult) {
  if (!result.reliable || result.completion < 70) return null;
  const errors=feedbackNotes(exercise,bpm,result).filter(n=>n.result.heard);
  const pitchErrors=errors.filter(n=>!n.result.pitch).length;
  const rhythmErrors=errors.filter(n=>!n.result.rhythm);
  if (!pitchErrors && !rhythmErrors.length) return null;
  const events=scoreEvents(exercise,bpm);
  const leapErrors=errors.filter(n=>!n.result.pitch&&n.result.index>0&&Math.abs((n.note.midi??60)-(events[n.result.index-1]?.note.midi??60))>=5).length;
  if (pitchErrors > rhythmErrors.length) return {target:'pitch' as const, rhythmFocus:'balanced' as RhythmFocus, rhythmLevel:'Simple' as const, pitchFocus:leapErrors?'leaps' as const:'balanced' as const};
  const triplets=rhythmErrors.filter(n=>n.note.tuplet===3).length;
  const offbeats=rhythmErrors.filter(n=>!metricPosition(exercise.measures[n.measure],n.note.startUnits,exercise.timeSignature).onPulse&&n.note.durationUnits>=2).length;
  const meterChanges=rhythmErrors.filter(n=>n.measure>0&&n.units===0&&exercise.measures[n.measure].timeSignature!==exercise.measures[n.measure-1].timeSignature).length;
  const dotted=rhythmErrors.filter(n=>n.note.dots>0).length;
  const short=rhythmErrors.filter(n=>n.note.duration==='16').length;
  const focus=[...([[triplets,'triplets'],[dotted,'dotted'],[short,'sixteenths'],[offbeats,'offbeats']] as const)].sort((a,b)=>b[0]-a[0])[0];
  return {target:'rhythm' as const, rhythmFocus:(focus[0]>0?focus[1]:'balanced') as RhythmFocus, pitchFocus:'balanced' as const,mixedMeterFocus:meterChanges>0&&meterChanges>=Math.max(triplets,dotted,short,offbeats)};
}
