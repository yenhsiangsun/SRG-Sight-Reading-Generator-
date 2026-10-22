import type {ExerciseData, GeneratedNote, MeasureData, PitchRange} from '../music';
import {buildPitchMaterial, describeTonality} from './scales';
import {melodicRandom} from './melodicContours';
import {metricPosition} from './meterFeel';
import {PITCH_DIFFICULTY} from './pitchDifficulty';
import {planPhraseHarmony} from './phraseHarmony';

const mod=(n:number)=>(n%12+12)%12;
const consonant=(interval:number)=>[0,3,4,5,7,8,9].includes(mod(interval));
interface Slot {note:GeneratedNote;bar:number;index:number;time:number}

function slotsOf(voice:MeasureData[]):Slot[] {
  let offset=0;
  return voice.flatMap((bar,b)=>{
    const slots=bar.events.flatMap((note,index)=>note.rest?[]:[{note,bar:b,index,time:offset+note.startUnits}]);
    offset+=bar.totalUnits;
    return slots;
  });
}

/** These are audible embellishments, not a licence for an unrelated bass:
 * unaccented stepwise passing/neighbour tones and prepared, resolving holds.
 * All other sustained/metrical melody notes receive full harmonic weight. */
function embellishment(slots:Slot[],index:number,voice:MeasureData[],fallback:ExerciseData['timeSignature']) {
  const slot=slots[index],before=slots[index-1],after=slots[index+1];
  if(!after||Math.abs(slot.time+slot.note.durationUnits-after.time)>1e-7)return false;
  const position=metricPosition(voice[slot.bar],slot.note.startUnits,fallback);
  const out=after.note.midi!-slot.note.midi!;
  if(Math.abs(out)>2||!out||slot.note.durationUnits>position.units)return false;
  if(before&&Math.abs(before.time+before.note.durationUnits-slot.time)<1e-7) {
    const incoming=slot.note.midi!-before.note.midi!;
    if(incoming===0&&out<0)return true;
    if(!position.onPulse&&slot.note.durationUnits<=position.units/2&&Math.abs(incoming)<=2&&incoming!==0&&
      (incoming*out>0||before.note.midi===after.note.midi))return true;
  }
  return false;
}

/** Final, melody-led accompaniment pass. It never recomposes the upper voice
 * or consumes the composition RNG. A recurring chord gesture, shared harmonic
 * rhythm and phrase arrivals replace the lower hand's independent melody.
 * Re-run after pitch refinements so held bass notes hear the final melody too. */
