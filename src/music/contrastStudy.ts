import {generatePracticeExercise,type ExerciseData,type PracticeOptions,type PitchRange} from '../music';
import {generateGrandExercise,createGrandAccompanimentRhythmPlan} from './grandStaff';
import {addModalPhrasing} from './modalPhrasing';
import {coordinateGrandStaff} from './grandAccompaniment';
import {supportsMusicalIntent,type MusicalIntent} from './musicalIntent';
import {planContrastIntent,type ContrastFamily} from './contrastRhythm';
import {describeTonality,buildPitchMaterial,pitchClass} from './scales';
import {metricPosition} from './meterFeel';
import {planBreathing,instrumentMotionPenalty} from './instrumentPlayability';
import {validateGeneratedExercise,reviewExercise} from './exerciseQuality';
import {addRareThirtySeconds} from './rareRhythm';
import {addPipaRollRhythm} from './pipaRollRhythm';
import {settleGrandPhraseRhythm} from './grandPhraseRelease';
import type {MotivicTarget} from './motivicStudy';

const mod=(n:number)=>(n%12+12)%12;
function interpolate(points:readonly number[][],time:number){
  for(let i=1;i<points.length;i++)if(time<=points[i][0])return points[i-1][1]+(points[i][1]-points[i-1][1])*(time-points[i-1][0])/(points[i][0]-points[i-1][0]);
  return points.at(-1)![1];
}

/** Targets remain preferences inside the existing global legal-path solver;
 * range, mode, scalar 32nds and grade leap limits are never bypassed. */
export function contrastPitchGuide(ex:ExerciseData,range:PitchRange,intent:MusicalIntent,family:ContrastFamily):MotivicTarget[]{
  const tonality=ex.tonality??describeTonality(ex.keySignature,'major'),root=pitchClass(tonality.tonic!);
  const pitches=buildPitchMaterial(tonality,ex.grandMode==='two-hand'?{min:60,max:range.max}:range).pitches;
  if(!pitches.length)return[];
  const center=['Piano','Yangqin'].includes(ex.soundProfile??ex.instrument)?70:(range.min+range.max)/2;
  const roots=pitches.flatMap((p,index)=>p.midi%12===root?[index]:[]),home=roots.sort((a,b)=>Math.abs(pitches[a].midi-center)-Math.abs(pitches[b].midi-center))[0]??Math.floor(pitches.length/2);
  const melody=ex.grandMode==='mono'&&ex.lowerMeasures?ex.measures.map((bar,b)=>({...bar,events:bar.events.map((n,i)=>n.rest?ex.lowerMeasures![b].events[i]:n)})):ex.measures;
  const slots=melody.flatMap((m,bar)=>m.events.filter(n=>!n.rest).map(n=>({n,bar}))),span={beginner:4,intermediate:7,advanced:10}[ex.difficulty];
  const nearest=(degree:number)=>Math.max(0,Math.min(pitches.length-1,Math.round(degree)));
  const atPC=(pc:number,desired:number)=>pitches.flatMap((p,index)=>p.midi%12===pc?[index]:[]).sort((a,b)=>Math.abs(a-desired)-Math.abs(b-desired))[0];
  const guide:MotivicTarget[]=slots.map(({n,bar},index)=>{
    const phraseIndex=intent.phrases.findIndex(p=>bar>=p.startBar&&bar<=p.endBar),phrase=intent.phrases[phraseIndex];
    const length=phrase.endBar-phrase.startBar+1,progress=(bar-phrase.startBar+n.startUnits/ex.measures[bar].totalUnits)/length;
    const members=slots.flatMap((s,i)=>s.bar>=phrase.startBar&&s.bar<=phrase.endBar?[i]:[]),ordinal=members.indexOf(index),metric=metricPosition(ex.measures[bar],n.startUnits,ex.timeSignature);
    let degree:number;
    if(family==='dialogue'){
      const answer=phraseIndex%2===1,theme=answer?[0,-1,-3,-2,0]:intent.variant%2?[0,2,1,-1,0]:[0,1,3,2,1];
      const shift=phraseIndex%4===2?Math.max(1,Math.round(span*.3)):answer?1:0;
      const start=Math.max(-Math.min(...theme),Math.min(pitches.length-1-Math.max(...theme),home+shift));
      const nucleus=ordinal<theme.length?theme[ordinal]:interpolate([[0,theme.at(-1)!],[.55,answer?-span*.45:span*.55],[1,0]],progress);
      degree=start+nucleus+(ordinal>=theme.length&&n.durationUnits<=2?[0,1,0,-1][ordinal%4]:0);
    }else{
      const arc=interpolate([[0,-.2],[.18,.05],[.48,1],[.67,.75],[.84,.25],[1,0]],progress);
      const anchor=home+arc*span;
      const chord=intent.harmony[bar],base=pitches.flatMap((p,i)=>chord.pitches.includes(p.midi%12)?[i]:[]).sort((a,b)=>Math.abs(a-anchor)-Math.abs(b-anchor))[0]??home;
      // Each small running gesture has direction even below a held harmonic
      // anchor; the larger line does not quantize every subdivision to one note.
      const subdivisions=[0,1,2,1],offset=Math.floor(metric.offset/Math.max(1,metric.units/4));
      degree=metric.onPulse?base:base+subdivisions[offset%4]*(progress<.55?1:-1);
    }
    const p=nearest(degree);
    return{index,midi:pitches[p].midi,weight:family==='dialogue'?10:8};
  });
  // Keep real approached resting tones. Do not let a broad high point replace
  // the ending with a jump, or manufacture a leading tone in a modal scale.
  for(const phrase of intent.phrases){
    const members=slots.flatMap((s,i)=>s.bar>=phrase.startBar&&s.bar<=phrase.endBar?[i]:[]),end=members.at(-1);
    if(end===undefined)continue;
    const pc=phrase.cadence==='home'?root:intent.harmony[phrase.endBar].root,landing=atPC(pc,home);
    if(landing===undefined)continue;
    guide[end]={index:end,midi:pitches[landing].midi,weight:48};
    if(members.length>1){
      const neighbors=[landing+1,landing-1].filter(i=>pitches[i]&&Math.abs(pitches[i].midi-pitches[landing].midi)<=3);
      if(neighbors.length)guide[members.at(-2)!]={index:members.at(-2)!,midi:pitches[neighbors[0]].midi,weight:30};
    }
  }
  // The global opening restriction is a tonic-supported consonance. Choose
  // one that is actually present instead of requesting an illegal first tone.
  if(guide.length&&![0,3,4,7].includes(mod(guide[0].midi-root)))guide[0]={index:0,midi:pitches[home].midi,weight:12};
  return guide;
}

