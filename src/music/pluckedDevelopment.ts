import {TIME_SIGNATURES,type Difficulty,type GeneratedNote,type MeasureData,type PracticeOptions,type VexDuration} from '../music';
import {INSTRUMENTS,type Instrument} from './instruments';
import type {MusicalIntent} from './musicalIntent';
import type {RhythmBarPlan} from './phraseRhythm';
import {pulseGroups,metricPosition} from './meterFeel';
import {addRhythmUnits} from './rhythmTiming';
import {describeTonality} from './scales';
import {planPhraseHarmony} from './phraseHarmony';
import {phraseDirectedHarmony} from './motivicStudy';

const operations=['present','sequence','invert','fragment','tail','return'] as const;
type Operation=typeof operations[number];
interface Idea {start:number;end:number;operation:Operation;shift:number;phase:number}
export interface PluckedDevelopment {
  version:1;
  outline:number[][];
  ideas:Idea[];
  tail:number[];
  width:number;
  palette:Record<number,number[][]>;
  delayed:boolean;
  hold:number;
}
const pick=(random:()=>number,count:number)=>Math.min(count-1,Math.floor(random()*count));
export function isPluckedProfile(instrument?:string){
  return instrument==='Guitar'||instrument==='Bass Guitar'||INSTRUMENTS[instrument as Instrument]?.family==='國樂・彈撥';
}
export function validPluckedDevelopment(value:unknown):value is PluckedDevelopment|undefined{
  if(value===undefined)return true;
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const v=value as PluckedDevelopment;
  if(v.version!==1||!Number.isFinite(v.width)||v.width<.7||v.width>1.3||typeof v.delayed!=='boolean'||![4,6,8,12].includes(v.hold)||
    !Array.isArray(v.tail)||v.tail.length<3||v.tail.length>8||!v.tail.every(n=>Number.isInteger(n)&&Math.abs(n)<=8)||
    !Array.isArray(v.outline)||v.outline.length<4||v.outline.length>6||v.outline[0]?.[0]!==0||v.outline.at(-1)?.[0]!==1||
    !v.outline.every((p,i)=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&p[0]>=0&&p[0]<=1&&p[1]>=0&&p[1]<=1&&(i===0||p[0]>v.outline[i-1][0]))||
    !Array.isArray(v.ideas)||!v.ideas.length||v.ideas.length>128)return false;
  let previous=0;
  for(const idea of v.ideas){
    if(!idea||!operations.includes(idea.operation)||idea.start!==previous||!Number.isInteger(idea.end)||idea.end<=idea.start||idea.end>128||
      !Number.isInteger(idea.shift)||Math.abs(idea.shift)>2||!Number.isInteger(idea.phase)||idea.phase<0||idea.phase>7)return false;
    previous=idea.end;
  }
  return !!v.palette&&[4,6].every(pulse=>Array.isArray(v.palette[pulse])&&v.palette[pulse].length>=2&&v.palette[pulse].length<=5&&
    v.palette[pulse].every(cell=>Array.isArray(cell)&&cell.length>0&&cell.every(n=>[1,2,3,4,6].includes(n))&&cell.reduce((s,n)=>s+n,0)===pulse));
}

/** Build a new short motive from interval tendencies. There is no catalogue of
 * complete melodies; its answer and later fragments retain that one identity. */
function motive(random:()=>number,instrument?:string):number[]{
  const singing=['Daruan','Zhongruan','Guzheng','Guitar'].includes(instrument??'');
  const length=(singing?4:3)+pick(random,4),notes=[0];let direction=random()<.5?1:-1;
  for(let i=1;i<length;i++){
    if(random()<.28||i>length/2&&notes.at(-1)!*direction>2)direction*=-1;
    const draw=random(),step=draw<.72?1:draw<.96?2:3;
    if(Math.abs(notes.at(-1)!+direction*step)>4)direction*=-1;
    notes.push(notes.at(-1)!+direction*step);
  }
  return notes;
}

/** Merge small durations inside one real pulse. Grade controls density; the
 * selected instrument and pitch grade never remove its subdivision work. */
