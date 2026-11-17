import {TIME_SIGNATURES,type ExerciseData,type PitchRange,type PracticeOptions,type VexDuration} from '../music';
import {planMusicalIntent,supportsMusicalIntent,type IntentPhrase,type MusicalIntent} from './musicalIntent';
import {isPluckedProfile} from './pluckedDevelopment';import {pulseGroups,metricPosition} from './meterFeel';
import {describeTonality,buildPitchMaterial,pitchClass} from './scales';import {planPhraseHarmony} from './phraseHarmony';
import {phraseDirectedHarmony,type MotivicTarget} from './motivicStudy';import type {RhythmBarPlan} from './phraseRhythm';
import {realizeContrast} from './contrastStudy';import {addRhythmUnits} from './rhythmTiming';

interface Cell {units:number;rest:boolean}
interface Character {short:number;dot:number;hold:number;space:number}
interface PhraseCharacter {material:0|1;transform:'repeat'|'mirror'|'sequence'|'fragment';register:number;offset:number}
export type PhraseStudyFocus='melody'|'rhythm'|'combined';
export interface PluckedPhraseDesign {primary:number[];reply:number[];phrases:PhraseCharacter[];character:Character;basicBars:number;focus:PhraseStudyFocus;rangeUse:number;position:number;gestureWidth:number}
export interface PluckedPhrasePlan {intent:MusicalIntent;design:PluckedPhraseDesign}
const pick=(random:()=>number,count:number)=>Math.min(count-1,Math.floor(random()*count));
const mod=(n:number,m:number)=>(n%m+m)%m;

function phraseLayout(length:number,random:()=>number):IntentPhrase[]{
  const result:IntentPhrase[]=[];let start=0;
  while(start<length){
    const remaining=length-start;
    const count=remaining<=5&&start>0?remaining:Math.min(remaining,2+pick(random,Math.min(3,remaining-3)));
    const last=start+count===length,index=result.length;
    result.push({startBar:start,endBar:start+count-1,role:index===0?'opening':last?'closing':index%2?'answer':'development',
      cadence:last?'home':'open',gesture:index===0?'present':last&&random()<.5?'return':index%2?'answer':'extend',peak:.25+random()*.5});
    start+=count;
  }
  return result;
}
function written(units:number):{duration:VexDuration;dots:number}{
  if(units===12)return{duration:'h',dots:1};if(units===8)return{duration:'h',dots:0};
  if(units===6)return{duration:'q',dots:1};if(units===4)return{duration:'q',dots:0};
  return{duration:units===1?'16':'8',dots:units===3?1:0};
}
function pulse(pulse:number,o:PracticeOptions,c:Character,random:()=>number):Cell[]{
  const plain=(units:number)=>({units,rest:false});
  if(o.rhythmLevel==='simple')return(random()<c.hold?[pulse]:pulse===4?[2,2]:random()<.5?[2,4]:[4,2]).map(plain);
  if(o.rhythmLevel==='complex'){
    const cells=Array(pulse).fill(1) as number[];
    if(random()<.2+c.dot*.25){const index=pick(random,cells.length-1);cells.splice(index,2,2);}
    return cells.map((units,i)=>({units,rest:units===1&&i===0&&random()<c.space*.2}));
  }
  const cells:Cell[]=[];let remaining=pulse;
  while(remaining){
    const choices=[1,2,3,4,6].filter(n=>n<=remaining),weights=choices.map(n=>n===1?.08+c.short*.8:n===2?.8:n===3?c.dot:n===4?c.hold*.8:c.hold*.55);
    let draw=random()*weights.reduce((s,w)=>s+w,0),index=0;while(index<weights.length-1&&(draw-=weights[index])>=0)index++;
    const units=choices[index];cells.push({units,rest:cells.length===0&&units<=2&&random()<c.space*.25});remaining-=units;
  }
  return cells;
}
/** Compose a complete one/two-bar rhythmic idea, then recall it as a unit.
 * Local endings and continuation can interrupt it; not every beat is fresh. */
