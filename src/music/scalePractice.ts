import type {ExerciseData, MeasureData, PitchRange} from '../music';
import {buildPitchMaterial, describeTonality} from './scales';
import {melodicVoice} from './exerciseQuality';
import {melodicRandom} from './melodicContours';
import {planStudyMelody} from './studyMelody';
import {PITCH_DIFFICULTY} from './pitchDifficulty';
import {metricPosition} from './meterFeel';

/** Compose short scalar gestures inside the existing whole-study phrase arc.
 * Motifs continue across barlines, with varied entry degrees and small links.
 * The complete path is solved before writing notes, including a stepwise cadence.
 * Rhythm, rests and playback timing belong to the rhythm planner and stay intact. */
export function addScalePractice(exercise:ExerciseData, range:PitchRange):ExerciseData {
  const tonality=exercise.tonality??describeTonality(exercise.keySignature,'major');
  const twoHand=exercise.grandMode==='two-hand'&&!!exercise.lowerMeasures;
  const shape=(measures:MeasureData[], voiceRange:PitchRange, upper?:MeasureData[])=>{
    const voice=measures.map(bar=>({...bar,events:bar.events.map(note=>({...note}))}));
    const notes=voice.flatMap(bar=>bar.events).filter(note=>!note.rest);
    const {pitches,tonicPC}=buildPitchMaterial(tonality,voiceRange);
    if(!notes.length||!pitches.length)return voice;
    const random=melodicRandom(notes);
    const plan=planStudyMelody(voice,pitches,tonicPC,exercise.difficulty,exercise.soundProfile);
    const guides=new Map(plan.targets.map(target=>[target.index,target.midi]));
    const slots=voice.flatMap((bar,b)=>bar.events.flatMap(note=>note.rest?[]:[{note,bar:b,strong:metricPosition(bar,note.startUnits).onPulse}]));
    // Directional fragments, turns and repeated-note pickups, not full-octave laps.
    const figures=[[1,1,1,-1],[-1,-1,-1,1],[0,1,1,-1,-1],[1,1,-1,1],[-1,-1,1,1,1],[1,1,1,1,-1,-1]];
    const theme=Math.floor(random()*figures.length),steps:number[]=[],links:boolean[]=[];
    let figure:number[]=[],position=0,phrase=-1;
    for(let i=0;i<slots.length;i++) {
      const nextPhrase=plan.phrases.length?plan.phrases.findIndex(phrase=>slots[i].bar>=phrase.startBar&&slots[i].bar<=phrase.endBar):Math.floor(slots[i].bar/2);
      const entry=nextPhrase!==phrase;
      if(entry||position>=figure.length) {
        const recall=entry&&nextPhrase>0&&nextPhrase%2===0;
        const direction=random()<.5?1:-1;
        figure=figures[i===0||recall?theme:Math.floor(random()*figures.length)].map(step=>step*direction);
        position=0;
      }
      links[i]=entry||position===0;
      steps[i]=figure[position++];
      if(links[i]&&i>0&&random()<{beginner:.2,intermediate:.4,advanced:.55}[exercise.difficulty])
        steps[i]=(steps[i]<0?-1:1)*2;
      phrase=nextPhrase;
    }
    const roots=pitches.flatMap((pitch,i)=>pitch.midi%12===tonicPC?[i]:[]);
    const center=guides.get(0)??pitches[Math.floor(pitches.length/2)].midi;
    const entries=pitches.map((pitch,index)=>({index,distance:Math.abs(pitch.midi-center)}))
      .sort((a,b)=>a.distance-b.distance).slice(0,{beginner:5,intermediate:7,advanced:9}[exercise.difficulty]);
    const opening=entries[Math.floor(random()*entries.length)].index;
    const last=notes.length-1,count=pitches.length,parents:Int16Array[]=[];
    let costs=new Float64Array(count).fill(Infinity);
    for(let i=0;i<notes.length;i++) {
      const next=new Float64Array(count).fill(Infinity),parent=new Int16Array(count).fill(-1);
      const slot=slots[i],harmony=twoHand?exercise.harmonyPlan?.[slot.bar]:undefined;
      // A left-hand hold can meet several right-hand beats. Coordinate those
      // arrivals as well as simultaneous attacks, leaving passing tones free.
      const melody=upper?.[slot.bar].events.filter(note=>!note.rest&&
        note.startUnits<slot.note.startUnits+slot.note.durationUnits&&note.startUnits+note.durationUnits>slot.note.startUnits&&
        (slot.strong&&note.startUnits<=slot.note.startUnits||metricPosition(upper[slot.bar],note.startUnits).onPulse))??[];
      for(let p=0;p<count;p++) {
        if(i===last&&roots.length&&!roots.includes(p))continue;
        const pitch=pitches[p],guide=guides.get(i)??center;
        let local=Math.abs(pitch.midi-guide)*.65;
        if(slots[i].strong&&tonicPC!==null&&!([0,3,4,7].includes((pitch.midi-tonicPC+12)%12)))local+=.8;
        if(harmony&&slot.strong) {
          local+=harmony.pitches.includes(pitch.midi%12)?-6:6;
          if(upper&&slot.note.startUnits===0&&pitch.midi%12!==harmony.root)local+=3;
        }
        if(tonicPC!==null&&melody.length) {
          local+=melody.reduce((sum,note)=>sum+([0,3,4,5,7,8,9].includes(((note.midi!-pitch.midi)%12+12)%12)?0:18),0);
        }
        if(i===0){next[p]=local+Math.abs(p-opening)*5;continue;}
        const budget=i===last||(notes[i].duration==='32'&&notes[i-1].duration==='32')?1:links[i]?{beginner:2,intermediate:3,advanced:4}[exercise.difficulty]:1;
        for(let previous=Math.max(0,p-budget);previous<=Math.min(count-1,p+budget);previous++) {
          const step=p-previous;
          if(Math.abs(pitch.midi-pitches[previous].midi)>PITCH_DIFFICULTY[exercise.difficulty].maxLeap)continue;
          // Final approach belongs to the scale and is planned jointly with the tonic.
          // Harmony preferences must not replace a reachable neighbour with a repeated tonic.
          if(i===last&&roots.length&&step===0&&[p-1,p+1].some(neighbour=>pitches[neighbour]&&
            Math.abs(pitch.midi-pitches[neighbour].midi)<=PITCH_DIFFICULTY[exercise.difficulty].maxLeap))continue;
          const motion=i===last?(step===0?12:0):Math.abs(step-steps[i])*9+(step===0&&steps[i]!==0?3:0);
          const cost=costs[previous]+local+motion;
          if(cost<next[p]){next[p]=cost;parent[p]=previous;}
        }
      }
      costs=next;parents.push(parent);
    }
    let chosen=0;
    for(let p=1;p<count;p++)if(costs[p]<costs[chosen])chosen=p;
    if(!Number.isFinite(costs[chosen]))return voice;
    const path:number[]=[];
    for(let i=last;i>=0;i--){path[i]=chosen;chosen=parents[i][chosen];}
    notes.forEach((note,position)=>{
      const index=path[position];
      const pitch=pitches[index];
      Object.assign(note,{midi:pitch.midi,key:`${pitch.key.toLowerCase()}/${pitch.octave}`,octave:pitch.octave});
      delete note.chord;
    });
    return voice;
  };
  const voice=shape(melodicVoice(exercise),twoHand?{min:60,max:range.max}:range);
  if(exercise.grandMode==='mono'&&exercise.lowerMeasures) {
    const staff=(upper:boolean)=>voice.map(bar=>({...bar,events:bar.events.map(note=>
      !note.rest&&((note.midi??60)>=60)===upper?note:
        {...note,rest:true,midi:undefined,key:upper?'b/4':'d/3',octave:upper?4:3})}));
    return {...exercise,measures:staff(true),lowerMeasures:staff(false)};
  }
  return {...exercise,measures:voice,...(twoHand?{lowerMeasures:shape(exercise.lowerMeasures!,{min:range.min,max:59},voice)}:{})};
}
