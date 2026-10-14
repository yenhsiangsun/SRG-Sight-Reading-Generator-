import type {ExerciseData, GeneratedNote, MeasureData, PitchRange} from '../music';
import {beatUnits, openingMeter} from '../audio/tempo';
import {buildPitchMaterial, describeTonality} from './scales';
import {PITCH_DIFFICULTY} from './pitchDifficulty';
import {INSTRUMENTS, type Instrument} from './instruments';
import {metricPosition} from './meterFeel';

interface Slot {note:GeneratedNote; bar:number; event:number; time:number}

function motionProfile(instrument:string) {
  const family=INSTRUMENTS[instrument as Instrument]?.family??'';
  // Relative sight-reading comfort, not a proof of individual fingering speed.
  if(instrument==='Pipa'||['Erhu','Gaohu','Zhonghu'].includes(instrument))return {seconds:.24,reach:5};
  if(instrument.includes('Sheng'))return {seconds:.24,reach:6};
  if(['木管','銅管','國樂・吹管'].includes(family)||instrument==='Voice')return {seconds:.25,reach:5};
  if(family.includes('弦'))return {seconds:.21,reach:6};
  return {seconds:.18,reach:7};
}

function slotsOf(exercise:ExerciseData,measures:MeasureData[]) {
  const secondsPerUnit=60/exercise.tempo/beatUnits(openingMeter(exercise));
  let units=0;
  return measures.flatMap((bar,b)=>{
    const slots=bar.events.map((note,event)=>({note,bar:b,event,time:(units+note.startUnits)*secondsPerUnit}));
    units+=bar.totalUnits;
    return slots;
  });
}

function burden(a:Slot|undefined,b:Slot|undefined,instrument:string) {
  if(!a||!b||a.note.rest||b.note.rest)return 0;
  const elapsed=b.time-a.time,{seconds,reach}=motionProfile(instrument);
  if(elapsed<=0||elapsed>=seconds)return 0;
  return Math.max(0,Math.abs(b.note.midi!-a.note.midi!)-reach)*(seconds/Math.max(.06,elapsed)-1);
}

/** Isolated leaps stay welcome. Only repeated fast register changes incur cost. */
export function fastMotionPenalty(exercise:ExerciseData,instrument=exercise.soundProfile??exercise.instrument) {
  const voices=exercise.grandMode==='mono'&&exercise.lowerMeasures?
    [exercise.measures.map((bar,b)=>({...bar,events:bar.events.map((note,e)=>note.rest?exercise.lowerMeasures![b].events[e]:note)}))]:
    [exercise.measures,...(exercise.lowerMeasures?[exercise.lowerMeasures]:[])];
  let penalty=0;
  for(const voice of voices) {
    const line=slotsOf(exercise,voice);
    for(let i=2;i<line.length;i++) {
      const a=burden(line[i-2],line[i-1],instrument),b=burden(line[i-1],line[i],instrument);
      if(a&&b)penalty+=a+b;
    }
  }
  return penalty;
}

/** A small local repair before chords/expression. Keep durations, strong
 * arrivals, phrase entries, the final three cadence notes and graded limits.
 * No global smoothing, tempo reduction, or changes to saved scores are made.
 */