function rhythmFor(o:PracticeOptions,phrases:IntentPhrase[],characters:PhraseCharacter[],character:Character,basicBars:number,random:()=>number):RhythmBarPlan[]{
  const groups=pulseGroups({timeSignature:o.timeSignature,groups:TIME_SIGNATURES[o.timeSignature].groups});
  const vocabulary=[character,{short:1-character.short,dot:random(),hold:random(),space:random()}].map(c=>
    Array.from({length:basicBars},()=>groups.map(units=>pulse(units,o,c,random))));
  const held=new Set<string>(),bars=Array.from({length:o.measures},(_,bar)=>{
    const index=phrases.findIndex(p=>bar>=p.startBar&&bar<=p.endBar),phrase=phrases[index],design=characters[index],local=bar-phrase.startBar;
    const recalled=vocabulary[design.material][local%basicBars];
    const cells=recalled.map((cell,g)=>{
      let result=cell.map(n=>({...n}));
      if(design.transform==='mirror'&&local>=basicBars)result.reverse();
      if(local>=basicBars&&design.transform==='fragment'&&(local+g)%2===0)result=pulse(groups[g],o,{...character,short:1,hold:0},random);
      if(local>=basicBars&&random()<.22)result=pulse(groups[g],o,character,random);
      return result;
    });
    const last=bar===o.measures-1,landing=bar===phrase.endBar;
    if(landing){
      const at=groups.length-1;
      if(last||o.rhythmLevel!=='complex'||random()<.7){cells[at]=[{units:groups[at],rest:false}];held.add(`${bar}/${at}`);}
      if(!last&&o.rhythmLevel!=='complex'&&random()<character.space){
        const units=groups[at];cells[at]=[{units:units-2,rest:false},{units:2,rest:true}];
      }
    }
    if(bar===0&&random()<.55){
      const units=groups[0];
      if(o.rhythmLevel==='simple')cells[0]=[{units:2,rest:true},{units:units-2,rest:false}];
      else if(o.rhythmLevel==='medium'&&random()<.5){const lead=units===6?4:units-1;cells[0]=[{units:lead,rest:true},{units:units-lead,rest:false}];}
      else cells[0][0].rest=true;
    }
    return cells;
  });
  // A few expressive holds must not lower the requested complex tier. Repair
  // ordinary cells before pitch generation, preserving the final landing and
  // one interior held gesture; a dense section can contrast with that hold.
  if(o.rhythmLevel==='complex'){
    const stats=()=>{const n=bars.flat(2).filter(n=>!n.rest);return{count:n.length,share:n.filter(n=>n.units<=1).length/Math.max(1,n.length)};};
    const minimum=Math.floor(o.measures*groups.reduce((s,n)=>s+n,0)*.8);
    const protectedHold=[...held].find(key=>!key.startsWith(`${o.measures-1}/`));
    const candidates=bars.flatMap((cells,b)=>cells.flatMap((cell,g)=>!held.has(`${b}/${g}`)&&cell.some(n=>n.units>1||n.rest)?[{b,g}]:[]));
    candidates.push(...bars.flatMap((cells,b)=>cells.flatMap((_,g)=>held.has(`${b}/${g}`)&&`${b}/${g}`!==protectedHold&&b!==o.measures-1?[{b,g}]:[])));
    for(const {b,g}of candidates){if(stats().count>=minimum&&stats().share>=.8)break;bars[b][g]=Array.from({length:groups[g]},()=>({units:1,rest:false}));}
  }
  return bars.map(cells=>{let position=0;return{meter:o.timeSignature,notes:cells.flat().map(n=>{const startUnits=position;position=addRhythmUnits(position,n.units);return{...written(n.units),...n,startUnits};})};});
}

/** One basic idea can contain a whole bar/two bars of pitches. Its interval
 * tendencies, repeated tones and turning points are chosen once per study. */
function melodicIdea(rhythm:RhythmBarPlan['notes'],focus:PhraseStudyFocus,random:()=>number):number[]{
  const attacks=rhythm.filter(n=>!n.rest),length=Math.max(4,attacks.length);
  const notes=[0],repeated=.05+random()*(focus==='rhythm'?.3:.15),leaping=.1+random()*.5,limit=3+pick(random,4);let direction=random()<.5?1:-1;
  for(let i=1;i<length;i++){
    const last=notes.at(-1)!;
    if(random()<.15||Math.abs(last)>=limit)direction*=-1;
    // The duration of this actual attack shapes its melodic role. Rapid notes
    // connect by step; a held arrival can accept a recovered expressive leap.
    const duration=attacks[i%attacks.length]?.units??2,previous=attacks[(i-1)%attacks.length]?.units??2;
    const leapChance=leaping*(duration<=1?.25:duration>=4?1.3:1);
    let step=random()<repeated?0:direction*(random()<leapChance?2+pick(random,2):1);
    if(previous>=4&&duration<=1)step=direction;
    if(i>2&&last===notes.at(-2)&&last===notes.at(-3))step=direction;
    if(Math.abs(last+step)>limit)step=-Math.sign(last||step);
    notes.push(last+step);
  }
  return notes;
}

