import type {ExerciseData,ExpressionSpan,GeneratedNote,MeasureData} from '../music';
import {planMusicalSlurs} from './slurPhrasing';

/** A bar line alone is not a detached ending. Keep a short, single-note
 * pickup joined to its immediate stepwise arrival within the same phrase. */
function leadsAcrossBar(exercise:ExerciseData,barIndex:number,note:GeneratedNote):boolean {
  const bar=exercise.measures[barIndex],next=exercise.measures[barIndex+1]?.events[0];
  if(!next||next.rest||next.startUnits!==0||note.chord?.length||next.chord?.length||
    note.technique||next.technique||note.midi===undefined||next.midi===undefined)return false;
  const step=Math.abs(next.midi-note.midi);
  return step>0&&step<=2&&Math.abs(note.startUnits+note.durationUnits-bar.totalUnits)<1e-7;
}

/** Articulation follows the planned gesture, with no pitch/rhythm edits. */
export function addIntentExpression(exercise:ExerciseData):ExerciseData {
  const intent=exercise.musicalIntent!;
  const decorate=(bars:MeasureData[],lower=false)=>bars.map((bar,b)=>{
    const p=intent.phrases.find(p=>b>=p.startBar&&b<=p.endBar)!;
    const first=bar.events.findIndex(n=>!n.rest),last=bar.events.findLastIndex(n=>!n.rest);
    return {...bar,events:bar.events.map((source,index)=>{
      const {dynamic:_dynamic,articulation:_articulation,...note}=source;
      if(note.rest)return note;
      const result:GeneratedNote={...note};
      if(b===p.startBar&&index===first)result.dynamic=lower?'p':p.role==='closing'?'mp':p.role==='development'?'mf':'mp';
      if(!lower&&b===p.endBar&&index===last&&note.durationUnits>=4)result.articulation='tenuto';
      if(!lower&&intent.grammar==='classical'&&note.durationUnits<=2&&index===last&&b<p.endBar&&
        !leadsAcrossBar(exercise,b,note))result.articulation='staccato';
      if(!lower&&intent.grammar==='pentatonic'&&p.gesture==='answer'&&b===p.startBar&&index===first)result.articulation='accent';
      return result;
    })};
  });
  const marked={...exercise,measures:decorate(exercise.measures),...(exercise.lowerMeasures?{lowerMeasures:decorate(exercise.lowerMeasures,true)}:{})};
  const spans:ExpressionSpan[]=planMusicalSlurs(marked);
  if(intent.grammar==='lyrical'){
    const p=intent.phrases.at(-1)!;
    const notes=marked.measures.flatMap((bar,b)=>b>=p.startBar&&b<=p.endBar?bar.events.flatMap((n,event)=>n.rest?[]:[{n,anchor:{bar:b,event}}]):[]);
    const peak=notes.length?notes.reduce((best,n)=>n.n.midi!>best.n.midi!?n:best):undefined;
    if(notes.length>4&&peak&&peak!==notes[0])spans.push({kind:'crescendo',staff:0,start:notes[0].anchor,end:peak.anchor});
    if(notes.length>4&&peak&&peak!==notes.at(-1))spans.push({kind:'diminuendo',staff:0,start:peak.anchor,end:notes.at(-1)!.anchor});
  }
  return {...marked,expressionSpans:spans};
}
