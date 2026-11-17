import type {ExerciseData,ExpressionAnchor,ExpressionSpan,GeneratedNote} from '../music';
import type {PhraseSpan} from './phrasePlan';
import {metricPosition,pulseGroups} from './meterFeel';

interface Entry {anchor:ExpressionAnchor;note:GeneratedNote;time:number}

/** A short practice hairpin describes one audible gesture, not the full pitch
 * envelope of an eight-bar melody. This is the app's conservative policy;
 * longer gradual dynamics remain valid in imported/saved scores. */
export function planPhraseHairpins(exercise:ExerciseData,phrase:PhraseSpan):ExpressionSpan[]{
  let offset=0;
  const all:Entry[]=exercise.measures.flatMap((bar,b)=>{
    const entries=b<phrase.startBar||b>phrase.endBar?[]:bar.events.map((note,event)=>({anchor:{bar:b,event},note,time:offset+note.startUnits}));
    offset+=bar.totalUnits;return entries;
  });
  const notes=all.filter(e=>!e.note.rest&&e.note.midi!==undefined);
  if(notes.length<4)return[];
  const first=notes[0],last=notes.at(-1)!,peak=notes.reduce((best,e)=>e.note.midi!>best.note.midi!?e:best);
  const spans:ExpressionSpan[]=[];
  const candidate=(end:Entry,kind:'crescendo'|'diminuendo',after=-Infinity)=>{
    const measure=exercise.measures[end.anchor.bar],pulse=pulseGroups(measure,exercise.timeSignature)[0];
    const minimum=Math.min(measure.totalUnits,pulse*2),maximum=Math.min(24,measure.totalUnits*2);
    return notes.filter(start=>{
      const duration=end.time-start.time;
      if(start.time<after||duration<minimum||duration>maximum||end.anchor.bar-start.anchor.bar>1)return false;
      if((kind==='crescendo'?end.note.midi!-start.note.midi!:start.note.midi!-end.note.midi!)<3)return false;
      // A genuine gap is a new gesture. Prefer omitting a hairpin to stretching
      // one through silence or an intervening written dynamic change.
      return !all.some(e=>e.time>start.time&&e.time<end.time&&(e.note.rest||e.note.dynamic));
    }).sort((a,b)=>{
      const score=(entry:Entry)=>{
        const onPulse=metricPosition(exercise.measures[entry.anchor.bar],entry.note.startUnits,exercise.timeSignature).onPulse;
        return (onPulse?4:0)-Math.abs((end.time-entry.time)-measure.totalUnits)*.15;
      };
      return score(b)-score(a);
    })[0];
  };
  if(peak!==first){
    const start=candidate(peak,'crescendo');
    if(start)spans.push({kind:'crescendo',staff:0,start:start.anchor,end:peak.anchor});
  }
  // The closing release uses a nearby local high point, not the highest note
  // of the entire song. Avoid an automatic seven-bar fade after an early peak.
  if(last!==peak){
    const start=candidate(last,'diminuendo',spans.length?peak.time:-Infinity);
    if(start)spans.push({kind:'diminuendo',staff:0,start:start.anchor,end:last.anchor});
  }
  return spans;
}
