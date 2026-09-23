import type {Difficulty, ExerciseData, GeneratedNote, MeasureData, PitchRange} from '../music';
import {buildPitchMaterial, describeTonality, pitchClass, type ScalePitch, type Tonality} from './scales';
import {PITCH_DIFFICULTY, pitchDistanceWeight} from './pitchDifficulty';
import {melodicRandom, planMelodicContours} from './melodicContours';
import {metricPosition} from './meterFeel';

// These are pitch-set practice rules, not reconstructions of traditional performance grammar.
const colors: Record<string, number[]> = {
  major:[4,11], 'natural-minor':[3,8,10], 'harmonic-minor':[8,11], 'melodic-minor':[9,11],
  dorian:[9,3], phrygian:[1,3], lydian:[6,11], mixolydian:[10,4], locrian:[1,6],
  'major-pentatonic':[4,9], shang:[5,10], 'egyptian-pentatonic':[5,10], jue:[3,8], zhi:[5,9], 'minor-pentatonic':[3,10],
  hirajoshi:[2,3,8], in:[1,8], insen:[1,10], iwato:[1,6], yo:[5,9], kumoi:[3,9], ryukyu:[4,11],
  'pelog-pentatonic':[1,3,8], 'slendro-pentatonic':[5,10], 'minor-blues':[6,3], 'major-blues':[3,4],
  'harmonic-major':[8,4], 'phrygian-dominant':[1,4], 'lydian-dominant':[6,10],
  'whole-tone':[6,8], 'diminished-wh':[6,9], 'diminished-hw':[4,10],
};
const approaches: Record<string, number[]> = {
  'harmonic-minor':[11,2], 'melodic-minor':[11,2], lydian:[11,2],
  phrygian:[1], 'phrygian-dominant':[1], locrian:[1], mixolydian:[10,2],
};
const mod = (n: number) => ((n % 12) + 12) % 12;
export function modalProfile(tonality: Tonality) {
  const root = tonality.tonic === null ? null : pitchClass(tonality.tonic);
  const intervals = root === null ? [] : tonality.notes.map(note => mod(pitchClass(note) - root));
  return {
    root,
    anchors: [0,7,3,4].filter(n => intervals.includes(n)),
    colors: (colors[tonality.scaleId] ?? intervals.filter(n => n !== 0)).filter(n => intervals.includes(n)),
    approaches: (approaches[tonality.scaleId] ?? [2,1,11,10,3,9,4,8,5,7,6]).filter(n => intervals.includes(n)),
  };
}

interface Slot {note: GeneratedNote; bar: number; strong: boolean; compound: boolean}
interface Target {
  midi?: number; interval?: number; weight: number; fixed?: boolean;
  minMidi?: number; maxMidi?: number; phrase?: number;
  direction?: number; advance?: boolean; maxScaleStep?: number;
}

function slotsOf(measures: MeasureData[]): Slot[] {
  return measures.flatMap((measure, bar) => {
    return measure.events.flatMap(note => {
      const position = metricPosition(measure,note.startUnits);
      return note.rest ? [] : [{note,bar,strong:position.onPulse,compound:position.compound}];
    });
  });
}

function phraseTargets(slots: Slot[], measures: MeasureData[], pitches: ScalePitch[], tonality: Tonality, melodicLine: boolean, difficulty: Difficulty) {
  const profile = modalProfile(tonality), targets = new Map<number, Target>();
  const barCount=measures.length;
  if(melodicLine) for(const plan of planMelodicContours(measures,pitches,profile.root,difficulty))
    for(const {index,...target} of plan.targets) targets.set(index,target);
  // Phrase endings alternate an open/modal resting tone and the tonic.
  for (let bar = 1; bar < barCount-1; bar += 2) {
    const index = slots.findLastIndex(slot => slot.bar <= bar);
    if (index <= 0 || targets.has(index)) continue;
    const interval = bar % 4 === 3 ? 0 : profile.anchors.find(n => n !== 0) ?? profile.colors[0] ?? 0;
    targets.set(index,{interval,weight:6});
  }
  // Give each phrase a characteristic pitch, without overriding the melodic line or its ending.
  for (let bar = 0; bar < barCount; bar += 4) {
    const candidates = slots.flatMap((slot,i) => slot.bar >= bar && slot.bar < bar+4 && slot.strong && i > 0 && i < slots.length-2 && !targets.has(i) ? [i] : []);
    if (!candidates.length || !profile.colors.length) continue;
    const index = candidates[Math.floor(candidates.length/2)];
    targets.set(index,{interval:profile.colors[(bar/4)%profile.colors.length],weight:9});
  }
  return {targets,profile};
}

