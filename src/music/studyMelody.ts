import type {Difficulty, MeasureData} from '../music';
import type {ScalePitch} from './scales';
import {melodicRandom} from './melodicContours';
import {pulseGroups, metricPosition} from './meterFeel';
import {meterSections} from './meterSections';
import type {PhraseSpan} from './phrasePlan';

export const STUDY_FORMS = ['singing-arch','question-answer','climbing-sequence','returning-wave','descending-song','valley-response','early-peak','terraced-dialogue',
  'lyrical-period','rondo-return','unfolding-line','suspended-answer','expanding-arch','gentle-rocking','rising-dialogue','falling-dialogue'] as const;
export type StudyForm = typeof STUDY_FORMS[number];
export type StudyFigure = 'scale' | 'turn' | 'thirds' | 'broken-chord';
export interface StudyTarget {
  index: number;
  midi: number;
  weight: number;
  preferredStep?: number;
  stepWeight?: number;
}
export interface StudyPhrase {
  startBar: number;
  endBar: number;
  role: 'opening' | 'development' | 'answer' | 'closing';
  figure: StudyFigure;
}
export interface StudyMelodyPlan {form: StudyForm; phrases: StudyPhrase[]; targets: StudyTarget[]}

const forms = STUDY_FORMS;
const figures: Record<Difficulty, StudyFigure[]> = {
  beginner: ['scale','scale','scale','turn'],
  intermediate: ['scale','turn','thirds','broken-chord'],
  advanced: ['scale','turn','thirds','broken-chord','broken-chord'],
};
const patterns: Record<StudyFigure, number[][]> = {
  scale: [[0,1,2,3],[3,2,1,0],[0,1,2,1,2,3],[0,1,2,3,2,1,0,-1],[2,1,0,1,2,3,4],[0,1,2,3,4,3,2,1]],
  turn: [[0,1,2,1,0],[2,1,0,1,2],[0,0,1,2,1],[0,1,0,-1,0,1,2],[2,3,2,1,0,1],[0,-1,0,1,2,1,0]],
  thirds: [[0,2,1,3,2,4],[4,2,3,1,2,0],[0,2,3,1,2,4],[0,2,1,3,4,2,3,1],[3,1,2,0,1,-1],[0,1,3,2,4,3,1]],
  'broken-chord': [[0,2,4,2,1,3,5,3],[4,2,0,2,3,1,0,2],[0,4,2,3,1,5,3,2],[0,2,4,5,4,2,1,0],[4,2,3,1,2,0],[0,4,3,2,1,3,2,0]],
};
// Different phrase proportions combine with the contour independently. These
// are original compositional gestures, not claims to reproduce a national style.
const phraseLayouts = [[2,2,2,2],[3,3,2],[2,3,3],[4,2,2],[2,4,2],[3,2,3],[2,3,2,3],[2,2,4]];
const meterGestures:Partial<Record<NonNullable<MeasureData['timeSignature']>,readonly number[]>>={
  '3/8':[1], '6/8':[1,-1], '9/8':[1,.4,-1], '12/8':[1,.3,-.3,-1], '7/8':[1,-1,1],
};
const clamp = (n:number,low:number,high:number) => Math.max(low,Math.min(high,n));

function interpolate(points:readonly number[],progress:number) {
  const position=clamp(progress,0,1)*(points.length-1),before=Math.floor(position),after=Math.min(points.length-1,before+1);
  return points[before]+(points[after]-points[before])*(position-before);
}

/** A whole-study plan in scale degrees. The figures are reusable compositional
 * vocabulary, not quotations or an external AI model. Meter and durations are
 * already fixed, and the planner never changes them to force a melody to fit.
 *
 * Phrases span two to four bars in varied proportions, with one continuous register
 * arc and a later answer. Cells are shifted within that arc; the second bar is
 * never made by copying/transposing the first bar's finished notes.
 */
