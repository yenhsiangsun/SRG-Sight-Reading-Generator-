import type {ExerciseData, ExpressionAnchor, ExpressionSpan, GeneratedNote, MeasureData} from '../music';
import {metricPosition, pulseGroups} from './meterFeel';
import {rhythmTicks} from './rhythmTiming';
import {INSTRUMENTS, type Instrument} from './instruments';
import type {PhraseSpan} from './phrasePlan';
import {planMusicalSlurs} from './slurPhrasing';

export const dynamicVelocity = {p:0.42, mp:0.58, mf:0.73, f:0.88};
type Character = 'light' | 'sustained' | 'marked';
const pick = (random:()=>number, count:number) => Math.min(count-1,Math.max(0,Math.floor(random()*count)));

/** Conservative practice gestures, not a claim that offbeat accents are forbidden in music. */
function articulate(measure:MeasureData, character:Character, closing:boolean, opening:boolean, random:()=>number, meter:ExerciseData['timeSignature']) {
  const events=measure.events.map(({articulation:_articulation,dynamic:_dynamic,...note})=>note as GeneratedNote);
  const sounded=events.filter(note=>!note.rest);
  if(!sounded.length)return events;
  const position=(note:GeneratedNote)=>metricPosition(measure,note.startUnits,meter);
  const last=sounded.at(-1)!;
  // A sustained arrival at the end of the phrase; never a sixteenth at the end of a run.
  if(closing && position(last).onPulse && last.durationUnits>=position(last).units/2) last.articulation='tenuto';

  if(character==='light') {
    const groups=pulseGroups(measure,meter);
    let start=0;
    const runs:GeneratedNote[][]=[];
    for(const units of groups) {
      const notes=events.filter(note=>note.startUnits>=start && note.startUnits<start+units);
      if(notes.length>=2 && notes.every(note=>!note.rest && !note.articulation && note.durationUnits<=2)
        && rhythmTicks(notes[0].startUnits)===rhythmTicks(start)
        && rhythmTicks(notes.at(-1)!.startUnits+notes.at(-1)!.durationUnits)===rhythmTicks(start+units)
        && !(closing && notes.includes(last)))runs.push(notes);
      start+=units;
    }
    if(runs.length) for(const note of runs[pick(random,runs.length)])note.articulation='staccato';
  } else if(character==='sustained' && !closing) {
    const arrivals=sounded.filter(note=>position(note).onPulse && note.durationUnits>=position(note).units/2);
    if(arrivals.length)arrivals[pick(random,arrivals.length)].articulation='tenuto';
  } else if(character==='marked' && !closing) {
    // At most one accent: a metrical phrase entrance or an approached melodic peak.
    const peaks=sounded.filter((note,index)=>{
      if(!position(note).onPulse || note.durationUnits<2 || note.articulation)return false;
      const previous=sounded[index-1], next=sounded[index+1];
      return (opening && position(note).downbeat) || (previous && next &&
        (note.midi??0)-(previous.midi??0)>=3 && (note.midi??0)>(next.midi??0));
    });
    if(peaks.length)peaks.reduce((a,b)=>(b.midi??0)>(a.midi??0)?b:a).articulation='accent';
  }
  return events;
}

/** Dynamics share a phrase plan across hands; articulation follows musical groups, never note counts. */
function legacyPerformanceMarks(exercise: ExerciseData, random:()=>number): ExerciseData {
  const levels = ['p','mp','mf','f'] as const, characters:Character[]=['light','sustained','marked'];
  let dynamicIndex=pick(random,levels.length), previousCharacter:Character|undefined;
  const plan=exercise.measures.map((_,index)=>{
    if(index>0 && index%4===0) {
      const direction=dynamicIndex===0?1:dynamicIndex===3?-1:random()<.5?-1:1;
      dynamicIndex+=direction;
    }
    if(index%2===0) {
      const choices=characters.filter(character=>character!==previousCharacter);
      previousCharacter=choices[pick(random,choices.length)];
    }
    return {dynamic:levels[dynamicIndex],character:previousCharacter!};
  });
  const decorate=(measures:MeasureData[])=>{
    let previousDynamic:GeneratedNote['dynamic'];
    return measures.map((measure,index)=>{
      const {dynamic,character}=plan[index];
      const events=articulate(measure,character,index%2===1 || index===measures.length-1,index%2===0,random,exercise.timeSignature);
      const first=events.find(note=>!note.rest);
      if(first && dynamic!==previousDynamic){first.dynamic=dynamic;previousDynamic=dynamic;}
      return {...measure,events};
    });
  };
  return {...exercise,measures:decorate(exercise.measures),...(exercise.lowerMeasures?{lowerMeasures:decorate(exercise.lowerMeasures)}:{})};
}

interface LocatedNote {anchor:ExpressionAnchor; note:GeneratedNote}

function phraseNotes(measures:readonly MeasureData[],phrase:PhraseSpan):LocatedNote[] {
  return measures.flatMap((measure,bar)=>bar<phrase.startBar||bar>phrase.endBar?[]:
    measure.events.map((note,event)=>({anchor:{bar,event},note})));
}

/** Legacy eligibility is retained only to keep expression-stage random draws
 * stable. Actual slur placement comes from complete musical gestures below. */
