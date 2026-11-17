import {TIME_SIGNATURES,type ExerciseData,type PracticeOptions,type PitchRange,type VexDuration} from '../music';
import {planContrastIntent} from './contrastRhythm';
import type {MusicalIntent} from './musicalIntent';
import type {MotivicTarget} from './motivicStudy';
import type {RhythmBarPlan} from './phraseRhythm';
import {pulseGroups,metricPosition} from './meterFeel';
import {describeTonality,buildPitchMaterial,pitchClass} from './scales';
import {addRhythmUnits} from './rhythmTiming';
import {developPluckedIntent,isPluckedProfile,pluckedPitchOffsets,validPluckedDevelopment,type PluckedDevelopment} from './pluckedDevelopment';

export const LONG_LINE_SHAPES=['early-arch','late-arch','falling','valley','wave','rising-return'] as const;
export interface LongLineDevelopment {
  shape:typeof LONG_LINE_SHAPES[number];
  entrance:number;
  rhythm:number;
  cadence:number;
  register:number;
  material?:PluckedDevelopment;
}
export function validLongLineDevelopment(value:unknown):value is LongLineDevelopment|undefined{
  if(value===undefined)return true;
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const v=value as Record<string,unknown>;
  return validPluckedDevelopment(v.material)&&LONG_LINE_SHAPES.includes(v.shape as LongLineDevelopment['shape'])&&
    [['entrance',5],['rhythm',24],['cadence',4],['register',3]].every(([key,count])=>
      Number.isInteger(v[key])&&Number(v[key])>=0&&Number(v[key])<Number(count));
}
const curves:Record<LongLineDevelopment['shape'],number[][]>={
  'early-arch':[[0,.3],[.2,1],[.42,.6],[.65,.35],[.82,.5],[1,.2]],
  'late-arch':[[0,.2],[.3,.35],[.5,.55],[.72,1],[.88,.6],[1,.25]],
  falling:[[0,.85],[.2,.65],[.45,.5],[.65,.3],[.82,.4],[1,.15]],
  valley:[[0,.7],[.22,.35],[.45,0],[.66,.5],[.82,.75],[1,.4]],
  wave:[[0,.35],[.18,.75],[.38,.3],[.59,.85],[.78,.45],[1,.25]],
  'rising-return':[[0,.15],[.25,.3],[.45,.6],[.64,.85],[.8,.55],[1,.15]],
};
const themes=[[0,1,3,2,0],[0,-1,-3,-1,1],[0,2,1,-1,0],[0,-2,0,1,-1],[0,1,-1,2,0],[0,-1,1,3,1]];
const mod=(n:number,m=12)=>(n%m+m)%m;
const choose=(random:()=>number,count:number)=>Math.min(count-1,Math.floor(random()*count));
function interpolate(points:readonly number[][],time:number){
  for(let i=1;i<points.length;i++)if(time<=points[i][0]){
    const [x,a]=points[i-1],[y,b]=points[i];return a+(b-a)*(time-x)/(y-x);
  }
  return points.at(-1)![1];
}
function written(units:number):{duration:VexDuration;dots:number}{
  if(units===16)return{duration:'w',dots:0};
  if(units===12)return{duration:'h',dots:1};
  if(units===8)return{duration:'h',dots:0};
  if(units===6)return{duration:'q',dots:1};
  if(units===4)return{duration:'q',dots:0};
  if(units===3)return{duration:'8',dots:1};
  return{duration:units===1?'16':'8',dots:0};
}
const simple:Record<number,number[][]>={4:[[4],[2,2],[4],[4]],6:[[6],[2,4],[6],[4,2]]};
const medium:Record<number,number[][]>={
  4:[[2,2],[3,1],[2,1,1],[1,1,2],[2,2],[4],[2,2],[3,1]],
  6:[[2,2,2],[4,2],[2,1,1,2],[2,2,2],[2,4],[1,1,2,2],[2,3,1],[3,1,2]],
};
const complex:Record<number,number[][]>={
  4:[[1,1,1,1],[1,2,1],[1,1,1,1],[1,1,2],[1,1,1,1],[2,1,1],[1,1,1,1],[1,1,1,1]],
  6:[[1,1,1,1,1,1],[1,1,2,1,1],[1,1,1,1,1,1],[1,1,1,1,1,1],[1,1,1,1,1,1],[1,1,1,1,1,1],[1,1,1,1,1,1],[1,1,1,1,2]],
};

/** A two-bar rhythmic idea is recalled, sequenced, then developed. Whole
 * entrances and cadence inventories vary; no grade or instrument chooses them. */
