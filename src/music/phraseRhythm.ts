import type {RhythmLevel, RhythmPattern, TimeSignature} from '../music';
import {focusedComposition, type RhythmFocus} from '../practice/focus';
import {pulseGroups} from './meterFeel';
import {createGroupComposition, createPracticeRhythm, type PracticeRhythmNote} from './practiceRhythm';

type Cell = Omit<RhythmPattern, 'weight'>[];
export interface RhythmBarPlan {meter: TimeSignature; notes: PracticeRhythmNote[]}
const shape = (cell: readonly {units: number; tuplet?: 3}[]) => cell.map(n=>`${n.units}${n.tuplet?'t':''}`).join(',');
const plain = (units: number[]): Cell => units.map(units=>({units, dots:units===6?1:0, duration:units===6||units===4?'q':'8'}));
const dense = (cell: Cell) => cell.filter(n=>n.units===1).length >= cell.reduce((sum,n)=>sum+n.units,0)*.65;

/** Time is planned in phrases before pitches, including the landing note.
 * A cell is one actual pulse: 4 units in /4, 6 in compound meter, 4+4+6 in 7/8.
 * No template is stretched from a simple beat into a compound beat. */
export function createPhraseRhythmPlan(meters: readonly TimeSignature[], level: RhythmLevel, focus: RhythmFocus = 'balanced'): RhythmBarPlan[] {
  const state = {previousRest:false,opening:true};
  let materials = new Map<number, Cell[]>(), lastCell = '', busy = 0, position = 0;
  return meters.map((meter,bar) => {
    const eighth = meter.endsWith('/8'), groups = pulseGroups({timeSignature:meter,groups:[]});
    // Each four-bar section introduces fresh material; a meter change starts a new rhythmic vocabulary.
    if (bar%4===0 || meter!==meters[bar-1]) {materials=new Map();lastCell='';busy=0;position=0;}
    const draw = (units:number):Cell => focus==='balanced' ? createGroupComposition(units,level,eighth,false) : focusedComposition(units,focus,level);
    const cells = groups.map(units => {
      let palette=materials.get(units);
      if(!palette) {palette=Array.from({length:3},()=>draw(units));materials.set(units,palette);}
      // Recall a small vocabulary at changing positions, with fresh connecting material.
      // We never copy a measure or restart a pitch contour at its barline.
      const recalled = palette[(position + Math.floor(position/3))%palette.length];
      let cell = Math.random()<.62 ? recalled : draw(units);
      if(shape(cell)===lastCell && Math.random()<.7) cell=draw(units);
      // Tuplets are occasional contrasts, never a repeatedly recalled palette cell.
      if(!eighth && focus==='balanced' && Math.random() < {simple:.045,medium:.085,complex:.13}[level])
        cell=Array.from({length:3},()=>({units:4/3,duration:'8',dots:0,tuplet:3}));
      // Limit sustained subdivision pressure without lowering the selected tier everywhere.
      if(busy>=3 && dense(cell) && focus==='balanced') cell=plain(units===6?[2,2,2]:[2,2]);
      busy=dense(cell)?busy+1:0;lastCell=shape(cell);position++;
      return cell;
    });
    const final = bar===meters.length-1;
    if(final) {
      // A complete last pulse sounds to the barline. 3/8 retains an approach note
      // then a quarter landing, instead of reducing its entire final bar to one note.
      cells[cells.length-1]=meter==='3/8'?plain([2,4]):plain([groups.at(-1)!]);
    } else if ((bar+1)%4===0 && groups.length>1 && focus==='balanced') {
      // An internal comma keeps moving; only the final cadence gets a full held pulse.
      cells[cells.length-1]=plain(groups.at(-1)===6?[2,4]:[2,2]);
    }
    const notes=createPracticeRhythm(groups,level,eighth,state,focus,cells);
    if(final) {
      const last=notes.at(-1)!;
      last.rest=false;
      state.previousRest=false;
    }
    return {meter,notes};
  });
}

/** Prefer varied phrases to copied bars or uninterrupted dense runs. This score
 * has no pitch input, so pitch difficulty cannot quietly simplify the rhythm. */
export function rhythmPlanPenalty(plan: readonly RhythmBarPlan[], level?: RhythmLevel) {
  let penalty=0,previous='',busy=0;
  for(const bar of plan) {
    const fingerprint=bar.meter+':'+bar.notes.map(n=>`${n.units}/${Number(n.rest)}`).join(',');
    // Repeated ordinary quarter/eighth pulses are useful, especially in simple
    // studies. Penalizing them would select triplets merely to avoid repetition.
    if(fingerprint===previous && bar.notes.some(n=>n.units===1))penalty+=.5;
    previous=fingerprint;
    let start=0;
    for(const units of pulseGroups({timeSignature:bar.meter,groups:[]})) {
      const notes=bar.notes.filter(n=>n.startUnits>=start && n.startUnits<start+units);
      busy=notes.filter(n=>!n.rest&&n.units===1).length>=units*.65?busy+1:0;
      if(busy>3)penalty+=busy-3;
      start+=units;
    }
  }
  if(plan.length>=4 && level && level!=='simple') {
    for(const eighth of [false,true]) {
      const notes=plan.filter(bar=>bar.meter.endsWith('/8')===eighth).flatMap(bar=>bar.notes).filter(n=>!n.rest&&!n.tuplet);
      if(!notes.length)continue;
      const share=notes.filter(n=>n.units===1).length/notes.length;
      const minimum=level==='medium'?(eighth?.30:.22):(eighth?.56:.52);
      // A shared palette must still contain the requested challenge. Do not
      // choose a medium/complex plan composed almost entirely of simple pulses.
      penalty+=Math.max(0,minimum-share)*30;
    }
  }
  return penalty;
}

/** Bounded review: select the best of three rhythm plans, never an unbounded retry. */
export function selectPhraseRhythmPlan(meters: readonly TimeSignature[], level: RhythmLevel, focus: RhythmFocus = 'balanced') {
  let best=createPhraseRhythmPlan(meters,level,focus), penalty=rhythmPlanPenalty(best,focus==='balanced'?level:undefined);
  for(let attempt=1;attempt<3;attempt++) {
    const candidate=createPhraseRhythmPlan(meters,level,focus), score=rhythmPlanPenalty(candidate,focus==='balanced'?level:undefined);
    if(score<penalty){best=candidate;penalty=score;}
  }
  return best;
}
