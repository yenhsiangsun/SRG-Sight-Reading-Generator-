import type {Difficulty, GeneratedNote, MeasureData} from '../music';
import type {ScalePitch} from './scales';
import {PITCH_DIFFICULTY} from './pitchDifficulty';

export type ContourRule = 'arch' | 'valley' | 'rising' | 'falling' | 'wave' | 'arpeggio';
export interface ContourTarget {
  index: number; midi: number; weight: number; fixed: boolean; phrase: number;
  minMidi: number; maxMidi: number; direction?: number; advance: boolean; maxScaleStep: number;
}
export interface MelodicContour {startBar: number; endBar: number; rule: ContourRule; targets: ContourTarget[]}

const levels = {
  beginner: {span: [3,4], maxSpan: 9, maxScaleStep: 2, rules: ['arch','valley','rising','falling']},
  intermediate: {span: [5,7], maxSpan: 16, maxScaleStep: 4, rules: ['arch','valley','rising','falling','wave','arpeggio']},
  advanced: {span: [8,11], maxSpan: 24, maxScaleStep: 7, rules: ['arch','valley','rising','falling','wave','wave','arpeggio','arpeggio']},
} satisfies Record<Difficulty, {span: number[]; maxSpan: number; maxScaleStep: number; rules: ContourRule[]}>;

/** A local stream keeps melodic choices from changing rhythms or the other hand. */
export function melodicRandom(notes: readonly GeneratedNote[]) {
  let seed = 2166136261;
  for (const note of notes) seed = Math.imul(seed ^ ((note.midi ?? 60) * 31 + Math.round(note.startUnits * 12) + Math.round(note.durationUnits * 12)), 16777619);
  return () => {seed = (Math.imul(seed,1664525) + 1013904223) >>> 0; return seed / 4294967296;};
}

function interpolate(points: number[][], time: number) {
  for (let i=1; i<points.length; i++) if (time <= points[i][0]) {
    const [x0,y0] = points[i-1], [x1,y1] = points[i];
    return y0 + (y1-y0) * (time-x0) / Math.max(.0001,x1-x0);
  }
  return points.at(-1)![1];
}