function withPitch(note: GeneratedNote, pitch: ScalePitch): GeneratedNote {
  return {...note,midi:pitch.midi,key:`${pitch.key.toLowerCase()}/${pitch.octave}`,octave:pitch.octave};
}

/** Find an entire legal pitch path rather than changing endpoints after the fact. */
function shapeStaff(measures: MeasureData[], range: PitchRange, tonality: Tonality, difficulty: Difficulty, upper?: MeasureData[]) {
  const slots = slotsOf(measures), pitches = buildPitchMaterial(tonality,range).pitches;
  if (!slots.length || !pitches.length) return measures;
  const {targets,profile} = phraseTargets(slots,measures,pitches,tonality,!upper,difficulty);
  if (profile.root === null) return measures;
  const random = melodicRandom(slots.map(slot=>slot.note)), count = pitches.length, maxLeap = PITCH_DIFFICULTY[difficulty].maxLeap;
  // Preserve more of the graded source line as difficulty rises; a universal
  // smoothing penalty previously pulled intermediate/advanced pitches together.
  const sourceWeight = {beginner:.12,intermediate:.28,advanced:.48}[difficulty];
  const roots = pitches.map((p,i) => p.midi % 12 === profile.root ? i : -1).filter(i => i >= 0);
  const last = slots.length-1;
  const neighbors = pitches.map(p => pitches.flatMap((previous,i) => Math.abs(p.midi-previous.midi) <= maxLeap ? [i] : []));
  // Approach the final tonic using an actual scale step, never an invented leading tone.
  const approach = profile.approaches.flatMap(interval => pitches.flatMap((p,i) =>
    mod(p.midi-profile.root!) === interval && roots.some(r => Math.abs(pitches[r].midi-p.midi) <= 3) ? [i] : []));
  const fitsTarget=(index:number, target?:Target)=> {
    const midi=pitches[index].midi;
    return (!target?.fixed || midi===target.midi) && midi>=(target?.minMidi??-Infinity) && midi<=(target?.maxMidi??Infinity);
  };
  const penultimate=targets.get(last-1), ending=targets.get(last);
  const sameContour=ending?.phrase!==undefined && ending.phrase===penultimate?.phrase;
  // A descending final contour may exclude a rising leading tone. Prefer the
  // next legal modal step (e.g. 2–1) rather than abandoning cadence preference.
  const reachableApproach=approach.filter(p=>fitsTarget(p,penultimate) && roots.some(r=>fitsTarget(r,ending)
    && Math.abs(pitches[r].midi-pitches[p].midi)<=3
    && (!sameContour || (Math.abs(r-p)<=(ending.maxScaleStep??2)
      && (ending.direction===undefined || (r-p)*ending.direction>=0)
      && (!ending.advance || r!==p)))));
  const preferredApproach = profile.approaches.find(interval => reachableApproach.some(i => mod(pitches[i].midi-profile.root!) === interval));
  const closing = reachableApproach.filter(i => mod(pitches[i].midi-profile.root!) === preferredApproach);
  const parents: Int16Array[] = [];
  let costs = new Float64Array(count).fill(Infinity);
  for (let index = 0; index < slots.length; index++) {
    const slot = slots[index], target = targets.get(index), next = new Float64Array(count).fill(Infinity);
    const parent = new Int16Array(count).fill(-1);
    const progress = last ? index/last : 0;
    const center = range.min + (range.max-range.min)*(.38+.2*Math.sin(progress*Math.PI));
    const melody = upper?.[slot.bar].events.filter(note => !note.rest &&
      note.startUnits < slot.note.startUnits+slot.note.durationUnits && note.startUnits+note.durationUnits > slot.note.startUnits &&
      (note.startUnits <= slot.note.startUnits || note.durationUnits >= 4)) ?? [];
    for (let p = 0; p < count; p++) {
      if ((index === 0 || index === last) && roots.length && !roots.includes(p)) continue;
      const pitch = pitches[p], interval = mod(pitch.midi-profile.root);
      if (target?.fixed && target.midi !== pitch.midi) continue;
      if (pitch.midi<(target?.minMidi??-Infinity) || pitch.midi>(target?.maxMidi??Infinity)) continue;
      let local = Math.abs(pitch.midi-(slot.note.midi ?? pitch.midi))*sourceWeight + Math.abs(pitch.midi-center)*.025 + random()*3.5;
      if (slot.strong) local += profile.anchors.includes(interval) ? (slot.compound ? -2.2 : -.7) : (slot.compound ? 1.2 : .4);
      if (target?.midi !== undefined) local += Math.abs(pitch.midi-target.midi)*target.weight;
      if (target?.interval !== undefined && interval !== target.interval) local += target.weight;
      if (index === last-1 && last >= 2 && closing.length && !closing.includes(p)) local += 24;
      if (upper && slot.strong) local += melody.reduce((sum,note) => sum + ([0,3,4,5,7,8,9].includes(mod((note.midi ?? 60)-pitch.midi)) ? 0 : 5),0);
      if (index === 0) {next[p]=local; continue;}
      for (const previous of neighbors[p]) {
        const distance = Math.abs(pitch.midi-pitches[previous].midi);
        let transition = -Math.log(pitchDistanceWeight(distance,difficulty));
        // Connect compound subdivisions toward each big beat without removing advanced leaps.
        if (slot.compound && !slot.strong) transition += Math.max(0,distance-5)*({beginner:.12,intermediate:.08,advanced:.035}[difficulty]);
        // Each contour keeps its own graded interval budget, across the barline too.
        const previousTarget=targets.get(index-1);
        if(target?.phrase!==undefined && target.phrase===previousTarget?.phrase) {
          if(Math.abs(p-previous)>(target.maxScaleStep??2))continue;
          if(target.direction!==undefined && (p-previous)*target.direction<0)continue;
          if(target.advance && p===previous)continue;
          if(distance===0)transition+=2;
        }
        if (index === last && closing.includes(previous) && distance > 3) transition += 30;
        const cost = costs[previous]+transition+local;
        if (cost < next[p]) {next[p]=cost; parent[p]=previous;}
      }
    }
    parents.push(parent); costs=next;
  }
  let selected = 0;
  for (let p = 1; p < count; p++) if (costs[p] < costs[selected]) selected=p;
  // Extremely short/custom inputs can make requested endpoints unreachable.
  if (!Number.isFinite(costs[selected])) return measures;
  const replacements = new Map<GeneratedNote, GeneratedNote>();
  for (let index = last; index >= 0; index--) {
    replacements.set(slots[index].note,withPitch(slots[index].note,pitches[selected]));
    selected=parents[index][selected];
  }
  return measures.map(bar => ({...bar,events:bar.events.map(note => replacements.get(note) ?? note)}));
}