export function coordinateGrandStaff(exercise:ExerciseData,range:PitchRange,_allowAccidentals=false,scalar=false):ExerciseData {
  if(exercise.grandMode!=='two-hand'||!exercise.lowerMeasures)return exercise;
  const tonality=exercise.tonality??describeTonality(exercise.keySignature,'major');
  if(tonality.tonic===null||tonality.scaleId==='atonal'||
    [...exercise.measures,...exercise.lowerMeasures].some(bar=>bar.events.some(note=>note.chord)))return exercise;
  const upper=slotsOf(exercise.measures),lower=slotsOf(exercise.lowerMeasures);
  const {pitches,tonicPC}=buildPitchMaterial(tonality,{min:range.min,max:Math.min(59,range.max)});
  if(!upper.length||!lower.length||!pitches.length)return exercise;
  const random=melodicRandom(upper.map(slot=>slot.note));
  const harmony=exercise.harmonyPlan?.length===exercise.measures.length?exercise.harmonyPlan:
    planPhraseHarmony(tonality,exercise.measures.map(bar=>bar.timeSignature??exercise.timeSignature),Math.floor(random()*0x100000000));
  const gestures=[[0,2,1,2],[0,1,2,1],[0,2,0,1],[0,1,2,2]];
  const theme=Math.floor(random()*gestures.length);
  const roots=pitches.flatMap((pitch,index)=>pitch.midi%12===tonicPC?[index]:[]);
  const center=Math.min(50,(pitches[0].midi+pitches.at(-1)!.midi)/2+2);
  const grace=upper.map((_,index)=>embellishment(upper,index,exercise.measures,exercise.timeSignature));
  const melodyAt=(time:number)=>upper.find(slot=>slot.time<=time+1e-7&&slot.time+slot.note.durationUnits>time+1e-7)?.note.midi;
  // Include every actual overlap, not just matching array indices or attacks.
  const overlaps=lower.map(slot=>upper.flatMap((melody,index)=>{
    const duration=Math.min(slot.time+slot.note.durationUnits,melody.time+melody.note.durationUnits)-Math.max(slot.time,melody.time);
    if(duration<=1e-7)return [];
    const position=metricPosition(exercise.measures[melody.bar],melody.note.startUnits,exercise.timeSignature);
    const structural=position.onPulse||melody.note.durationUnits>=position.units;
    return [{midi:melody.note.midi!,weight:Math.min(2,duration/position.units)*(structural?2.5:1)*(grace[index]?.18:1)}];
  }));
  const count=pitches.length,parents:Int16Array[]=[];
  let costs=new Float64Array(count).fill(Infinity);
  for(const [index,slot] of lower.entries()) {
    const position=metricPosition(exercise.lowerMeasures[slot.bar],slot.note.startUnits,exercise.timeSignature);
    const chord=harmony[slot.bar];
    const phrase=Math.max(0,exercise.phrasePlan?.findIndex(phrase=>slot.bar>=phrase.startBar&&slot.bar<=phrase.endBar)??Math.floor(slot.bar/4));
    const gesture=gestures[(theme+phrase)%gestures.length];
    const ordinal=exercise.lowerMeasures[slot.bar].events.slice(0,slot.index).filter(note=>!note.rest).length;
    const desired=chord?.pitches[gesture[ordinal%gesture.length]%chord.pitches.length];
    const next=new Float64Array(count).fill(Infinity),parent=new Int16Array(count).fill(-1);
    for(const [p,pitch] of pitches.entries()) {
      if(index===lower.length-1&&roots.length&&!roots.includes(p))continue;
      let local=Math.abs(pitch.midi-center)*.12;
      if(chord) {
        local+=chord.pitches.includes(pitch.midi%12)?0:position.onPulse?7:3;
        if(position.downbeat&&pitch.midi%12!==chord.root)local+=4;
        if(!scalar&&pitch.midi%12!==desired)local+=1.8;
      }
      if(scalar)local+=Math.abs(pitch.midi-slot.note.midi!)*.35;
      for(const melody of overlaps[index])if(!consonant(melody.midi-pitch.midi)) {
        const interval=mod(melody.midi-pitch.midi);
        local+=melody.weight*([1,11].includes(interval)?18:interval===6?14:10);
      }
      if(index===0){next[p]=local;continue;}
      const previousSlot=lower[index-1],previousMelody=melodyAt(previousSlot.time),currentMelody=melodyAt(slot.time);
      for(let previous=0;previous<count;previous++) {
        if(!Number.isFinite(costs[previous]))continue;
        const motion=pitch.midi-pitches[previous].midi,distance=Math.abs(motion);
        if(distance>PITCH_DIFFICULTY[exercise.difficulty].maxLeap||scalar&&Math.abs(p-previous)>1)continue;
        if(scalar&&index===lower.length-1&&roots.length&&p===previous&&count>1)continue;
        let transition=distance*.24+(distance>7?(distance-7)*.65:0);
        // A recognisable bass pattern may repeat, but should not become a
        // fixed pedal for an entire piece unless the range leaves no choice.
        if(motion===0&&!position.downbeat)transition+=.8;
        if(scalar)transition+=Math.abs((p-previous)-Math.sign(slot.note.midi!-previousSlot.note.midi!))*.6;
        if(previousMelody!==undefined&&currentMelody!==undefined&&motion!==0) {
          const melodicMotion=currentMelody-previousMelody;
          const before=mod(previousMelody-pitches[previous].midi),after=mod(currentMelody-pitch.midi);
          if(motion*melodicMotion>0&&before===after&&[0,7].includes(after))transition+=4;
          if(motion*melodicMotion<0)transition-=.3;
        }
        const cost=costs[previous]+local+transition;
        if(cost<next[p]){next[p]=cost;parent[p]=previous;}
      }
    }
    costs=next;parents.push(parent);
  }
  let chosen=0;
  for(let p=1;p<count;p++)if(costs[p]<costs[chosen])chosen=p;
  if(!Number.isFinite(costs[chosen]))return exercise;
  const replacements=new Map<GeneratedNote,GeneratedNote>();
  for(let index=lower.length-1;index>=0;index--) {
    const pitch=pitches[chosen],note=lower[index].note;
    replacements.set(note,{...note,midi:pitch.midi,key:`${pitch.key.toLowerCase()}/${pitch.octave}`,octave:pitch.octave});
    chosen=parents[index][chosen];
  }
  // Chromatic melody remains intact; the bass still uses the selected tonal
  // palette. Deliberately atonal exercises were excluded above.
  return {...exercise,harmonyPlan:harmony,lowerMeasures:exercise.lowerMeasures.map(bar=>({...bar,
    events:bar.events.map(note=>replacements.get(note)??note)}))};
}