/** One two-bar line per eight-bar block, chosen from ALL suitable adjacent pairs. */
export function planMelodicContours(measures: MeasureData[], pitches: ScalePitch[], root: number | null, difficulty: Difficulty): MelodicContour[] {
  if (pitches.length < 2 || root === null) return [];
  const slots = measures.flatMap((bar,b) => bar.events.flatMap(note => note.rest ? [] : [{note,bar:b}]));
  const random = melodicRandom(slots.map(slot=>slot.note)), profile = levels[difficulty];
  const plans: MelodicContour[] = [];
  const hasRoot = pitches.some(p=>p.midi%12===root);
  let previousOffset = -1, previousRule: ContourRule | undefined;
  for (let block=0; block+1<measures.length; block+=8) {
    let starts = Array.from({length:Math.min(7,measures.length-block-1)},(_,i)=>block+i)
      .filter(b=>[b,b+1].every(bar=>slots.filter(slot=>slot.bar===bar).length>=2));
    if (!starts.length) continue;
    if (starts.length>1) starts=starts.filter(b=>b-block!==previousOffset);
    const start = starts[Math.floor(random()*starts.length)];
    const indexes = slots.flatMap((slot,i)=>slot.bar===start || slot.bar===start+1 ? [i] : []);
    const previousEnd = plans.at(-1)?.targets.at(-1);
    let reachableLow=0, reachableHigh=pitches.length-1;
    if (previousEnd) {
      reachableLow=reachableHigh=pitches.findIndex(p=>p.midi===previousEnd.midi);
      for(let step=previousEnd.index;step<indexes[0];step++) {
        const lowMidi=pitches[reachableLow].midi,highMidi=pitches[reachableHigh].midi;
        const maxLeap=PITCH_DIFFICULTY[difficulty].maxLeap;
        while(reachableLow>0 && lowMidi-pitches[reachableLow-1].midi<=maxLeap)reachableLow--;
        while(reachableHigh<pitches.length-1 && pitches[reachableHigh+1].midi-highMidi<=maxLeap)reachableHigh++;
        if(reachableLow===0 && reachableHigh===pitches.length-1)break;
      }
    }
    const boundary = indexes.findIndex(i=>slots[i].bar===start+1);
    const times = indexes.map(i=>slots[i].note.startUnits+(slots[i].bar===start?0:measures[start].totalUnits));
    const duration = times.at(-1)!-times[0];
    const normalized = times.map(t=>(t-times[0])/duration);
    const turningTime = measures[start].totalUnits + measures[start+1].totalUnits * (.3 + random()*.25);
    const peak = indexes.map((_,i)=>i).filter(i=>i>=boundary && i<indexes.length-1)
      .sort((a,b)=>Math.abs(times[a]-turningTime)-Math.abs(times[b]-turningTime))[0];
    const turn = normalized[peak];
    const rules = profile.rules.filter(rule=>rule!==previousRule);
    const preferred = rules[Math.floor(random()*rules.length)];
    const span = profile.span[0] + Math.floor(random()*(profile.span[1]-profile.span[0]+1));
    // If a two-bar study cannot rise from tonic to tonic in this narrow range,
    // a returning arc is a musical fallback, without manufacturing extra pitches.
    for (const rule of [...new Set<ContourRule>([preferred,'arch','valley'])]) {
      const points = rule==='arch' ? [[0,0],[turn,1],[1,0]]
        : rule==='valley' ? [[0,1],[turn,0],[1,1]]
        : rule==='rising' ? [[0,0],[.35,.2],[.7,.65],[1,1]]
        : rule==='falling' ? [[0,1],[.35,.8],[.7,.35],[1,0]]
        : rule==='wave' ? [[0,0],[turn*.35,.45],[turn*.65,.2],[turn,1],[1,0]]
        : [[0,0],[turn*.28,.28],[turn*.65,.57],[turn,1],[1,0]];
      const returning = points[0][1]===points.at(-1)![1];
      const capacity = (returning?Math.min(peak,indexes.length-1-peak):indexes.length-1)*profile.maxScaleStep;
      const bounds: {low:number;high:number;cost:number}[] = [];
      for (let low=0; low<pitches.length-1; low++) for (let high=low+1; high<pitches.length; high++) {
        if (high-low>capacity || pitches[high].midi-pitches[low].midi>profile.maxSpan) continue;
        const first = points[0][1]===0?low:high, last = points.at(-1)![1]===0?low:high;
        if(first<reachableLow || first>reachableHigh)continue;
        if (hasRoot && ((start===0 && pitches[first].midi%12!==root) || (start+1===measures.length-1 && pitches[last].midi%12!==root))) continue;
        const anchored = [0,3,4,7].includes((pitches[last].midi-root+12)%12);
        const center = (pitches[0].midi+pitches.at(-1)!.midi)/2;
        bounds.push({low,high,cost:Math.abs(high-low-span)*3 + (anchored?0:2)
          + Math.abs((pitches[low].midi+pitches[high].midi)/2-center)*.03 + random()*2});
      }
      bounds.sort((a,b)=>a.cost-b.cost);
      if (!bounds.length) continue;
      const {low,high} = bounds[0];
      const positions = normalized.map(t=>low+(high-low)*interpolate(points,t));
      if (rule==='arpeggio') {
        // Alternating chord tones and connecting notes unfold through both bars.
        const chord = [low,low+2,low+4,low+7,high].filter(i=>i<=high);
        for (let n=1;n<positions.length-1;n+=2) positions[n]=chord.reduce((a,b)=>Math.abs(b-positions[n])<Math.abs(a-positions[n])?b:a);
      }
      const strictDirection = ['arch','valley','rising','falling'].includes(rule);
      const targets = indexes.map((index,n): ContourTarget => {
        const position = Math.max(low,Math.min(high,positions[n]));
        const floor = Math.floor(position), ceil = Math.ceil(position);
        const direction = n ? Math.sign(positions[n]-positions[n-1]) : 0;
        return {index, midi:pitches[floor].midi+(pitches[ceil].midi-pitches[floor].midi)*(position-floor),
          weight:rule==='arpeggio'?2.8:3.5, fixed:n===0 || n===indexes.length-1 || (returning && n===peak), phrase:start,
          minMidi:pitches[low+(rule==='valley' && n!==peak?1:0)].midi,
          maxMidi:pitches[high-(returning && rule!=='valley' && n!==peak?1:0)].midi,
          maxScaleStep:profile.maxScaleStep,
          direction:strictDirection?direction:undefined,
          advance:strictDirection && high-low>=3 && n===boundary && direction!==0};
      });
      plans.push({startBar:start,endBar:start+1,rule,targets});
      previousOffset=start-block; previousRule=rule;
      break;
    }
  }
  return plans;
}
