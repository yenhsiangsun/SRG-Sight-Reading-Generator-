import type {ExerciseData,GeneratedNote,MeasureData,PitchRange} from '../music';
import {buildPitchMaterial,describeTonality} from './scales';
import {metricPosition} from './meterFeel';
import {PITCH_DIFFICULTY} from './pitchDifficulty';
import {melodicRandom} from './melodicContours';
import {planPhraseHarmony} from './phraseHarmony';

const mod=(n:number)=>(n%12+12)%12,epsilon=1e-7;
const stable=(interval:number)=>[0,3,4,7,8,9].includes(mod(interval));
const perfect=(interval:number)=>[0,7].includes(mod(interval));
interface Slot {note:GeneratedNote;bar:number;index:number;time:number;end:number}
interface Line {pitch:number;before:number;cost:number;repeat:number;parallel:number;parent?:Line}
function slots(voice:readonly MeasureData[]):Slot[]{let offset=0;return voice.flatMap((bar,b)=>{
  const result=bar.events.flatMap((note,index)=>note.rest?[]:[{note,bar:b,index,time:offset+note.startUnits,end:offset+note.startUnits+note.durationUnits}]);
  offset+=bar.totalUnits;return result;
});}

/** Ornament status depends on the candidate bass and its actual duration. A
 * scale step alone does not excuse an unsupported accented dissonance. */
function passing(upper:Slot[],index:number,bass:Slot,midi:number,scale:readonly number[],exercise:ExerciseData){
  const a=upper[index-1],b=upper[index],c=upper[index+1];
  if(!a||!c||Math.abs(a.end-b.time)>epsilon||Math.abs(b.end-c.time)>epsilon||a.time<bass.time-epsilon||c.time>=bass.end-epsilon)return false;
  const position=metricPosition(exercise.measures[b.bar],b.note.startUnits,exercise.timeSignature);
  if(position.onPulse||b.note.durationUnits>position.units/2)return false;
  const from=scale.indexOf(a.note.midi!),here=scale.indexOf(b.note.midi!),to=scale.indexOf(c.note.midi!);
  if(from<0||here<0||to<0||Math.abs(here-from)!==1||Math.abs(to-here)!==1)return false;
  return stable(a.note.midi!-midi)&&stable(c.note.midi!-midi);
}

/** A bounded whole-line search remembers the previous two bass pitches, so
 * melodic leap recovery is evaluated alongside vertical and contrapuntal
 * relationships. Source melody, rhythm, mode and random stream are untouched.
 * This is tonal accompaniment, not a claim to strict species counterpoint. */
