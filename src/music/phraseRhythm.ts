import type {RhythmLevel, RhythmPattern, TimeSignature} from '../music';
import {focusedComposition, rhythmFocuses, type RhythmFocus, type RhythmFocusSelection} from '../practice/focus';
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
export function createPhraseRhythmPlan(meters: readonly TimeSignature[], level: RhythmLevel, selection: RhythmFocusSelection = 'balanced', tripletLimit = level==='simple'?1:Infinity): RhythmBarPlan[] {
  const focuses=rhythmFocuses(selection);
  if(focuses.length>1)return createMixedFocusPlan(meters,level,focuses);
  const focus=focuses[0];
  const state = {previousRest:false,opening:true};
  let triplets=0;
  let materials = new Map<number, Cell[]>(), lastCell = '', busy = 0, position = 0;
  return meters.map((meter,bar) => {
    const eighth = meter.endsWith('/8'), groups = pulseGroups({timeSignature:meter,groups:[]});
    // Each four-bar section introduces fresh material; a meter change starts a new rhythmic vocabulary.
    if (bar%4===0 || meter!==meters[bar-1]) {materials=new Map();lastCell='';busy=0;position=0;}
    const draw = (units:number):Cell => focus==='balanced' || (focus==='triplets'&&eighth) ? createGroupComposition(units,level,eighth,false) : focusedComposition(units,focus,level);
    const cells = groups.map(units => {
      let palette=materials.get(units);
      if(!palette) {palette=Array.from({length:level==='simple'?2:3},()=>draw(units));materials.set(units,palette);}
      // Recall a small vocabulary at changing positions, with fresh connecting material.
      // We never copy a measure or restart a pitch contour at its barline.
      const recalled = palette[(position + Math.floor(position/3))%palette.length];
      let cell = Math.random()<(level==='simple'?.92:.62) ? recalled : draw(units);
      if(level!=='simple' && shape(cell)===lastCell && Math.random()<.7) cell=draw(units);
      // Tuplets are occasional contrasts, never a repeatedly recalled palette cell.
      if(!eighth && focus==='balanced' && triplets<tripletLimit && Math.random() < {simple:.025,medium:.085,complex:.13}[level]) {
        cell=Array.from({length:3},()=>({units:4/3,duration:'8',dots:0,tuplet:3}));
        triplets++;
      }
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
    // Plan long tones before pitches. Half notes start on a readable two-beat
    // boundary (never across the middle of 4/4); keep dedicated skill cells intact.
    if(focus==='balanced' && ['2/4','3/4','4/4'].includes(meter) && level!=='complex') {
      const start=final && meter!=='3/4'?groups.length-2:0;
      const hold=level==='simple'?(final||(meter==='2/4'?bar%4===1:bar%2===1)):!final&&bar%4===3;
      if(hold && !cells[start].some(n=>n.tuplet) && !cells[start+1].some(n=>n.tuplet)) {
        cells[start]=[{units:8,duration:'h',dots:0}];
        cells[start+1]=[];
      }
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

/** Deal compatible focus cells in shuffled rounds so every selected skill is
 * represented, instead of letting one random draw dominate a whole score. */
function createMixedFocusPlan(meters:readonly TimeSignature[],level:RhythmLevel,focuses:readonly RhythmFocus[]):RhythmBarPlan[] {
  const state={previousRest:false,opening:true};
  const used=new Map(focuses.map(focus=>[focus,0]));
  return meters.map((meter,bar)=>{
    const eighth=meter.endsWith('/8'),groups=pulseGroups({timeSignature:meter,groups:[]});
    const compatible=focuses.filter(focus=>focus!=='triplets'||!eighth);
    const cells=groups.map((units,index):Cell=>{
      if(bar===meters.length-1&&index===groups.length-1)return meter==='3/8'?plain([2,4]):plain([units]);
      if(!compatible.length)return createGroupComposition(units,level,eighth,false);
      const minimum=Math.min(...compatible.map(focus=>used.get(focus)!));
      const candidates=compatible.filter(focus=>used.get(focus)===minimum);
      const focus=candidates[Math.floor(Math.random()*candidates.length)];
      used.set(focus,minimum+1);
      return focusedComposition(units,focus,level);
    });
    const notes=createPracticeRhythm(groups,level,eighth,state,'balanced',cells);
    if(bar===meters.length-1){notes.at(-1)!.rest=false;state.previousRest=false;}
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
    if(level!=='simple' && fingerprint===previous && bar.notes.some(n=>n.units===1))penalty+=.5;
    previous=fingerprint;
    let start=0;
    for(const units of pulseGroups({timeSignature:bar.meter,groups:[]})) {
      const notes=bar.notes.filter(n=>n.startUnits>=start && n.startUnits<start+units);
      busy=notes.filter(n=>!n.rest&&n.units===1).length>=units*.65?busy+1:0;
      if(busy>3)penalty+=busy-3;
      start+=units;
    }
  }
  if(plan.length>=4 && level) {
    for(const eighth of [false,true]) {
      const notes=plan.filter(bar=>bar.meter.endsWith('/8')===eighth).flatMap(bar=>bar.notes).filter(n=>!n.rest&&!n.tuplet);
      if(!notes.length)continue;
      const share=notes.filter(n=>n.units===1).length/notes.length;
      if(level==='simple') {
        // Keep occasional sixteenths in /8, but avoid a small recalled palette
        // accidentally making a simple study as dense as the middle tier.
        penalty+=(Math.max(0,share-.24)+(eighth?Math.max(0,.16-share):0))*30;
        continue;
      }
      const minimum=level==='medium'?(eighth?.36:.28):(eighth?.60:.58);
      // A shared palette must still contain the requested challenge. Do not
      // choose a medium/complex plan composed almost entirely of simple pulses.
      penalty+=Math.max(0,minimum-share)*30;
    }
  }
  return penalty;
}

/** Bounded review: select the best of three rhythm plans, never an unbounded retry. */
export function selectPhraseRhythmPlan(meters: readonly TimeSignature[], level: RhythmLevel, focus: RhythmFocusSelection = 'balanced', tripletLimit?:number) {
  const balanced=rhythmFocuses(focus)[0]==='balanced';
  let best=createPhraseRhythmPlan(meters,level,focus,tripletLimit), penalty=rhythmPlanPenalty(best,balanced?level:undefined);
  for(let attempt=1;attempt<3;attempt++) {
    const candidate=createPhraseRhythmPlan(meters,level,focus,tripletLimit), score=rhythmPlanPenalty(candidate,balanced?level:undefined);
    if(score<penalty){best=candidate;penalty=score;}
  }
  return best;
}