/** The ordinary composer uses the human-selected long line. Dialogue remains
 * an explicit comparison candidate; specialist settings retain their own route. */
export function composeContrastStudy(options:PracticeOptions,family:ContrastFamily,grandMode?:'mono'|'two-hand'):ExerciseData{
  if(!supportsMusicalIntent(options))throw Error('這個獨立候選目前供一般固定拍號練習比較。');
  const intent=planContrastIntent(options,family);
  const rhythm=addRareThirtySeconds(planBreathing(addPipaRollRhythm(intent.rhythm,options,intent.phrases),options.instrumentProfile,intent.phrases),options.rhythmLevel,options.rhythmFocus);
  intent.rhythm=rhythm;
  const lower=grandMode==='two-hand'?createGrandAccompanimentRhythmPlan(rhythm.map(b=>b.meter),options.rhythmLevel):undefined;
  let best:ExerciseData|undefined,penalty=Infinity,lastError:unknown;
  for(let attempt=0;attempt<3;attempt++){
    const raw=grandMode?generateGrandExercise(options,grandMode,rhythm,lower):generatePracticeExercise(options,rhythm);
    raw.soundProfile=options.instrumentProfile;raw.musicalIntent=intent;raw.phrasePlan=intent.phrases.map(({startBar,endBar,role})=>({startBar,endBar,role}));
    const guide=contrastPitchGuide(raw,options.range,intent,family);
    const shaped=addModalPhrasing(raw,options.range,false,intent.harmony,true,options.instrumentProfile,false,undefined,guide);
    const candidate=coordinateGrandStaff(shaped,options.range,false,false);
    try{validateGeneratedExercise(candidate,options.range,false);}catch(error){lastError=error;continue;}
    const cost=reviewExercise(candidate,options.range,false).penalty+instrumentMotionPenalty(candidate,options.instrumentProfile);
    if(cost<penalty){best=candidate;penalty=cost;}if(cost===0)break;
  }
  if(!best)throw lastError??new Error('這個音域目前無法完成候選樂句。');
  const relaxed=settleGrandPhraseRhythm(best),result=relaxed===best?best:coordinateGrandStaff(relaxed,options.range,false,false);
  validateGeneratedExercise(result,options.range,false);return result;
}