/** New-score stage before instrument harmony. Saved scores and chromatic studies bypass it. */
export function addModalPhrasing(exercise: ExerciseData, range: PitchRange, allowAccidentals: boolean): ExerciseData {
  if (allowAccidentals || exercise.tonality?.scaleId === 'atonal') return exercise;
  const tonality = exercise.tonality ?? describeTonality(exercise.keySignature,'major');
  if (tonality.tonic === null || [...exercise.measures,...exercise.lowerMeasures ?? []].some(bar => bar.events.some(note => note.chord))) return exercise;
  if (exercise.grandMode === 'mono' && exercise.lowerMeasures) {
    // Reassemble the single sounding line before shaping, then distribute it by pitch again.
    const melody = exercise.measures.map((bar,b) => ({...bar,events:bar.events.map((note,n) => note.rest ? exercise.lowerMeasures![b].events[n] : note)}));
    const shaped = shapeStaff(melody,range,tonality,exercise.difficulty);
    const distribute = (upper: boolean) => shaped.map(bar => ({...bar,events:bar.events.map(note => !note.rest && ((note.midi ?? 60)>=60)===upper
      ? note : {...note,rest:true,key:upper?'b/4':'d/3',octave:upper?4:3,midi:undefined})}));
    return {...exercise,measures:distribute(true),lowerMeasures:distribute(false)};
  }
  const twoHand = exercise.grandMode === 'two-hand' && !!exercise.lowerMeasures;
  const measures = shapeStaff(exercise.measures,twoHand?{min:60,max:range.max}:range,tonality,exercise.difficulty);
  return {...exercise,measures,...(twoHand ? {lowerMeasures:shapeStaff(exercise.lowerMeasures!,{min:range.min,max:59},tonality,exercise.difficulty,measures)} : {})};
}
