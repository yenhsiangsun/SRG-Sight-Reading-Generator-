import type {Difficulty, MeasureData} from '../music';
import type {ScalePitch} from './scales';
import {melodicRandom} from './melodicContours';

export type StudyForm = 'singing-arch' | 'question-answer' | 'climbing-sequence' | 'returning-wave' | 'descending-song' | 'valley-response' | 'early-peak' | 'terraced-dialogue';
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

const forms: StudyForm[] = ['singing-arch','question-answer','climbing-sequence','returning-wave','descending-song','valley-response','early-peak','terraced-dialogue'];
const figures: Record<Difficulty, StudyFigure[]> = {
  beginner: ['scale','scale','scale','turn'],
  intermediate: ['scale','turn','thirds','broken-chord'],
  advanced: ['scale','turn','thirds','broken-chord','broken-chord'],
};
const patterns: Record<StudyFigure, number[][]> = {
  scale: [[0,1,2,3],[3,2,1,0],[0,1,2,1,2,3]],
  turn: [[0,1,2,1,0],[2,1,0,1,2],[0,0,1,2,1]],
  thirds: [[0,2,1,3,2,4],[4,2,3,1,2,0],[0,2,3,1,2,4]],
  'broken-chord': [[0,2,4,2,1,3,5,3],[4,2,0,2,3,1,0,2],[0,4,2,3,1,5,3,2]],
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
export function planStudyMelody(measures:readonly MeasureData[],pitches:readonly ScalePitch[],root:number|null,difficulty:Difficulty,instrument?:string):StudyMelodyPlan {
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
  const proportions=[[2,2,2,2],[3,3,2],[2,3,3],[4,2,2]][forms.indexOf(form)%4];
  const lengths:number[]=[];let remaining=measures.length;
  while(remaining>0) {
    const desired=measures.length<=4?2:proportions[lengths.length%proportions.length];
    const length=remaining===desired+1?remaining:Math.min(desired,remaining);
    lengths.push(length);remaining-=length;
  }
  const phraseCount=lengths.length;
  const phrases:StudyPhrase[]=Array.from({length:phraseCount},(_,index)=>{
    const closing=index===phraseCount-1,returning=index===Math.floor(phraseCount/2);
    const role=closing?'closing':index===0?'opening':returning?'answer':'development';
    // The later answer recalls a gesture, not an entire bar of notes or rhythm.
    const figure=index===0||returning?theme:material[(material.indexOf(theme)+index)%material.length];
    const startBar=lengths.slice(0,index).reduce((sum,n)=>sum+n,0);
    return {startBar,endBar:startBar+lengths[index]-1,role,figure};
  });
  const roots=pitches.flatMap((pitch,index)=>pitch.midi%12===root?[index]:[]);
  const desiredRoot=(pitches.length-1)*.35;
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
  };
  const offsets:number[]=[];
  let elapsed=0;
  for(const measure of measures){offsets.push(elapsed);elapsed+=measure.totalUnits;}
  const phraseSlots=phrases.map(phrase=>slots.flatMap((slot,index)=>slot.bar>=phrase.startBar&&slot.bar<=phrase.endBar?[index]:[]));
  const targets:StudyTarget[]=[];
  const variant=Math.floor(random()*3);
  for(let phraseIndex=0;phraseIndex<phrases.length;phraseIndex++) {
    const phrase=phrases[phraseIndex],indexes=phraseSlots[phraseIndex];
    if(!indexes.length)continue;
    const variantIndex=phrase.role==='answer'?variant:(variant+phraseIndex)%3;
    const pattern=patterns[phrase.figure][variantIndex],center=pattern.reduce((a,b)=>a+b,0)/pattern.length;
    const amplitude={beginner:.5,intermediate:1.25,advanced:2}[difficulty];
    const direction=phrase.role==='answer'||phrase.role==='closing'?-1:1;
    let previousDegree:number|undefined;
    for(let position=0;position<indexes.length;position++) {
      const index=indexes[position],slot=slots[index];
      const progress=(offsets[slot.bar]+slot.note.startUnits)/Math.max(1,elapsed);
      const register=low+width*interpolate(shape[form],progress);
      // Cells follow sounded notes through the barline. The phrase's second bar
      // therefore continues a sequence rather than restarting the same motif.
      const ornament=(pattern[position%pattern.length]-center)*amplitude*direction;
      const degree=Math.round(clamp(register+ornament,low,high));
      targets.push({index,midi:pitches[degree].midi,weight:2.6,
        preferredStep:previousDegree===undefined?undefined:degree-previousDegree,
        stepWeight:{beginner:2.3,intermediate:1.9,advanced:1.6}[difficulty]});
      previousDegree=degree;
    }
  }
  // Release the figure before the last approach: the modal path solver supplies
  // a legal neighbour and tonic. No fake leading tone is added to a pentatonic.
  for(const target of targets.slice(-Math.min(3,targets.length))) {
    target.weight=.3;target.preferredStep=undefined;target.stepWeight=undefined;
  }
  return {form,phrases,targets};
}