function rhythmFor(o:PracticeOptions,intent:MusicalIntent,design:LongLineDevelopment):RhythmBarPlan[]{
  const groups=pulseGroups({timeSignature:o.timeSignature,groups:TIME_SIGNATURES[o.timeSignature].groups});
  const book=o.rhythmLevel==='simple'?simple:o.rhythmLevel==='medium'?medium:complex;
  return Array.from({length:o.measures},(_,bar)=>{
    const phrase=intent.phrases.find(p=>bar>=p.startBar&&bar<=p.endBar)!;
    const local=bar-phrase.startBar,length=phrase.endBar-phrase.startBar+1,final=bar===o.measures-1,landing=bar===phrase.endBar;
    const development=local>=Math.ceil(length*.4)&&local<length-2,block=Math.floor(local/2);
    const cells=groups.map((pulse,g)=>{
      // Two different bars establish one motif. Development changes selected
      // cells, rather than making the middle of every study all sixteenths.
      const index=design.rhythm+(local%2)*3+g*(1+design.rhythm%3)+(block===0?0:block===1?1:block+2);
      let cell=[...(book[pulse]?.[index%book[pulse].length]??[pulse])];
      if(development&&o.rhythmLevel==='complex'&&(g+design.rhythm+local)%3!==0)cell=Array(pulse).fill(1);
      if(landing&&g===groups.length-1)cell=[pulse];
      return cell;
    });
    if(local===0&&!landing){
      const pulse=groups[0];
      if(design.entrance===0){
        cells[0]=[pulse];
        if(o.rhythmLevel!=='complex'&&pulse===4&&groups[1]===4)cells.splice(0,2,[8]);
      }else if(design.entrance===1)cells[0]=pulse===6?[2,2,2]:o.rhythmLevel==='simple'?[2,2]:[2,1,1];
      else if(design.entrance===2)cells[0]=o.rhythmLevel==='simple'?[pulse]:pulse===6?[4,2]:[3,1];
      else if(design.entrance===3)cells[0]=pulse===6?[2,4]:o.rhythmLevel==='complex'?[1,1,2]:[2,2];
      else cells[0]=o.rhythmLevel==='simple'?pulse===6?[4,2]:[2,2]:pulse===6?[1,1,2,2]:[1,2,1];
    }
    if(o.rhythmLevel!=='simple'&&o.timeSignature.endsWith('/4')&&groups.includes(4)&&design.rhythm%3===2&&bar===1+design.rhythm%2&&!landing){
      const at=groups.indexOf(4);cells[at]=[4/3,4/3,4/3];
    }
    if(final&&o.timeSignature==='4/4'){
      const endings=o.rhythmLevel==='complex'?
        [[[1,1,2],[2,2],[8]],[[3,1],[1,1,2],[8]],[[1,2,1],[4],[8]],[[1,1,1,1],[2,2],[8]]]:
        o.rhythmLevel==='medium'?[[[4],[12]],[[2,2],[4],[8]],[[4],[4],[8]],[[2,1,1],[4],[8]]]:
        [[[4],[4],[8]],[[8],[8]],[[4],[12]],[[2,2],[4],[8]]];
      cells.splice(0,cells.length,...endings[design.cadence]);
    }
    if(final&&o.timeSignature==='3/8')cells.splice(0,cells.length,[2,4]);
    let position=0,gapUnits=0,previousRest=false;
    const flat=cells.flat();
    return{meter:o.timeSignature,notes:flat.map((units,index)=>{
      const startUnits=position;position=addRhythmUnits(position,units);
      const delayed=local===0&&!landing&&design.entrance===3&&index===0;
      const gap=o.rhythmLevel==='complex'&&!final&&bar%2===design.rhythm%2&&index>0&&units===1&&!previousRest&&gapUnits<1&&
        (index+local+design.rhythm)%9===4;
      const rest=delayed||gap;
      if(rest)gapUnits+=units;previousRest=rest;
      return{...written(units),units,startUnits,rest,...(units===4/3?{tuplet:3 as const}:{})};
    })};
  });
}

/** The selected continuous C line remains available unchanged for comparison.
 * New ordinary studies choose a complete development, not a transposed copy. */
export function planLongLineDevelopment(o:PracticeOptions,random:()=>number=Math.random):MusicalIntent{
  const intent=planContrastIntent(o,'long-line',random);
  const design:LongLineDevelopment={shape:LONG_LINE_SHAPES[choose(random,LONG_LINE_SHAPES.length)],entrance:choose(random,5),rhythm:choose(random,24),cadence:choose(random,4),register:choose(random,3)};
  intent.longLine=design;intent.motif=[...themes[choose(random,themes.length)]];
  const peak=curves[design.shape].reduce((a,b)=>b[1]>a[1]?b:a)[0];
  intent.phrases=intent.phrases.map(p=>({...p,peak:Math.max(.15,Math.min(.85,peak))}));
  intent.rhythm=rhythmFor(o,intent,design);
  return isPluckedProfile(o.instrumentProfile??o.instrument)?developPluckedIntent(intent,o,random):intent;
}

/** Fit the entire melodic gesture into the available register before rounding.
 * Clamping every high target separately flattened long stretches at the limit.
 * The existing path solver still enforces all pitch/range/32nd-note constraints. */
