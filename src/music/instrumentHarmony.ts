import type {ExerciseData, GeneratedNote, MeasureData, NotePitch, PitchRange} from '../music';
import {buildPitchMaterial, describeTonality} from './scales';
import {notePitches} from './notePitches';
import {isShengInstrument, isShengPracticeVoicing} from './shengFingering';
import {pipaDoubleStopFingering} from './pipaFingering';
import {metricPosition} from './meterFeel';
import {harmonyMotionCost} from './instrumentPlayability';

const consonant = (a: number, b: number) => [0,3,4,5,7,8,9].includes(Math.abs(a-b)%12);
const ordered = (pitches: NotePitch[]) => [...pitches].sort((a,b) => a.midi-b.midi);
interface HarmonySlot {note:GeneratedNote;hand:number;bar:number;index:number}

function candidates(anchor: NotePitch, pool: NotePitch[], size: number, valid: (pitches: NotePitch[]) => boolean) {
  const neighbors = pool.filter(pitch => pitch.midi !== anchor.midi && Math.abs(pitch.midi-anchor.midi) <= 12);
  const result: NotePitch[][] = [];
  const visit = (current: NotePitch[], start: number) => {
    if (current.length === size) { if (valid(current)) result.push(ordered(current)); return; }
    for (let i=start; i<neighbors.length; i++) {
      const next = neighbors[i];
      if (!current.every(pitch => Math.abs(pitch.midi-next.midi) <= 12 && consonant(pitch.midi,next.midi))) continue;
      visit([...current,next], i+1);
    }
  };
  visit([anchor],0);
  return result;
}

/** A monophonic grand staff changes staff, not voice. Keep real rests in this
 * line so a short chord passage cannot jump over a breath or silent beat. */
function harmonyLines(exercise:ExerciseData, notes:HarmonySlot[]):HarmonySlot[][] {
  if(exercise.grandMode==='mono'&&exercise.lowerMeasures) {
    return [notes.filter(item=>item.hand===0?!item.note.rest||exercise.lowerMeasures![item.bar].events[item.index].rest:!item.note.rest)
      .sort((a,b)=>a.bar-b.bar||a.note.startUnits-b.note.startUnits)];
  }
  return [...new Set(notes.map(item=>item.hand))].map(hand=>notes.filter(item=>item.hand===hand));
}

/** One occasional two/three-chord passage; longer studies may have a second.
 * The onset uses the planned harmony. Inner chords can move within the mode,
 * subject to the same physical voicing rules and a whole-passage motion cost. */