export function planPluckedPhraseStudy(o:PracticeOptions,random:()=>number=Math.random,focusOverride?:PhraseStudyFocus):PluckedPhrasePlan{
  if(!supportsMusicalIntent(o)||!isPluckedProfile(o.instrumentProfile))throw Error('此獨立候選供一般彈撥樂器設定比較');
  const drawnFocus:PhraseStudyFocus=(['melody','rhythm','combined'] as const)[pick(random,3)],focus=focusOverride??drawnFocus;
  const base=planMusicalIntent(o,random),phrases=phraseLayout(o.measures,random),basicBars=random()<(focus==='rhythm'?.35:.8)?2:1;
  const activity=random(),dotted=random(),sustain=random();
  const character:Character={short:focus==='rhythm'?.45+activity*.55:focus==='melody'?activity*.45:activity,
    dot:focus==='melody'?dotted*.55:focus==='rhythm'?.45+dotted*.55:.2+dotted*.6,
    hold:focus==='melody'?.6+sustain*.4:focus==='rhythm'?.05+sustain*.2:.3+sustain*.25,space:.25+random()*.65};
  const initialRegister=random()<.5?.05+random()*.15:.8+random()*.15,characters:PhraseCharacter[]=phrases.map((_,index)=>({material:index===0?0:random()<.5?0:1,
    transform:index===0?'repeat':(['repeat','mirror','sequence','fragment'] as const)[pick(random,4)],
    register:index===0?initialRegister:index%2?1-initialRegister:.2+random()*.6,offset:index===0?0:pick(random,3)-1}));
  const rhythm=rhythmFor(o,phrases,characters,character,basicBars,random);
  const sourceRhythm=rhythm.slice(0,basicBars).flatMap(b=>b.notes),primary=melodicIdea(sourceRhythm,focus,random),reply=melodicIdea([...sourceRhythm].reverse(),focus,random);
  const tonality=describeTonality(o.tonic??o.keySignature,o.scaleId??'major'),rawHarmony=planPhraseHarmony(tonality,Array(o.measures).fill(o.timeSignature),Math.floor(random()*0x100000000));
  // A repeated rhythmic idea may sit on one harmony for two bars. Phrase
  // direction restores real modal/functional arrivals after that prolongation.
  const paced=rawHarmony.map((h,bar)=>focus==='rhythm'&&bar%2===1&&bar<o.measures-2?rawHarmony[bar-1]:h);
  const harmony=phraseDirectedHarmony(paced,phrases,tonality);
  const intent:MusicalIntent={...base,phrases,harmony,rhythm,motif:primary.slice(0,Math.min(8,primary.length)).map(n=>Math.max(-8,Math.min(8,n)))};
  return{intent,design:{primary,reply,phrases:characters,character,basicBars,focus,rangeUse:.65+random()*.3,position:random(),gestureWidth:.35+random()*.25}};
}

