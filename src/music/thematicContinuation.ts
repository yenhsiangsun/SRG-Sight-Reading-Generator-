import type {Difficulty,MeasureData} from '../music';
import type {RhythmBarPlan} from './phraseRhythm';
import type {PhraseSpan} from './phrasePlan';
import type {HarmonyBar} from './phraseHarmony';
import type {DialogueTarget} from './thematicDialogue';
import {pulseGroups,metricPosition} from './meterFeel';
import {melodicRandom} from './melodicContours';
import {PITCH_DIFFICULTY,pitchDistanceWeight} from './pitchDifficulty';
import {pitchClass,type ScalePitch,type Tonality} from './scales';

const mod=(n:number)=>(n%12+12)%12;
export function continuationPhrases(count:number):PhraseSpan[] {
  const lengths:number[]=[];
  for(let left=count;left>0;) {const length=left===6?3:Math.min(4,left);lengths.push(length);left-=length;}
  let start=0;
  return lengths.map((length,i)=>{const p:PhraseSpan={startBar:start,endBar:start+length-1,
    role:i===0?'opening':i===lengths.length-1?'closing':i===lengths.length-2&&lengths.length>3?'answer':'development'};start+=length;return p;});
}

/** A longer musical journey: growth across the opening phrase and a later
 * release. Only complete sounded pulse blocks move; all duration budgets and
 * existing rests/tuplets remain, and the two-bar entrance/final bar are intact. */
export function continuationRhythm(plan:RhythmBarPlan[],phrasePlan?:readonly PhraseSpan[]):RhythmBarPlan[] {
  if(plan.length<8||plan.length%2)return plan;
  const releases=phrasePlan?new Set(phrasePlan.slice(0,-1).map(p=>p.endBar)):undefined;
  const blocks:{bar:number;start:number;units:number;notes:RhythmBarPlan['notes']}[]=[];
  for(const [b,bar] of plan.entries()) {
    let start=0,end=0,notes:RhythmBarPlan['notes']=[];
    const groups=pulseGroups({timeSignature:bar.meter,groups:[]});
    const releaseStart=groups.slice(0,-1).reduce((sum,n)=>sum+n,0);
    for(const group of groups) {
      notes.push(...bar.notes.filter(n=>n.startUnits>=end-1e-7&&n.startUnits<end+group-1e-7));end+=group;
      if(notes.length&&Math.abs(notes.at(-1)!.startUnits+notes.at(-1)!.units-end)<1e-7) {
        if(b>=2&&b<plan.length-1&&(!releases?.has(b)||end<=releaseStart+1e-7)&&notes.every(n=>!n.rest&&!n.tuplet))blocks.push({bar:b,start,units:end-start,notes});
        start=end;notes=[];
      }
    }
  }
  const result=plan.map(bar=>({...bar,notes:bar.notes.map(n=>({...n}))})),phrases=phrasePlan??continuationPhrases(plan.length);
  for(const units of new Set(blocks.map(b=>b.units))) {
    const slots=blocks.filter(b=>b.units===units);
    const activity=(b:typeof slots[number])=>{
      const phrase=phrases.find(p=>b.bar>=p.startBar&&b.bar<=p.endBar)!;
      const barUnits=plan[b.bar].notes.reduce((sum,n)=>sum+n.units,0);
      const position=(b.bar-phrase.startBar+b.start/barUnits)/(phrase.endBar-phrase.startBar+1);
      return phrase.role==='closing'?Math.sin(Math.PI*Math.min(1,position*1.3)):
        position+(b.start===0?.08:0);
    };
    const destinations=[...slots].sort((a,b)=>activity(a)-activity(b)||a.bar-b.bar||a.start-b.start);
    const material=[...slots].sort((a,b)=>a.notes.length-b.notes.length||a.notes.at(-1)!.units-b.notes.at(-1)!.units||a.bar-b.bar||a.start-b.start);
    destinations.forEach((slot,i)=>{
      const source=material[i],bar=result[slot.bar];
      bar.notes=bar.notes.filter(n=>n.startUnits<slot.start-1e-7||n.startUnits>=slot.start+units-1e-7)
        .concat(source.notes.map(n=>({...n,startUnits:slot.start+n.startUnits-source.start}))).sort((a,b)=>a.startUnits-b.startUnits);
    });
  }
  return result;
}

/** Slow harmonic pacing follows whole phrases. Diatonic thirds are used only
 * in the Western seven-note contexts; five-note material keeps open supports
 * and colour centres, without importing an absent dominant or leading tone. */