function connectedRuns(notes:readonly LocatedNote[]):LocatedNote[][] {
  const runs:LocatedNote[][]=[];
  let run:LocatedNote[]=[];
  const flush=()=>{if(run.length>=2)runs.push(run);run=[];};
  for(const located of notes) {
    const previous=run.at(-1)?.note,note=located.note;
    if(note.rest||note.articulation==='staccato'||note.technique) {flush();continue;}
    if(previous && Math.abs((note.midi??0)-(previous.midi??0))>7)flush();
    run.push(located);
  }
  flush();return runs;
}

function expressionSpans(exercise:ExerciseData,random:()=>number):ExpressionSpan[] {
  const phrases=exercise.phrasePlan!, spans:ExpressionSpan[]=[];
  const profile=INSTRUMENTS[(exercise.soundProfile??exercise.instrument) as Instrument];
  const slurred=(exercise.soundProfile??exercise.instrument)==='Voice'||
    ['鍵盤','弦樂','木管','銅管','國樂・拉弦','國樂・吹管'].includes(profile?.family??'');
  const maxSlurs=Math.max(1,Math.floor(exercise.measures.length/4));
  const maxHairpins=Math.max(1,Math.floor(exercise.measures.length/6));
  const slurPlan=slurred?planMusicalSlurs(exercise):[];
  let slurs=0,hairpins=0;
  for(const [phraseIndex,phrase] of phrases.entries()) {
    const notes=phraseNotes(exercise.measures,phrase),sounded=notes.filter(({note})=>!note.rest);
    if(slurred&&slurs<maxSlurs&&(phraseIndex%2===0||random()<.3)) {
      const runs=connectedRuns(notes);
      const run=runs.length?runs[pick(random,runs.length)]:undefined;
      if(run) {
        const length=Math.min(run.length,exercise.difficulty==='beginner'?4:6);
        pick(random,run.length-length+1);slurs++;
      }
    }
    spans.push(...slurPlan.filter(span=>span.start.bar>=phrase.startBar&&span.start.bar<=phrase.endBar));
    // Follow a real rise toward a peak, or the release after one. Flat figures
    // receive no arbitrary swell, and the written notes and durations stay intact.
    if(hairpins>=maxHairpins||sounded.length<4||(phraseIndex>0&&random()>=.5))continue;
    const first=sounded[0],last=sounded.at(-1)!;
    const peak=sounded.reduce((best,note)=>(note.note.midi??0)>(best.note.midi??0)?note:best);
    const peakIndex=sounded.indexOf(peak),rise=(peak.note.midi??0)-(first.note.midi??0),fall=(peak.note.midi??0)-(last.note.midi??0);
    const rising=rise>=3&&peakIndex>=2,falling=fall>=3&&sounded.length-peakIndex>=3;
    if(!rising&&!falling)continue;
    const crescendo=rising&&(!falling||rise>=fall);
    const start=crescendo?first:peak,end=crescendo?peak:last;
    spans.push({kind:crescendo?'crescendo':'diminuendo',staff:0,start:start.anchor,end:end.anchor});hairpins++;
  }
  return spans;
}

/** Melody, breath opportunities, articulation and expression share the actual
 * phrase boundaries. Older saved/standalone inputs retain their existing marks.
 */
export function addPerformanceMarks(exercise:ExerciseData,random:()=>number=Math.random,enabled=true):ExerciseData {
  if(!enabled)return exercise;
  if(!exercise.phrasePlan?.length)return legacyPerformanceMarks(exercise,random);
  const levels=['p','mp','mf','f'] as const,characters:Character[]=['light','sustained','marked'];
  let dynamicIndex=pick(random,levels.length),previousCharacter:Character|undefined;
  const gestures=exercise.phrasePlan.map((phrase,index)=>{
    if(index>0)dynamicIndex+=dynamicIndex===0?1:dynamicIndex===3?-1:random()<.5?-1:1;
    const choices=characters.filter(character=>character!==previousCharacter);
    previousCharacter=choices[pick(random,choices.length)];
    return {...phrase,dynamic:levels[dynamicIndex],character:previousCharacter!};
  });
  const decorate=(measures:MeasureData[])=>{
    let previousDynamic:GeneratedNote['dynamic'];
    return measures.map((measure,index)=>{
      const phrase=gestures.find(phrase=>index>=phrase.startBar&&index<=phrase.endBar)!;
      const events=articulate(measure,phrase.character,index===phrase.endBar,index===phrase.startBar,random,exercise.timeSignature);
      const first=events.find(note=>!note.rest);
      if(first&&phrase.dynamic!==previousDynamic){first.dynamic=phrase.dynamic;previousDynamic=phrase.dynamic;}
      return {...measure,events};
    });
  };
  const marked={...exercise,measures:decorate(exercise.measures),...(exercise.lowerMeasures?{lowerMeasures:decorate(exercise.lowerMeasures)}:{})};
  return {...marked,expressionSpans:expressionSpans(marked,random)};
}

export function noteExpression(note: GeneratedNote, velocity: number) {
  return {velocity:note.articulation==='accent'?Math.min(1,velocity*1.22):velocity,
    lengthRatio:note.articulation==='staccato'?0.5:note.articulation==='tenuto'?1:0.95};
}