export function pluckedPhraseTargets(ex:ExerciseData,range:PitchRange,intent:MusicalIntent,design:PluckedPhraseDesign):MotivicTarget[]{
  const tonality=ex.tonality??describeTonality(ex.keySignature,'major'),pitches=buildPitchMaterial(tonality,ex.grandMode==='two-hand'?{min:60,max:range.max}:range).pitches;
  if(!pitches.length)return[];
  const melody=ex.grandMode==='mono'&&ex.lowerMeasures?ex.measures.map((b,bar)=>({...b,events:b.events.map((n,i)=>n.rest?ex.lowerMeasures![bar].events[i]:n)})):ex.measures;
  const slots=melody.flatMap((m,bar)=>m.events.filter(n=>!n.rest).map(n=>({n,bar}))),available=pitches.length-1;
  // Total tessitura is independent of the adjacent-leap grade. Let a piece
  // travel through low/middle/high registers inside the user's chosen range;
  // the existing path solver still enforces every graded interval and run.
  const globalSpan=Math.min(available,20,Math.max(4,available*design.rangeUse));
  const span=Math.min(globalSpan,Math.max(3,globalSpan*design.gestureWidth)),lowFrame=(available-globalSpan)*design.position,counts=new Map<number,number>();
  const degrees=slots.map(({n,bar})=>{
    const index=intent.phrases.findIndex(p=>bar>=p.startBar&&bar<=p.endBar),phrase=intent.phrases[index],part=design.phrases[index],idea=part.material?design.reply:design.primary;
    const ordinal=counts.get(index)??0;counts.set(index,ordinal+1);const cycle=Math.floor(ordinal/idea.length),fragment=part.transform==='fragment'&&cycle>0;
    const at=fragment?mod(ordinal,Math.max(3,Math.floor(idea.length/3))):mod(ordinal,idea.length);
    let figure=idea[at];if(part.transform==='mirror')figure=-figure;
    const low=Math.min(...idea),high=Math.max(...idea),width=Math.max(1,high-low);
    const elapsed=bar-phrase.startBar+n.startUnits/ex.measures[bar].totalUnits;
    const prior=design.phrases[Math.max(0,index-1)].register,blend=index===0?1:Math.min(1,elapsed/.75);
    const register=prior+(part.register-prior)*blend,center=lowFrame+span/2+register*Math.max(0,globalSpan-span);
    const centered=part.transform==='mirror'?figure+(high+low)/2:figure-(high+low)/2;
    let degree=center+centered*span/width+part.offset+(part.transform==='sequence'?cycle:0);
    // Keep a recurring melody's identity even on weak beats. Harmony gives
    // only local gravity; it does not turn every pulse into an arpeggio.
    const metric=metricPosition(ex.measures[bar],n.startUnits,ex.timeSignature);
    if(metric.downbeat&&bar===phrase.startBar||n.durationUnits>=4){const chord=intent.harmony[bar];const nearby=pitches.flatMap((p,i)=>chord.pitches.includes(p.midi%12)&&Math.abs(i-degree)<=2?[i]:[]);degree=nearby.sort((a,b)=>Math.abs(a-degree)-Math.abs(b-degree))[0]??degree;}
    return Math.max(0,Math.min(available,Math.round(degree)));
  });
  const guide:MotivicTarget[]=degrees.map((degree,index)=>({index,midi:pitches[degree].midi,weight:9,
    ...(index?{preferredStep:Math.max(-3,Math.min(3,degree-degrees[index-1])),stepWeight:1.5}:{})}));
  const root=pitchClass(tonality.tonic!);
  for(const phrase of intent.phrases){
    const end=slots.findLastIndex(s=>s.bar<=phrase.endBar);if(end<0)continue;
    const pc=phrase.cadence==='home'?root:intent.harmony[phrase.endBar].root;
    const lands=pitches.flatMap((p,i)=>p.midi%12===pc?[i]:[]).sort((a,b)=>Math.abs(a-degrees[end])-Math.abs(b-degrees[end]));if(!lands.length)continue;
    const landing=lands[0];guide[end]={index:end,midi:pitches[landing].midi,weight:48};
    const neighbors=[landing-1,landing+1].filter(i=>pitches[i]&&Math.abs(pitches[i].midi-pitches[landing].midi)<=3);
    if(end>0&&neighbors.length){const approach=neighbors.sort((a,b)=>Math.abs(a-degrees[end-1])-Math.abs(b-degrees[end-1]))[0];guide[end-1]={index:end-1,midi:pitches[approach].midi,weight:30};}
  }
  return guide;
}

/** Human-selected B engine; automaticPlucked combines it with preserved A. */
export function composePluckedPhraseStudy(options:PracticeOptions,grandMode?:'mono'|'two-hand',focusOverride?:PhraseStudyFocus):ExerciseData{
  const {intent,design}=planPluckedPhraseStudy(options,Math.random,focusOverride);
  return realizeContrast(options,'long-line',intent,grandMode,(ex,range,i)=>pluckedPhraseTargets(ex,range,i,design));
}