function pulseCell(pulse:number,level:PracticeOptions['rhythmLevel'],random:()=>number):number[]{
  if(level==='simple')return pulse===4?(random()<.7?[4]:[2,2]):random()<.55?[6]:random()<.5?[2,4]:[4,2];
  const draw=random();
  const count=level==='complex'?draw<.8?pulse:pulse-1:
    pulse===4?draw<.48?2:draw<.95?3:1:draw<.58?3:draw<.96?4:2;
  const cell=Array(pulse).fill(1);
  while(cell.length>count){
    const joins=cell.flatMap((n,i)=>i<cell.length-1&&[2,3,4,6].includes(n+cell[i+1])?[i]:[]);
    if(!joins.length)break;
    const at=joins[pick(random,joins.length)];cell.splice(at,2,cell[at]+cell[at+1]);
  }
  if(level==='medium'&&pulse===6&&cell.length===2&&cell.every(n=>n===3))return[2,2,2];
  return cell;
}
function written(units:number):{duration:VexDuration;dots:number}{
  if(units===12)return{duration:'h',dots:1};if(units===8)return{duration:'h',dots:0};
  if(units===6)return{duration:'q',dots:1};if(units===4)return{duration:'q',dots:0};
  return{duration:units===1?'16':'8',dots:units===3?1:0};
}

function planRhythm(o:PracticeOptions,material:PluckedDevelopment,random:()=>number):RhythmBarPlan[]{
  const groups=pulseGroups({timeSignature:o.timeSignature,groups:TIME_SIGNATURES[o.timeSignature].groups});
  const count=groups.length;
  const triplet=o.timeSignature.endsWith('/4')&&o.rhythmLevel!=='simple'&&random()<.4?1+pick(random,o.measures-2):-1;
  return Array.from({length:o.measures},(_,bar)=>{
    const final=bar===o.measures-1;
    const cells=groups.map((pulse,g)=>{
      const at=bar*count+g,idea=material.ideas.find(i=>at>=i.start&&at<i.end)!;
      const palette=material.palette[pulse],position=at-idea.start;
      const index=(idea.operation==='invert'?palette.length-1-position:position)+idea.phase;
      const source=palette[(index%palette.length+palette.length)%palette.length];
      let cell=random()<.7?[...source]:pulseCell(pulse,o.rhythmLevel,random);
      if(idea.operation==='tail'&&position>=idea.end-idea.start-1||idea.operation==='invert')cell.reverse();
      // The continuation can fragment the motive while retaining its tier.
      if(o.rhythmLevel==='complex'&&idea.operation==='fragment'&&random()<.55)cell=Array(pulse).fill(1);
      if(final&&g===groups.length-1)cell=[pulse];
      return cell;
    });
    if(bar===0&&o.rhythmLevel!=='complex'&&material.hold>=8&&random()<.24&&groups[0]===4&&groups[1]===4)cells.splice(0,2,[8]);
    if(bar===triplet)cells[0]=[4/3,4/3,4/3];
    if(final&&o.timeSignature==='4/4')cells.splice(cells.length-material.hold/4,material.hold/4,[material.hold]);
    if(final&&o.timeSignature==='3/8')cells.splice(0,cells.length,[2,4]);
    let position=0,restUnits=0;
    const flat=cells.flat();
    return{meter:o.timeSignature,notes:flat.map((units,index)=>{
      const startUnits=position;position=addRhythmUnits(position,units);
      const entrance=bar===0&&index===0&&material.delayed&&units<=2;
      const rest=entrance||!final&&o.rhythmLevel==='complex'&&bar%2===1&&restUnits===0&&index>0&&units===1&&startUnits>0&&random()<.045;
      if(rest)restUnits+=units;
      return{...written(units),units,startUnits,rest,...(units===4/3?{tuplet:3 as const}:{})};
    })};
  });
}