export function planStudyMelody(measures:readonly MeasureData[],pitches:readonly ScalePitch[],root:number|null,difficulty:Difficulty,instrument?:string,phrasePlan?:readonly PhraseSpan[]):StudyMelodyPlan {
  const slots=measures.flatMap((bar,b)=>bar.events.flatMap(note=>note.rest?[]:[{note,bar:b}]));
  const random=melodicRandom(slots.map(slot=>slot.note));
  const form=forms[Math.floor(random()*forms.length)];
  if(!slots.length || !pitches.length || root===null)return {form,phrases:[],targets:[]};
  const bowed=['Erhu','Gaohu','Zhonghu'].includes(instrument??'');
  // The supplied bowed-string studies use connected scale fragments and turns;
  // their vocabulary informs new phrases without copying the source melodies.
  const material:StudyFigure[]=bowed && difficulty!=='beginner'?['scale','scale','turn','thirds',...(difficulty==='advanced'?['broken-chord' as const]:[])]:figures[difficulty];
  const theme=material[Math.floor(random()*material.length)];
  // Form changes phrase proportions as well as contour; avoid a universal 2+2+2+2.
  const proportions=phraseLayouts[Math.floor(random()*phraseLayouts.length)];
  const lengths:number[]=[];
  // Meter sections and phrases share their boundaries. Within a long section,
  // retain the varied phrase proportions used by single-meter studies.
  for(const section of meterSections(measures.map(bar=>bar.timeSignature??'4/4'))) {
    let remaining=section.endBar-section.startBar;
    while(remaining>0) {
      const desired=measures.length<=4?2:proportions[lengths.length%proportions.length];
      const length=remaining===desired+1?remaining:Math.min(desired,remaining);
      lengths.push(length);remaining-=length;
    }
  }
  const phraseCount=lengths.length;
  const boundaries=phrasePlan?.length?phrasePlan:Array.from({length:phraseCount},(_,index)=>{
    const closing=index===phraseCount-1,returning=index===Math.floor(phraseCount/2);
    const role=closing?'closing':index===0?'opening':returning?'answer':'development';
    const startBar=lengths.slice(0,index).reduce((sum,n)=>sum+n,0);
    return {startBar,endBar:startBar+lengths[index]-1,role} as PhraseSpan;
  });
  const phrases:StudyPhrase[]=boundaries.map((phrase,index)=>{
    const returning=phrase.role==='answer';
    // The later answer recalls a gesture, not an entire bar of notes or rhythm.
    const figure=index===0||returning?theme:material[(material.indexOf(theme)+index)%material.length];
    return {...phrase,figure};
  });
  const roots=pitches.flatMap((pitch,index)=>pitch.midi%12===root?[index]:[]);
  const desiredRoot=(pitches.length-1)*(.26+random()*.25);
  const home=roots.length?roots.reduce((best,index)=>Math.abs(index-desiredRoot)<Math.abs(best-desiredRoot)?index:best):Math.round(desiredRoot);
  const width=Math.min(pitches.length-1,{beginner:4,intermediate:9,advanced:14}[difficulty]);
  const low=clamp(home-Math.round(width*.3),0,Math.max(0,pitches.length-1-width));
  const high=Math.min(pitches.length-1,low+width);
  const homePosition=clamp((home-low)/Math.max(1,width),0,1);
  const shape:Record<StudyForm,number[]>={
    'singing-arch':[homePosition,.35,.68,.92,.74,.55,.32,homePosition],
    'question-answer':[homePosition,.5,.38,.7,.46,.9,.42,homePosition],
    'climbing-sequence':[homePosition,.28,.48,.68,.9,.73,.42,homePosition],
    'returning-wave':[homePosition,.58,.37,.78,.53,.9,.45,homePosition],
    'descending-song':[.9,.85,.7,.58,.45,.3,.4,homePosition],
    'valley-response':[.65,.45,.2,.05,.3,.65,.8,homePosition],
    'early-peak':[homePosition,.85,1,.7,.45,.3,.4,homePosition],
    'terraced-dialogue':[homePosition,.25,.25,.7,.7,.45,.8,homePosition],
    'lyrical-period':[.4,.65,.5,.3,.45,.8,.6,homePosition],
    'rondo-return':[homePosition,.65,.35,.9,homePosition,.65,.4,homePosition],
    'unfolding-line':[.15,.3,.48,.42,.7,.62,.9,homePosition],
    'suspended-answer':[.6,.75,.5,.65,.35,.5,.2,homePosition],
    'expanding-arch':[homePosition,.4,.3,.7,.5,1,.55,homePosition],
    'gentle-rocking':[.3,.5,.25,.6,.35,.75,.4,homePosition],
    'rising-dialogue':[.2,.5,.3,.65,.45,.9,.7,homePosition],
    'falling-dialogue':[.85,.55,.75,.4,.65,.3,.45,homePosition],
  };
  const offsets:number[]=[];
  let elapsed=0;
  for(const measure of measures){offsets.push(elapsed);elapsed+=measure.totalUnits;}
  const phraseSlots=phrases.map(phrase=>slots.flatMap((slot,index)=>slot.bar>=phrase.startBar&&slot.bar<=phrase.endBar?[index]:[]));
  const targets:StudyTarget[]=[];
  const variant=Math.floor(random()*6);
  const entryRotation=Math.floor(random()*4);
  let precedingDegree:number|undefined;
  for(let phraseIndex=0;phraseIndex<phrases.length;phraseIndex++) {
    const phrase=phrases[phraseIndex],indexes=phraseSlots[phraseIndex];
    if(!indexes.length)continue;
    const variantIndex=phrase.role==='answer'?variant:(variant+phraseIndex)%6;
    const pattern=patterns[phrase.figure][variantIndex],center=pattern.reduce((a,b)=>a+b,0)/pattern.length;
    const amplitude={beginner:.5,intermediate:1.25,advanced:2.2}[difficulty];
    const direction=phrase.role==='closing'?-1:phrase.role==='answer'?(random()<.5?-1:1):1;
    const pulseOffsets=new Map<number,number>();
    let pulseCount=0;
    for(let bar=phrase.startBar;bar<=phrase.endBar;bar++) {
      pulseOffsets.set(bar,pulseCount);
      pulseCount+=pulseGroups(measures[bar]).length;
    }
    const registerAt=(time:number)=>low+width*interpolate(shape[form],time/Math.max(1,elapsed));
    let previousDegree:number|undefined;
    for(let position=0;position<indexes.length;position++) {
      const index=indexes[position],slot=slots[index];
      const register=registerAt(offsets[slot.bar]+slot.note.startUnits);
      // Cells follow sounded notes through the barline. The phrase's second bar
      // therefore continues a sequence rather than restarting the same motif.
      // Rotate the gesture's entry, then let it continue through every barline.
      // A later answer recalls the vocabulary without copying a finished bar.
      const ornament=(pattern[(position+entryRotation)%pattern.length]-center)*amplitude*direction;
      let desired=register+ornament;
      const bar=measures[slot.bar],meter=bar.timeSignature??'4/4';
      if(meter.endsWith('/8')) {
        // Advance the remembered motif once per musical pulse, not once per
        // note. Subdivisions connect its arrivals, so changing from /4 to /8
        // reorganizes the tune instead of merely continuing the same note loop.
        // 3/8 is a complete three-eighth gesture; it remains simple triple.
        const pulse=metricPosition(bar,slot.note.startUnits);
        const pulseIndex=pulseOffsets.get(slot.bar)!+pulse.group;
        const phase=pulse.offset/pulse.units;
        const startTime=offsets[slot.bar]+pulse.start;
        const pulseAmplitude={beginner:.5,intermediate:1.6,advanced:2.8}[difficulty];
        const anchor=(index:number,time:number)=>registerAt(time)+
          (pattern[(index+entryRotation)%pattern.length]-center)*pulseAmplitude*direction;
        const from=anchor(pulseIndex,startTime),to=anchor(pulseIndex+1,startTime+pulse.units);
        const gesture=meterGestures[meter]?.[pulse.group]??1;
        const colour=phrase.figure==='broken-chord'?1.65:phrase.figure==='thirds'?1.2:1;
        desired=from+(to-from)*phase+Math.sin(Math.PI*phase)*pulseAmplitude*gesture*direction*colour;
      }
      const changedMeter=slot.bar>0&&measures[slot.bar-1].timeSignature!==bar.timeSignature;
      // Carry the preceding line into the new grouping without an unrelated
      // register reset. The modal solver still chooses the actual legal path.
      if(position===0&&changedMeter&&precedingDegree!==undefined) {
        const reach={beginner:2,intermediate:3,advanced:4}[difficulty];
        desired=clamp(desired,precedingDegree-reach,precedingDegree+reach);
      }
      const degree=Math.round(clamp(desired,low,high));
      targets.push({index,midi:pitches[degree].midi,weight:2.6,
        preferredStep:previousDegree===undefined?undefined:degree-previousDegree,
        stepWeight:{beginner:2.3,intermediate:1.9,advanced:1.6}[difficulty]});
      previousDegree=degree;
      precedingDegree=degree;
    }
  }
  // Release the figure before the last approach: the modal path solver supplies
  // a legal neighbour and tonic. No fake leading tone is added to a pentatonic.
  for(const target of targets.slice(-Math.min(3,targets.length))) {
    target.weight=.3;target.preferredStep=undefined;target.stepWeight=undefined;
  }
  return {form,phrases,targets};
}