function addShengPassages(exercise:ExerciseData, instrument:string, material:NotePitch[], staffs:MeasureData[][],
  lines:HarmonySlot[][], selected:Map<GeneratedNote,NotePitch[]>, perBar:Map<number,number>, limit:number, random:()=>number) {
  if(limit<2||random()>=.55)return;
  const minimum=instrument==='Bass Sheng'?4:2;
  const cache=new Map<GeneratedNote,Map<boolean,NotePitch[][]>>();
  const voicings=(item:HarmonySlot,opening:boolean)=>{
    let entry=cache.get(item.note);
    if(!entry){entry=new Map();cache.set(item.note,entry);}
    if(entry.has(opening))return entry.get(opening)!;
    const anchor=notePitches(item.note)[0],center=exercise.harmonyPlan?.[item.bar];
    const pool=opening&&center?material.filter(p=>center.pitches.includes(p.midi%12)):material;
    const valid=(chord:NotePitch[])=>isShengPracticeVoicing(chord.map(p=>p.midi),instrument);
    const choices=material.some(p=>p.midi===anchor.midi)?[...candidates(anchor,pool,2,valid),...candidates(anchor,pool,3,valid)]:[];
    entry.set(opening,choices);return choices;
  };
  const opportunities=lines.flatMap(line=>{
    const ending=new Set(line.filter(item=>!item.note.rest).slice(-3).map(item=>item.note));
    const suitable=(item:HarmonySlot)=>!item.note.rest&&!item.note.chord&&item.note.durationUnits>=minimum&&!ending.has(item.note);
    return line.flatMap((item,start)=>{
      if(!suitable(item)||!metricPosition(staffs[item.hand][item.bar],item.note.startUnits,exercise.timeSignature).onPulse)return [];
      const passage=line.slice(start,start+3);
      let length=0;
      for(const slot of passage) {
        if(!suitable(slot)||!voicings(slot,length===0).length)break;
        length++;
      }
      return length>=2?[{line,start,length}]:[];
    });
  });
  const maximum=exercise.measures.length>=16&&random()<.35?2:1,usedBars:number[]=[];
  for(let passage=0;passage<maximum;passage++) {
    const available=opportunities.filter(({line,start})=>{
      const group=line.slice(start,start+2);
      return selected.size+2<=limit&&group.every(item=>!selected.has(item.note)&&usedBars.every(bar=>Math.abs(bar-item.bar)>=3))&&
        !selected.has(line[start-1]?.note)&&!line[start-1]?.note.chord;
    });
    if(!available.length)break;
    const {line,start,length}=available[Math.floor(random()*available.length)];
    const count=length===3&&selected.size+3<=limit&&random()<.5?3:2;
    const group=line.slice(start,start+count),after=line[start+count];
    if(after?.note.chord||selected.has(after?.note))continue;
    const choices=group.map((item,i)=>voicings(item,i===0)),parents:number[][]=[];
    const preferredSize=random()<.55?3:2;
    let costs:number[]=[];
    choices.forEach((chords,index)=>{
      const center=exercise.harmonyPlan?.[group[index].bar];
      const next:number[]=[],parent:number[]=[];
      chords.forEach((chord,choice)=>{
        const color=center?chord.filter(p=>!center.pitches.includes(p.midi%12)).length/chord.length:0;
        const local=color*2+(chord.length===preferredSize?0:.75)+random()*.3;
        if(index===0) {
          next[choice]=local+(line[start-1]&&!line[start-1].note.rest?harmonyMotionCost(notePitches(line[start-1].note),chord,instrument):0);
          parent[choice]=-1;return;
        }
        next[choice]=Infinity;
        choices[index-1].forEach((previous,p)=>{
          const cost=costs[p]+local+harmonyMotionCost(previous,chord,instrument);
          if(cost<next[choice]){next[choice]=cost;parent[choice]=p;}
        });
      });
      costs=next;parents.push(parent);
    });
    const ranked=costs.map((cost,index)=>({index,cost:cost+(after&&!after.note.rest?harmonyMotionCost(choices.at(-1)![index],notePitches(after.note),instrument):0)}));
    let chosen=ranked.reduce((best,item)=>item.cost<best.cost?item:best).index;
    for(let index=group.length-1;index>=0;index--) {
      const item=group[index];selected.set(item.note,choices[index][chosen]);
      perBar.set(item.bar,(perBar.get(item.bar)??0)+1);usedBars.push(item.bar);
      chosen=parents[index][chosen];
    }
  }
}

/** Decorate a complete rhythm with occasional instrument-specific chords.
 * Pitch range, original melody, rests, meter, and event durations stay intact.
 */