export function developPluckedIntent(intent:MusicalIntent,o:PracticeOptions,random:()=>number):MusicalIntent{
  const theme=motive(random,o.instrumentProfile),tail=[...theme];
  tail[tail.length-1]=Math.max(-4,Math.min(4,tail.at(-1)!+(random()<.5?1:-1)));
  const knots=4+pick(random,3);
  const outline=Array.from({length:knots},(_,i)=>[i===0?0:i===knots-1?1:(i+(random()-.5)*.35)/(knots-1),i===0?.1+random()*.55:i===knots-1?.15+random()*.25:.15+random()*.7]);
  outline[1+pick(random,knots-2)][1]=1;
  if(random()<.2)outline[0][1]=1;
  const groups=pulseGroups({timeSignature:o.timeSignature,groups:TIME_SIGNATURES[o.timeSignature].groups}),totalPulses=groups.length*o.measures;
  const broad=['Daruan','Zhongruan','Guzheng'].includes(o.instrumentProfile??''),baseLength=(broad?3:2)+pick(random,4);
  const ideas:Idea[]=[];let start=0;
  while(start<totalPulses){
    const remaining=totalPulses-start,progress=start/totalPulses;
    const operation:Operation=start===0?'present':remaining<=baseLength+1?'return':
      (['sequence','tail','invert',...(progress>.35?['fragment']:[])] as Operation[])[pick(random,progress>.35?4:3)];
    const length=operation==='return'?remaining:Math.min(remaining,operation==='fragment'?Math.max(1,Math.floor(baseLength/2)):baseLength+pick(random,3)-1);
    ideas.push({start,end:start+length,operation,shift:operation==='present'||operation==='return'?0:pick(random,5)-2,phase:operation==='present'?0:pick(random,8)});start+=length;
  }
  const palette:Record<number,number[][]>={};
  for(const pulse of [4,6]){
    palette[pulse]=Array.from({length:2+pick(random,4)},()=>pulseCell(pulse,o.rhythmLevel,random));
    // Recalled vocabulary amplifies even a rare easy cell. Reserve enough
    // subdivision work before its repetitions, fresh connectors and cadence.
    if(o.rhythmLevel==='complex'){
      const shortShare=()=>palette[pulse].flat().filter(n=>n===1).length/palette[pulse].flat().length;
      for(let i=0;shortShare()<.88&&i<palette[pulse].length;i++)
        if(palette[pulse][i].some(n=>n>1))palette[pulse][i]=Array(pulse).fill(1);
    }
  }
  const hold=o.timeSignature==='4/4'?(o.rhythmLevel==='simple'?[8,12]:o.rhythmLevel==='complex'?[4,4,4,8]:[4,8,8,12])[pick(random,o.rhythmLevel==='simple'?2:4)]:groups.at(-1)!;
  const material:PluckedDevelopment={version:1,outline,ideas,tail,width:.8+random()*.35,palette,delayed:random()<.2,hold};
  const tonality=describeTonality(o.tonic??o.keySignature,o.scaleId??'major');
  const harmony=phraseDirectedHarmony(planPhraseHarmony(tonality,Array(o.measures).fill(o.timeSignature),Math.floor(random()*0x100000000)),intent.phrases,tonality);
  const peak=outline.reduce((best,p)=>p[1]>best[1]?p:best)[0];
  const result={...intent,motif:theme,harmony,longLine:{...intent.longLine!,material},phrases:intent.phrases.map(p=>({...p,peak:Math.max(.15,Math.min(.85,peak))}))};
  result.rhythm=planRhythm(o,material,random);return result;
}

function interpolate(points:readonly number[][],time:number){
  for(let i=1;i<points.length;i++)if(time<=points[i][0]){
    const [x,a]=points[i-1],[y,b]=points[i];return a+(b-a)*(time-x)/(y-x);
  }
  return points.at(-1)![1];
}
/** A motive lives for a variable number of pulses across barlines. Its later
 * returns transform the same material; no five-note loop restarts every2bars. */
export function pluckedPitchOffsets(slots:readonly {n:GeneratedNote;bar:number}[],measures:readonly MeasureData[],theme:readonly number[],material:PluckedDevelopment,span:number,difficulty:Difficulty):number[]{
  let total=0;const offsets=measures.map(bar=>{const offset=total;total+=pulseGroups(bar).length;return offset;});
  const counts=new Map<Idea,number>();
  return slots.map(({n,bar})=>{
    const metric=metricPosition(measures[bar],n.startUnits),pulse=offsets[bar]+metric.group+metric.offset/metric.units;
    const idea=material.ideas.find(i=>pulse>=i.start&&pulse<i.end)??material.ideas.at(-1)!;
    const ordinal=counts.get(idea)??0;counts.set(idea,ordinal+1);
    const cell=idea.operation==='fragment'?theme.slice(0,Math.max(2,theme.length-2)):idea.operation==='tail'?material.tail:theme;
    let figure=cell[ordinal%cell.length];
    if(idea.operation==='invert')figure=-figure;
    // Repeated cells retain their recognizable head but vary the tail/sequence.
    const cycle=Math.floor(ordinal/cell.length);
    if(cycle>0&&ordinal%cell.length===cell.length-1)figure=(figure+material.tail[(cycle+idea.phase)%material.tail.length])/2;
    const shift=idea.shift+(cycle%3===2?(idea.shift<0?-.5:.5):0);
    return interpolate(material.outline,pulse/total)*span*material.width+(figure+shift)*(difficulty==='beginner'?.8:1);
  });
}