export function longLineDevelopmentTargets(ex:ExerciseData,range:PitchRange,intent:MusicalIntent):MotivicTarget[]{
  const design=intent.longLine!;
  const tonality=ex.tonality??describeTonality(ex.keySignature,'major'),root=pitchClass(tonality.tonic!);
  const pitches=buildPitchMaterial(tonality,ex.grandMode==='two-hand'?{min:60,max:range.max}:range).pitches;
  if(!pitches.length)return[];
  const melody=ex.grandMode==='mono'&&ex.lowerMeasures?ex.measures.map((bar,b)=>({...bar,events:bar.events.map((n,i)=>n.rest?ex.lowerMeasures![b].events[i]:n)})):ex.measures;
  const slots=melody.flatMap((m,bar)=>m.events.filter(n=>!n.rest).map(n=>({n,bar})));
  const span=Math.min(pitches.length-1,{beginner:4,intermediate:7,advanced:10}[ex.difficulty]);
  const shape=curves[design.shape],theme=intent.motif;
  const ideaCounts=new Map<string,number>();
  const raw=design.material?pluckedPitchOffsets(slots,ex.measures,theme,design.material,span,ex.difficulty):slots.map(({n,bar})=>{
    const phrase=intent.phrases.find(p=>bar>=p.startBar&&bar<=p.endBar)!;
    const local=bar-phrase.startBar+n.startUnits/ex.measures[bar].totalUnits,progress=local/(phrase.endBar-phrase.startBar+1);
    const block=Math.floor(local/2),key=`${phrase.startBar}/${block}`,ordinal=ideaCounts.get(key)??0;
    ideaCounts.set(key,ordinal+1);
    // A note-level motive supplies real motion within a gently moving arc.
    // Sampling only the slow arc produced many identical rounded targets.
    const figure=theme[ordinal%theme.length],developing=progress>.4&&progress<.8;
    // Sequence and a gentle inversion share the same motive, while the large
    // arc moves through different registers and reaches its peak at a new time.
    const direction=developing&&block%2===0?-1:1;
    return interpolate(shape,progress)*span+figure*direction*(ex.difficulty==='beginner'?.8:1);
  });
  if(!raw.length)return[];
  const min=Math.min(...raw),max=Math.max(...raw),available=pitches.length-1;
  const scale=max>min?Math.min(1,available/(max-min)):1;
  const width=(max-min)*scale;
  const center=['Piano','Yangqin'].includes(ex.soundProfile??ex.instrument)?70:(range.min+range.max)/2;
  const preferred=pitches.reduce((best,p,i)=>Math.abs(p.midi-center)<Math.abs(pitches[best].midi-center)?i:best,0);
  const shift=Math.max(0,Math.min(available-width,preferred-width/2+(design.register-1)*Math.min(2,available/8)));
  const indices=raw.map(value=>Math.round(shift+(value-min)*scale));
  const guide:MotivicTarget[]=indices.map((degree,index)=>{
    const {n,bar}=slots[index],metric=metricPosition(ex.measures[bar],n.startUnits,ex.timeSignature);
    const chord=intent.harmony[bar];
    // Harmony supplies small gravity at the main beat; it no longer replaces
    // every pulse with the same chord anchor and an identical up/down turn.
    if(metric.downbeat){
      const nearby=pitches.flatMap((p,i)=>chord.pitches.includes(p.midi%12)&&Math.abs(i-degree)<=1?[i]:[]);
      degree=nearby.sort((a,b)=>Math.abs(a-degree)-Math.abs(b-degree))[0]??degree;
    }
    return{index,midi:pitches[degree].midi,weight:8};
  });
  const first=indices[0],starts=pitches.flatMap((p,i)=>[0,3,4,7].includes(mod(p.midi-root))?[i]:[]);
  if(starts.length){const start=starts.sort((a,b)=>Math.abs(a-first)-Math.abs(b-first))[0];guide[0]={index:0,midi:pitches[start].midi,weight:18};}
  for(const phrase of intent.phrases){
    const end=slots.findLastIndex(s=>s.bar<=phrase.endBar);if(end<0)continue;
    const pc=phrase.cadence==='home'?root:intent.harmony[phrase.endBar].root;
    const landings=pitches.flatMap((p,i)=>p.midi%12===pc?[i]:[]).sort((a,b)=>Math.abs(a-indices[end])-Math.abs(b-indices[end]));
    if(!landings.length)continue;
    const landing=landings[0];guide[end]={index:end,midi:pitches[landing].midi,weight:48};
    if(end>0&&slots[end-1].bar>=phrase.startBar){
      const neighbors=[landing+1,landing-1].filter(i=>pitches[i]&&Math.abs(pitches[i].midi-pitches[landing].midi)<=3);
      if(neighbors.length){const approach=neighbors.sort((a,b)=>Math.abs(a-indices[end-1])-Math.abs(b-indices[end-1]))[0];guide[end-1]={index:end-1,midi:pitches[approach].midi,weight:30};}
    }
  }
  return guide;
}
