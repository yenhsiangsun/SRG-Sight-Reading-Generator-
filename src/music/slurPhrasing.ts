import type {ExerciseData, ExpressionAnchor, ExpressionSpan, GeneratedNote, MeasureData, TimeSignature} from '../music';
import {metricPosition} from './meterFeel';
import type {PhraseSpan} from './phrasePlan';
import {rhythmTicks} from './rhythmTiming';
import {pitchClass} from './scales';

interface LocatedNote {
  note: GeneratedNote;
  anchor: ExpressionAnchor;
  measure: MeasureData;
  meter: TimeSignature;
  time: number;
}
interface Gesture {start:LocatedNote; end:LocatedNote; score:number; phrase:number}

const sounded=(note:GeneratedNote)=>!note.rest&&note.articulation!=='staccato'&&!note.technique;
const tripletStart=(note:GeneratedNote)=>note.tuplet!==3||rhythmTicks(note.startUnits)%48===0;
const tripletEnd=(note:GeneratedNote)=>note.tuplet!==3||rhythmTicks(note.startUnits+note.durationUnits)%48===0;
const samePitch=(a:GeneratedNote,b:GeneratedNote)=>a.midi===b.midi&&
  (a.chord??[]).map(pitch=>pitch.midi).sort((a,b)=>a-b).join(',')===(b.chord??[]).map(pitch=>pitch.midi).sort((a,b)=>a-b).join(',');

function locate(measures:readonly MeasureData[],fallback:TimeSignature):LocatedNote[] {
  let time=0;
  return measures.flatMap((measure,bar)=>{
    const notes=measure.events.map((note,event)=>({note,anchor:{bar,event},measure,meter:measure.timeSignature??fallback,time:time+note.startUnits}));
    time+=measure.totalUnits;
    return notes;
  });
}

function phraseGesture(exercise:ExerciseData,line:readonly LocatedNote[],phrase:PhraseSpan,index:number):Gesture|undefined {
  const notes=line.filter(({anchor})=>anchor.bar>=phrase.startBar&&anchor.bar<=phrase.endBar);
  const first=notes.findIndex(({note})=>!note.rest),last=notes.findLastIndex(({note})=>!note.rest);
  let best:Gesture|undefined;
  for(let start=0;start<notes.length;start++) {
    const from=notes[start],previous=notes[start-1];
    if(!sounded(from.note)||!tripletStart(from.note)||
      from.note.duration==='32'&&previous?.note.duration==='32'&&previous.anchor.bar===from.anchor.bar)continue;
    const position=metricPosition(from.measure,from.note.startUnits,from.meter);
    const pickup=start===first||previous?.note.rest;
    const turn=!!from.note.dynamic||from.note.articulation==='accent';
    // A complete fast pickup may lead into the next pulse; it is never opened
    // in the middle of an existing thirty-second-note group.
    const fastTail=notes.slice(start).find(note=>note.note.duration!=='32');
    const fastPickup=from.note.duration==='32'&&fastTail&&!fastTail.note.rest&&fastTail.note.durationUnits>=2&&
      metricPosition(fastTail.measure,fastTail.note.startUnits,fastTail.meter).onPulse;
    if(!pickup&&!turn&&!position.onPulse&&!fastPickup)continue;
    let previousNote=from;
    for(let end=start+1;end<notes.length;end++) {
      const to=notes[end],next=notes[end+1];
      if(!sounded(to.note)||to.meter!==from.meter||to.anchor.bar-from.anchor.bar>1||
        rhythmTicks(previousNote.time+previousNote.note.durationUnits)!==rhythmTicks(to.time)||
        Math.abs((to.note.midi??0)-(previousNote.note.midi??0))>7||
        to.note.dynamic||to.note.articulation==='accent')break;
      const arrival=metricPosition(to.measure,to.note.startUnits,to.meter);
      const duration=to.time+to.note.durationUnits-from.time;
      if(duration>from.measure.totalUnits*2)break;
      const complete=tripletEnd(to.note)&&!(to.note.duration==='32'&&next?.note.duration==='32'&&next.anchor.bar===to.anchor.bar);
      const release=end===last||next?.note.rest||next?.note.articulation==='staccato'||
        next?.note.articulation==='accent'||!!next?.note.dynamic||!!next?.note.technique;
      const held=to.note.articulation==='tenuto'||to.note.durationUnits>=arrival.units||
        arrival.onPulse&&to.note.durationUnits>=arrival.units/2&&to.note.durationUnits>previousNote.note.durationUnits;
      const pulseEnd=rhythmTicks(to.note.startUnits+to.note.durationUnits)===rhythmTicks(arrival.start+arrival.units);
      // The rapid group resolves onto an arrival note rather than stopping on
      // its last small value merely because a note-count limit was reached.
      const unresolved=!!to.note.tuplet||to.note.duration==='32';
      if(complete&&!(end===start+1&&samePitch(from.note,to.note))&&
        (held||release||pulseEnd)&&(!unresolved||release)) {
        const count=end-start+1;
        const contour=notes.slice(start,end+1).some(({note})=>!samePitch(note,from.note));
        if(contour) {
          const oneOrTwoPulses=duration>=position.units&&duration<=position.units*2;
          const tonic=exercise.tonality?.tonic;
          const restingTone=tonic&&(to.note.midi??-1)%12===pitchClass(tonic)?3:
            exercise.harmonyPlan?.[to.anchor.bar]?.pitches.includes((to.note.midi??-1)%12)?1.5:0;
          const score=(pickup?9:turn?7:position.downbeat?6:4)+
            (to.note.articulation==='tenuto'?12:held?8:release?7:2)+
            (release?4:0)+restingTone+(oneOrTwoPulses?3:0)+(count>=3?2:0)-Math.max(0,count-12)*.3;
          if(!best||score>best.score)best={start:from,end:to,score,phrase:index};
        }
      }
      previousNote=to;
      if(to.note.articulation==='tenuto')break;
    }
  }
  return best;
}

/** Select sparse, complete musical gestures from the already-written score.
 * No pitch, duration, mark or random stream changes. Each phrase offers only
 * one candidate; weak fragments are omitted instead of forcing a curve.
 */
export function planMusicalSlurs(exercise:ExerciseData,staff:0|1=0):ExpressionSpan[] {
  const measures=staff===1?exercise.lowerMeasures:exercise.measures;
  if(!measures||!exercise.phrasePlan?.length)return [];
  const line=locate(measures,exercise.timeSignature);
  const budget=Math.max(1,Math.floor(exercise.measures.length/4));
  const gestures=exercise.phrasePlan.flatMap((phrase,index)=>{
    const gesture=phraseGesture(exercise,line,phrase,index);
    return gesture?[gesture]:[];
  });
  // Favor alternating phrases when gestures are equally clear; stable note
  // positions resolve remaining ties without extra random draws.
  return gestures.sort((a,b)=>b.score-a.score||
    (a.phrase%2)-(b.phrase%2)||a.start.time-b.start.time).slice(0,budget)
    .sort((a,b)=>a.start.time-b.start.time)
    .map(({start,end})=>({kind:'slur',staff,start:start.anchor,end:end.anchor}));
}