export function continuationHarmony(base:readonly HarmonyBar[],phrases:readonly PhraseSpan[],tonality:Tonality):HarmonyBar[] {
  if(!base.length||tonality.tonic===null)return [...base];
  const root=pitchClass(tonality.tonic),pcs=tonality.notes.map(pitchClass),western=pcs.length===7;
  const home=pcs.indexOf(root),fifth=pcs.indexOf(mod(root+7));
  const degree=(offset:number)=>pcs[(home+offset)%pcs.length];
  const shape=(pc:number)=>{
    const at=pcs.indexOf(pc);
    if(western)return [pc,pcs[(at+2)%7],pcs[(at+4)%7]];
    const support=[7,5,4,3,9,8].find(n=>pcs.includes(mod(pc+n)));
    return support===undefined?[pc]:[pc,mod(pc+support)];
  };
  const variant=(base.reduce((n,b)=>n+b.root,0)+base.length)%2;
  const result=base.map(b=>({...b,pitches:[...b.pitches]}));
  for(const [pi,phrase] of phrases.entries()) {
    const final=pi===phrases.length-1,length=phrase.endBar-phrase.startBar+1;
    for(let bar=phrase.startBar;bar<=phrase.endBar;bar++) {
      const position=bar-phrase.startBar,last=position===length-1,before=position===length-2;
      let pc=root;
      if(western) {
        if(last)pc=final?root:degree(4);
        else if(before)pc=final?degree(4):degree(variant?1:3);
        else if(pi>0)pc=degree(variant?5:3);
        else if(position>0&&variant)pc=degree(5);
      } else {
        const open=fifth<0?degree(2):pcs[fifth];
        if(last)pc=final?root:open;
        else if(before)pc=final?open:degree(variant?1:2);
        else if(pi>0)pc=degree(variant?2:3);
      }
      result[bar]={root:pc,pitches:shape(pc),role:last?(final?'arrive':'depart'):before?'prepare':bar===0?'home':'depart'};
    }
  }
  return result;
}

interface Theme {degrees:number[];route:number}
/** Bounded beam search constructs a whole two-bar theme around a directed
 * skeleton. There is no fixed motif catalogue and no search-until-pleasant loop. */
export function buildContinuationTheme(pitches:ScalePitch[],tonality:Tonality,difficulty:Difficulty,count:number,random:()=>number):Theme|undefined {
  if(pitches.length<5||tonality.tonic===null)return;
  const root=pitchClass(tonality.tonic),route=Math.floor(random()*3),reach={beginner:4,intermediate:8,advanced:13}[difficulty];
  const width=Math.min(pitches.length-1,reach);
  const starts=pitches.flatMap((p,i)=>[0,3,4,7].includes(mod(p.midi-root))?[i]:[]);
  if(!starts.length)return;
  const opening=starts[Math.floor(random()*starts.length)];
  const low=Math.max(0,Math.min(pitches.length-1-width,opening-Math.floor(width*(route===1 ? .7 : .25))));
  const middle=route===1?low:low+width,departure=low+Math.round(width*(route===2?.8:.4));
  const peak=1+Math.floor(random()*Math.max(1,count-3));
  const desired=Array.from({length:count},(_,i)=>i<=peak?opening+(middle-opening)*i/peak:
    middle+(departure-middle)*(i-peak)/Math.max(1,count-1-peak));
  let beam=[{degrees:[opening],cost:0}];
  for(let index=1;index<count;index++) {
    const noise=pitches.map(()=>random()*.9),candidates:typeof beam=[];
    for(const path of beam)for(let degree=low;degree<=low+width;degree++) {
      const previous=path.degrees.at(-1)!,distance=Math.abs(pitches[degree].midi-pitches[previous].midi);
      if(distance>PITCH_DIFFICULTY[difficulty].maxLeap)continue;
      const direction=Math.sign(desired[index]-desired[index-1]),motion=degree-previous;
      const cost=path.cost+Math.abs(degree-desired[index])*1.5-Math.log(pitchDistanceWeight(distance,difficulty))+
        (motion===0?1.3:motion*direction<0?.7:0)+noise[degree];
      candidates.push({degrees:[...path.degrees,degree],cost});
    }
    candidates.sort((a,b)=>a.cost-b.cost);beam=candidates.slice(0,12);
    if(!beam.length)return;
  }
  return {degrees:beam[Math.floor(random()*Math.min(4,beam.length))].degrees,route};
}

function stretch(points:readonly number[],position:number) {
  const p=Math.max(0,Math.min(1,position))*(points.length-1),i=Math.floor(p);
  return points[i]+(points[Math.min(i+1,points.length-1)]-points[i])*(p-i);
}

/** The opening continues from the theme's interval tail through its barline.
 * Later phrases stretch/turn that material over a longer span; only complete
 * phrase releases are cadence targets, not every two-bar unit. */