export function refineFastPassages(exercise:ExerciseData,range:PitchRange,instrument:string,allowAccidentals=false):ExerciseData {
  if(allowAccidentals||exercise.tonality?.scaleId==='atonal'||
    [...exercise.measures,...exercise.lowerMeasures??[]].some(bar=>bar.events.some(note=>note.chord)))return exercise;
  const tonality=exercise.tonality??describeTonality(exercise.keySignature,'major');
  const replacements=new Map<GeneratedNote,GeneratedNote>();
  const mono=exercise.grandMode==='mono'&&exercise.lowerMeasures;
  const voices=mono?[exercise.measures.map((bar,b)=>({...bar,events:bar.events.map((note,e)=>note.rest?exercise.lowerMeasures![b].events[e]:note)}))]:
    [exercise.measures,...(exercise.lowerMeasures?[exercise.lowerMeasures]:[])];
  voices.forEach((voice,staff)=>{
    const line=slotsOf(exercise,voice),sounded=line.filter(slot=>!slot.note.rest);
    const protectedNotes=new Set([...sounded.slice(0,1),...sounded.slice(-3)].map(slot=>slot.note));
    for(const phrase of exercise.phrasePlan??[]) {
      const members=sounded.filter(slot=>slot.bar>=phrase.startBar&&slot.bar<=phrase.endBar);
      if(members.length){protectedNotes.add(members[0].note);protectedNotes.add(members.at(-1)!.note);}
    }
    const staffRange=exercise.grandMode==='two-hand'?
      staff===0?{min:Math.max(60,range.min),max:range.max}:{min:range.min,max:Math.min(59,range.max)}:range;
    const pitches=buildPitchMaterial(tonality,staffRange).pitches;
    const maximum=Math.max(1,Math.ceil(sounded.length*.08));
    let changes=0;
    const effective=(slot:Slot|undefined)=>slot?{...slot,note:replacements.get(slot.note)??slot.note}:undefined;
    for(let i=1;i<line.length-1&&changes<maximum;i++) {
      const source=line[i],current=effective(source)!,previous=effective(line[i-1]),next=effective(line[i+1]);
      if(current.note.rest||protectedNotes.has(source.note)||!previous||!next||previous.note.rest||next.note.rest)continue;
      if(metricPosition(voice[source.bar],source.note.startUnits,exercise.timeSignature).onPulse)continue;
      const incoming=burden(previous,current,instrument),outgoing=burden(current,next,instrument);
      const nearby=burden(effective(line[i-2]),previous,instrument)+burden(next,effective(line[i+2]),instrument);
      if(!incoming&&!outgoing||!((incoming&&outgoing)||nearby))continue;
      const original=incoming+outgoing,maxLeap=PITCH_DIFFICULTY[exercise.difficulty].maxLeap;
      let best=source.note,bestCost=original;
      for(const pitch of pitches) {
        const before=pitch.midi-previous.note.midi!,after=next.note.midi!-pitch.midi;
        if(Math.abs(before)>maxLeap||Math.abs(after)>maxLeap)continue;
        // Keep the source gesture's direction rather than replacing it with a
        // flat repeated pitch. Scalar 32nd-note groups keep their original path.
        if(source.note.duration==='32'||!before||!after||
          Math.sign(before)!==Math.sign(source.note.midi!-previous.note.midi!)||
          Math.sign(after)!==Math.sign(next.note.midi!-source.note.midi!))continue;
        const note={...source.note,midi:pitch.midi,key:`${pitch.key.toLowerCase()}/${pitch.octave}`,octave:pitch.octave};
        const changed={...source,note};
        const cost=burden(previous,changed,instrument)+burden(changed,next,instrument)+Math.abs(pitch.midi-source.note.midi!)*.1;
        if(cost<bestCost-.1){best=note;bestCost=cost;}
      }
      if(best!==source.note){replacements.set(source.note,best);changes++;}
    }
  });
  if(!replacements.size)return exercise;
  const decorate=(voice:MeasureData[])=>voice.map(bar=>({...bar,events:bar.events.map(note=>replacements.get(note)??note)}));
  if(mono) {
    const melody=decorate(voices[0]);
    const staff=(upper:boolean)=>melody.map(bar=>({...bar,events:bar.events.map(note=>!note.rest&&((note.midi??60)>=60)===upper?
      note:{...note,rest:true,key:upper?'b/4':'d/3',octave:upper?4:3,midi:undefined})}));
    return {...exercise,measures:staff(true),lowerMeasures:staff(false)};
  }
  return {...exercise,measures:decorate(exercise.measures),...(exercise.lowerMeasures?{lowerMeasures:decorate(exercise.lowerMeasures)}:{})};
}