export function coordinateGrandCounterpoint(exercise:ExerciseData,range:PitchRange,scalar=false):ExerciseData|undefined{
  if(exercise.grandMode!=='two-hand'||!exercise.lowerMeasures)return;
  const tonality=exercise.tonality??describeTonality(exercise.keySignature,'major');
  if(tonality.tonic===null||tonality.scaleId==='atonal'||[...exercise.measures,...exercise.lowerMeasures].some(b=>b.events.some(n=>n.chord)))return;
  const upper=slots(exercise.measures),lower=slots(exercise.lowerMeasures);
  const {pitches,tonicPC}=buildPitchMaterial(tonality,{min:range.min,max:Math.min(59,range.max)});
  if(!upper.length||!lower.length||!pitches.length||tonicPC===null)return;
  const random=melodicRandom(upper.map(s=>s.note));
  const harmonySeed=Math.floor(random()*0x100000000),theme=Math.floor(random()*4);
  const harmony=exercise.harmonyPlan?.length===exercise.measures.length?exercise.harmonyPlan:
    planPhraseHarmony(tonality,exercise.measures.map(b=>b.timeSignature??exercise.timeSignature),harmonySeed);
  const scale=buildPitchMaterial(tonality,range).pitches.map(p=>p.midi);
  const roots=pitches.flatMap((p,i)=>mod(p.midi)===tonicPC?[i]:[]);
  const maxLeap=PITCH_DIFFICULTY[exercise.difficulty].maxLeap;
  const tonalLeading=['major','harmonic-minor','melodic-minor'].includes(tonality.scaleId);
  const melodyAt=(time:number)=>upper.find(s=>s.time<=time+epsilon&&s.end>time+epsilon);
  const joint=lower.map(s=>{
    const current=melodyAt(s.time),previous=upper.findLast(a=>a.time<s.time-epsilon&&a.end>=s.time-epsilon);
    return {current,previous:current&&Math.abs(current.time-s.time)<epsilon?previous:current};
  });
  const overlapping=lower.map(bass=>upper.flatMap((melody,index)=>{
    const duration=Math.min(bass.end,melody.end)-Math.max(bass.time,melody.time);
    return duration>epsilon?[{melody,index,duration}]:[];
  }));
  const positions=lower.map(s=>metricPosition(exercise.lowerMeasures![s.bar],s.note.startUnits,exercise.timeSignature));
  const locals=lower.map((slot,index)=>pitches.map(pitch=>{
    const position=positions[index],chord=harmony[slot.bar];
    let cost=0;
    for(const {melody,index:mi,duration} of overlapping[index]){
      const interval=mod(melody.note.midi!-pitch.midi);
      if(pitch.midi>=melody.note.midi!)return Infinity;
      if(!stable(interval)){
        const metric=metricPosition(exercise.measures[melody.bar],melody.note.startUnits,exercise.timeSignature);
        const ornament=passing(upper,mi,slot,pitch.midi,scale,exercise);
        const structural=metric.onPulse||melody.note.durationUnits>=metric.units;
        const severity=[1,11].includes(interval)?42:interval===6?32:interval===5?20:24;
        cost+=duration/4*severity*(ornament?.12:structural?3:1);
      }else if([0,7].includes(interval))cost+=duration*.12;
    }
    if(chord){
      if(!chord.pitches.includes(mod(pitch.midi)))cost+=position.onPulse?14:5;
      if(position.downbeat&&mod(pitch.midi)!==chord.root)cost+=3;
      const ordinal=exercise.lowerMeasures![slot.bar].events.slice(0,slot.index).filter(n=>!n.rest).length;
      const patterns=[[0,2,1,2],[0,1,2,1],[0,2,0,1],[0,1,2,2]],phrase=Math.max(0,exercise.phrasePlan?.findIndex(p=>slot.bar>=p.startBar&&slot.bar<=p.endBar)??Math.floor(slot.bar/4));
      const target=chord.pitches[patterns[(theme+phrase)%4][ordinal%4]%chord.pitches.length];
      if(mod(pitch.midi)!==target)cost+=scalar?0:.7;
    }
    const center=Math.min(50,(pitches[0].midi+pitches.at(-1)!.midi)/2+2);
    cost+=Math.abs(pitch.midi-center)*.09;
    if(scalar)cost+=Math.abs(pitch.midi-slot.note.midi!)*.35;
    return cost;
  }));
  // Keep an attainable tonic ending without pruning its approach out of the beam.
  const reachable=(pitch:number,index:number)=>!roots.length||roots.some(root=>scalar
    ?Math.abs(root-pitch)<=lower.length-1-index
    :Math.abs(pitches[root].midi-pitches[pitch].midi)<=maxLeap*(lower.length-1-index));
  let beam:Line[]=[];
  for(let index=0;index<lower.length;index++){
    const slot=lower[index],next=new Map<string,Line>();
    for(let p=0;p<pitches.length;p++){
      if(!Number.isFinite(locals[index][p])||!reachable(p,index)||index===lower.length-1&&roots.length&&!roots.includes(p))continue;
      if(index===0){beam.push({pitch:p,before:-1,cost:locals[index][p],repeat:1,parallel:0});continue;}
      const previousSlot=lower[index-1],connected=Math.abs(previousSlot.end-slot.time)<epsilon;
      for(const path of beam){
        const previous=pitches[path.pitch],pitch=pitches[p],motion=pitch.midi-previous.midi,distance=Math.abs(motion);
        if(distance>maxLeap||scalar&&Math.abs(p-path.pitch)>1)continue;
        if(scalar&&index===lower.length-1&&roots.length&&motion===0&&pitches.length>1)continue;
        const top=joint[index],upperMotion=top.current&&top.previous?top.current.note.midi!-top.previous.note.midi!:0;
        const beforeInterval=top.previous?mod(top.previous.note.midi!-previous.midi):undefined;
        const afterInterval=top.current?mod(top.current.note.midi!-pitch.midi):undefined;
        // For the two outer lines, actual simultaneous parallel fifths/octaves
        // and same-direction leaps into perfect intervals are not admissible.
        if(connected&&motion*upperMotion>0&&afterInterval!==undefined&&perfect(afterInterval)&&
          (beforeInterval===afterInterval||Math.abs(upperMotion)>2))continue;
        const repeat=motion===0?Math.min(5,path.repeat+1):1;
        const imperfect=beforeInterval!==undefined&&afterInterval!==undefined&&motion*upperMotion>0&&
          [3,4,8,9].includes(beforeInterval)&&[3,4,8,9].includes(afterInterval);
        const parallel=imperfect?Math.min(4,path.parallel+1):0;
        let transition=distance*.33+(distance>5?(distance-5)*.7:0)+(repeat>3?(repeat-3)*2:0)+(parallel>=3?4:0);
        if(connected&&path.before>=0){
          const previousMotion=previous.midi-pitches[path.before].midi;
          const chord=harmony[slot.bar];
          const arpeggio=previousSlot.bar===slot.bar&&chord&&[pitches[path.before],previous,pitch].every(n=>chord.pitches.includes(mod(n.midi)));
          if(Math.abs(previousMotion)>5&&!arpeggio&&(previousMotion*motion>=0||distance>2))transition+=12;
        }
        const oldTop=joint[index-1].current,newTop=joint[index].current;
        if(connected&&oldTop&&newTop&&motion){
          const direction=newTop.note.midi!-oldTop.note.midi!,a=mod(oldTop.note.midi!-previous.midi),b=mod(newTop.note.midi!-pitch.midi);
          if(direction*motion>0&&perfect(a)&&a===b)transition+=35;
          if(direction*motion<0)transition-=.7;
        }
        if(tonalLeading&&harmony[previousSlot.bar]?.root!==harmony[slot.bar]?.root&&mod(previous.midi)===mod(tonicPC-1)&&motion!==1)transition+=12;
        if(scalar)transition+=Math.abs((p-path.pitch)-Math.sign(slot.note.midi!-previousSlot.note.midi!))*.6;
        const candidate:Line={pitch:p,before:path.pitch,cost:path.cost+locals[index][p]+transition,repeat,parallel,parent:path};
        const key=path.pitch+':'+p+':'+repeat+':'+parallel;
        if(!next.has(key)||candidate.cost<next.get(key)!.cost)next.set(key,candidate);
      }
    }
    if(index>0)beam=[...next.values()].sort((a,b)=>a.cost-b.cost||a.pitch-b.pitch).slice(0,128);
    if(!beam.length)return;
  }
  let chosen:Line|undefined=beam.reduce((a,b)=>a.cost<=b.cost?a:b);
  const replacements=new Map<GeneratedNote,GeneratedNote>();
  for(let index=lower.length-1;index>=0&&chosen;index--){
    const pitch=pitches[chosen.pitch],note=lower[index].note;
    replacements.set(note,{...note,midi:pitch.midi,key:pitch.key.toLowerCase()+'/'+pitch.octave,octave:pitch.octave});chosen=chosen.parent;
  }
  if(replacements.size!==lower.length)return;
  return {...exercise,harmonyPlan:harmony,lowerMeasures:exercise.lowerMeasures.map(bar=>({...bar,events:bar.events.map(n=>replacements.get(n)??n)}))};
}