export function continuationTargets(measures:MeasureData[],pitches:ScalePitch[],tonality:Tonality,difficulty:Difficulty,
  phrases:readonly PhraseSpan[],harmony:readonly HarmonyBar[]):DialogueTarget[]|undefined {
  if(measures.length<8||measures.length%2||pitches.length<5||tonality.tonic===null)return;
  const slots=measures.flatMap((bar,b)=>bar.events.flatMap(note=>note.rest?[]:[{note,bar:b}]));
  if(slots.length<12)return;
  const random=melodicRandom(slots.map(s=>s.note)),perBar=pulseGroups(measures[0]).length;
  const built=buildContinuationTheme(pitches,tonality,difficulty,perBar*2,random);
  if(!built)return;
  const theme=built.degrees,intervals=theme.slice(1).map((d,i)=>d-theme[i]),intended=new Array<number>(slots.length);
  const center=theme.reduce((sum,n)=>sum+n,0)/theme.length;
  for(const [pi,phrase] of phrases.entries()) {
    const length=(phrase.endBar-phrase.startBar+1)*perBar,final=pi===phrases.length-1;
    const nodes:number[]=[];
    if(pi===0) {
      nodes.push(...theme);
      const tail=intervals.slice(Math.floor(intervals.length/2));
      for(let i=nodes.length;i<length;i++)nodes.push(nodes.at(-1)!-tail[(i-theme.length)%tail.length]);
    } else if(final) {
      const returning=built.route===1?theme.map(n=>center*2-n):theme;
      for(let i=0;i<length;i++)nodes.push(stretch(returning,i/Math.max(1,length-1)));
    } else {
      const tail=intervals.slice(0,Math.max(2,Math.ceil(intervals.length/2))),direction=pi%2?-1:1;
      nodes.push(theme.at(-1)!);
      for(let i=1;i<length;i++)nodes.push(nodes.at(-1)!+tail[(i-1)%tail.length]*direction);
    }
    const members=slots.flatMap((s,i)=>s.bar>=phrase.startBar&&s.bar<=phrase.endBar?[i]:[]);
    for(const index of members) {
      const slot=slots[index],pulse=metricPosition(measures[slot.bar],slot.note.startUnits);
      const at=(slot.bar-phrase.startBar)*perBar+pulse.group,to=nodes[Math.min(at+1,nodes.length-1)];
      const phase=pulse.offset/pulse.units;
      intended[index]=nodes[at]+(to-nodes[at])*phase;
    }
    if(!members.length)continue;
    const low=Math.min(...members.map(i=>intended[i])),high=Math.max(...members.map(i=>intended[i]));
    if(high-low>pitches.length-1)return;
    const fits=Array.from({length:Math.max(0,Math.floor(pitches.length-1-high)-Math.ceil(-low)+1)},(_,i)=>Math.ceil(-low)+i)
      .filter(shift=>pi>0||[0,3,4,7].includes(mod(pitches[Math.round(intended[members[0]]+shift)].midi-pitchClass(tonality.tonic!))))
      .sort((a,b)=>Math.abs(a)-Math.abs(b));
    if(!fits.length)return;
    const shift=fits[0];
    members.forEach(i=>{intended[i]+=shift;});
  }
  const targets:DialogueTarget[]=slots.map((slot,index)=>{
    const degree=Math.round(intended[index]),strong=metricPosition(measures[slot.bar],slot.note.startUnits).onPulse;
    return {index,midi:pitches[degree].midi,weight:strong?4.8:3.3,preferredStep:index?degree-Math.round(intended[index-1]):undefined,
      stepWeight:{beginner:2.4,intermediate:2,advanced:1.7}[difficulty]};
  });
  const near=(pc:number,midi:number)=>pitches.filter(p=>p.midi%12===pc).sort((a,b)=>Math.abs(a.midi-midi)-Math.abs(b.midi-midi))[0];
  const root=pitchClass(tonality.tonic);
  targets[0]={...targets[0],fixed:true};
  for(const phrase of phrases) {
    const last=slots.findLastIndex(s=>s.bar<=phrase.endBar);if(last<1)continue;
    const final=last===slots.length-1,release=near(final?root:harmony[phrase.endBar]?.root??root,targets[last].midi);
    if(!release)continue;
    targets[last]={index:last,midi:release.midi,weight:7,fixed:final};
    if(final) {
      const home=pitches.indexOf(release),neighbors=[home-1,home+1].filter(i=>pitches[i]&&Math.abs(pitches[i].midi-release.midi)<=3);
      const approach=neighbors[Math.floor(random()*neighbors.length)];
      if(approach!==undefined)targets[last-1]={index:last-1,midi:pitches[approach].midi,weight:6,fixed:true};
    }
  }
  return targets;
}