export function addInstrumentHarmony(exercise: ExerciseData, range: PitchRange, random = Math.random): ExerciseData {
  const instrument = exercise.soundProfile;
  const sheng = isShengInstrument(instrument);
  if (!sheng && instrument !== 'Piano' && instrument !== 'Pipa') return exercise;
  if (instrument === 'Piano' && (!exercise.lowerMeasures || exercise.grandMode !== 'two-hand')) return exercise;
  const piano = instrument === 'Piano';
  const tonality = exercise.tonality ?? describeTonality(exercise.keySignature,'major');
  const material = buildPitchMaterial(tonality,range).pitches.map(pitch => ({...pitch,key:`${pitch.key.toLowerCase()}/${pitch.octave}`}));
  const staffs = piano ? [exercise.lowerMeasures!] : [exercise.measures, ...(exercise.lowerMeasures ? [exercise.lowerMeasures] : [])];
  const notes = staffs.flatMap((staff, hand) => staff.flatMap((measure, bar) => measure.events.map((note, index) => ({note, hand, bar, index}))));
  const sounded = notes.filter(item => !item.note.rest);
  const rate = (piano ? {beginner:.22,intermediate:.28,advanced:.32} : {beginner:.10,intermediate:.16,advanced:.20})[exercise.difficulty];
  let target = sounded.length >= 4 ? Math.max(1, Math.floor(sounded.length*rate)) : 0;
  const selected = new Map<GeneratedNote, NotePitch[]>();
  const perBar = new Map<number, number>();
  const advancedSheng=sheng&&exercise.difficulty==='advanced';
  const lines=advancedSheng?harmonyLines(exercise,notes):[];
  const positions=new Map(lines.flatMap(line=>line.map((item,index)=>[item.note,{line,index}] as const)));
  if(advancedSheng) {
    const limit=Math.floor(sounded.length*.3)-sounded.filter(item=>item.note.chord).length;
    addShengPassages(exercise,instrument!,material,staffs,lines,selected,perBar,limit,random);
    target=Math.min(limit,target+selected.size);
  }
  const eligible = sounded.filter(({note}) => !note.chord && note.durationUnits >= 2 && note.startUnits % 2 === 0)
    .filter(({note,hand,bar}) => !sheng || (metricPosition(staffs[hand][bar],note.startUnits,exercise.timeSignature).onPulse &&
      note.durationUnits >= (instrument === 'Bass Sheng' ? 4 : 2)))
    .map(item => ({...item, priority:random() + (item.note.startUnits === 0 ? 1 : 0)}))
    .sort((a,b) => b.priority-a.priority);
  for (const item of eligible) {
    if (selected.size >= target) break;
    const {note, bar, hand, index} = item;
    if(selected.has(note))continue;
    if ((perBar.get(bar) ?? 0) >= (piano ? 2 : 1)) continue;
    const events = staffs[hand][bar].events;
    if (selected.has(events[index-1]) || selected.has(events[index+1])) continue;
    if(advancedSheng) {
      const position=positions.get(note)!;
      if([position.line[position.index-1],position.line[position.index+1]].some(neighbor=>neighbor&&(selected.has(neighbor.note)||neighbor.note.chord)))continue;
    }
    const anchor = notePitches(note)[0];
    // Do not turn a passing chromatic note into an unrelated chord.
    if (!material.some(pitch => pitch.midi === anchor.midi)) continue;
    const melody = piano ? exercise.measures[bar].events.filter(upper => !upper.rest &&
      upper.startUnits < note.startUnits+note.durationUnits && upper.startUnits+upper.durationUnits > note.startUnits &&
      // Short passing notes may move freely; check the attack and sustained melody.
      (upper.startUnits <= note.startUnits || upper.durationUnits >= 4)).flatMap(notePitches) : [];
    const center=exercise.harmonyPlan?.[bar];
    const pool = material.filter(pitch => (!piano || (pitch.midi >= anchor.midi && pitch.midi <= 64)) &&
      (!center || center.pitches.includes(pitch.midi%12)));
    const valid = (chord: NotePitch[]) => {
      if (sheng) return isShengPracticeVoicing(chord.map(pitch => pitch.midi),instrument!);
      if (instrument === 'Pipa') return !!pipaDoubleStopFingering(chord);
      const sorted = ordered(chord);
      // Low bass stays open (fifths/octaves); close thirds start at C3.
      if (sorted.some((pitch, i) => i > 0 && sorted[i-1].midi < 48 && pitch.midi-sorted[i-1].midi < 7)) return false;
      const span = sorted.at(-1)!.midi-sorted[0].midi;
      return span <= (exercise.difficulty === 'beginner' ? 7 : 12) &&
        chord.every(pitch => melody.every(upper => pitch.midi < upper.midi && consonant(pitch.midi,upper.midi)));
    };
    const roll = random();
    const size = instrument === 'Pipa' || exercise.difficulty === 'beginner' ? 2 :
      sheng && exercise.difficulty === 'advanced' && note.durationUnits >= 4 && roll < .06 ? 4 : roll < .65 ? 3 : 2;
    for (let count=size; count>=2; count--) {
      const choices = candidates(anchor,pool,count,valid);
      if (!choices.length) continue;
      const line=sounded.filter(n=>n.hand===hand);
      const position=line.findIndex(n=>n.note===note);
      const neighbors=[line[position-1],line[position+1]].filter(Boolean).map(n=>selected.get(n.note)??notePitches(n.note));
      // Include the nearest chosen chord across the barline, not only single
      // melody notes on either side of this attack.
      const chosen=line.filter(n=>selected.has(n.note)&&Math.abs(n.bar-bar)<=1)
        .sort((a,b)=>Math.abs(a.bar-bar)-Math.abs(b.bar-bar))[0];
      if(chosen)neighbors.push(selected.get(chosen.note)!);
      const ranked=choices.map(chord=>({chord,cost:neighbors.reduce((sum,pitches)=>sum+harmonyMotionCost(pitches,chord,instrument!),0)+random()*.8})).sort((a,b)=>a.cost-b.cost);
      selected.set(note,ranked[0].chord);
      perBar.set(bar,(perBar.get(bar) ?? 0)+1);
      break;
    }
  }
  const decorate = (measures: MeasureData[]) => measures.map(measure => ({...measure,events:measure.events.map(note =>
    selected.has(note) ? {...note,chord:selected.get(note)!} : note)}));
  return {...exercise,measures:piano ? exercise.measures : decorate(exercise.measures),
    ...(exercise.lowerMeasures ? {lowerMeasures:decorate(exercise.lowerMeasures)} : {})};
}
