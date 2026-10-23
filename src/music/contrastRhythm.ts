import {TIME_SIGNATURES,type PracticeOptions,type VexDuration} from '../music';
import {describeTonality,pitchClass} from './scales';
import {planMusicalIntent,type MusicalIntent,type IntentPhrase} from './musicalIntent';
import {pulseGroups} from './meterFeel';
import {addRhythmUnits} from './rhythmTiming';
import type {HarmonyBar} from './phraseHarmony';
import type {RhythmBarPlan} from './phraseRhythm';

export type ContrastFamily='dialogue'|'long-line';
const mod=(n:number)=>(n%12+12)%12;
const banks={
  dialogue:{simple:{4:[[4],[2,2]],6:[[6],[2,4],[4,2]]},
    medium:{4:[[3,1],[2,1,1],[2,2],[1,1,2]],6:[[2,1,1,2],[4,2],[2,2,2],[3,1,2]]},
    complex:{4:[[3,1],[1,2,1],[1,1,2],[1,1,1,1]],6:[[3,1,1,1],[1,2,1,1,1],[1,1,2,1,1],[1,1,1,1,2]]}},
  'long-line':{simple:{4:[[4],[4],[2,2]],6:[[6],[6],[2,4]]},
    medium:{4:[[2,2],[1,1,2],[2,1,1],[3,1]],6:[[2,2,2],[1,1,2,2],[2,1,1,2],[2,4]]},
    complex:{4:[[1,1,1,1],[1,1,1,1],[2,1,1],[1,1,1,1]],6:[[1,1,1,1,1,1],[1,1,2,1,1],[1,1,1,1,1,1],[2,1,1,1,1]]}},
};

function written(units:number):{duration:VexDuration;dots:number}{
  if(units===4/3)return{duration:'8',dots:0};
  if(units===12)return{duration:'h',dots:1};
  if(units===8)return{duration:'h',dots:0};
  if(units===6)return{duration:'q',dots:1};
  if(units===4)return{duration:'q',dots:0};
  if(units===3)return{duration:'8',dots:1};
  return{duration:units===2?'8':'16',dots:0};
}

function phrasesFor(bars:number,family:ContrastFamily):IntentPhrase[]{
  const lengths:number[]=[];
  if(family==='dialogue'){
    let remaining=bars;while(remaining){const n=remaining===3?3:Math.min(2,remaining);lengths.push(n);remaining-=n;}
  }else if(bars<=8)lengths.push(bars);
  else lengths.push(Math.ceil(bars*.6),Math.floor(bars*.4));
  let start=0;
  return lengths.map((length,index)=>{
    const last=index===lengths.length-1,home=last||family==='dialogue'&&index%2===1;
    const result:IntentPhrase={startBar:start,endBar:start+length-1,role:last?'closing':index===0?'opening':index%2?'answer':'development',
      cadence:home?'home':'open',gesture:index===0?'present':last?'return':index%2?'answer':'extend',peak:family==='dialogue'?.42:.62};
    start+=length;return result;
  });
}

function rhythmFor(o:PracticeOptions,family:ContrastFamily,phrases:IntentPhrase[],variant:number):RhythmBarPlan[]{
  const groups=pulseGroups({timeSignature:o.timeSignature,groups:TIME_SIGNATURES[o.timeSignature].groups}),total=TIME_SIGNATURES[o.timeSignature].units;
  return Array.from({length:o.measures},(_,bar)=>{
    const p=phrases.find(p=>bar>=p.startBar&&bar<=p.endBar)!,local=bar-p.startBar,landing=bar===p.endBar,final=bar===o.measures-1;
    const developing=family==='dialogue'?bar>=Math.floor(o.measures/2)&&!landing:bar>=Math.floor(o.measures*.35)&&bar<Math.floor(o.measures*.75);
    const cells=groups.map((pulse,g)=>{
      const book=banks[family][o.rhythmLevel] as Record<number,number[][]>;
      let cell=[...(book[pulse]?.[(variant+local+g)%book[pulse].length]??[pulse])];
      if(o.rhythmLevel==='complex'&&developing)cell=Array(pulse).fill(1);
      if(landing&&g===groups.length-1)cell=final?[pulse]:family==='dialogue'&&total>=8?(pulse===4?[2,2]:[2,2,2]):[pulse];
      return cell;
    });
    // These are different complete entrances, not permutations of an equal
    // note-count inventory: a delayed short call versus a sustained launch.
    if(local===0&&!landing){
      if(family==='dialogue'&&total>=8)cells[0]=o.rhythmLevel==='simple'?[2,groups[0]-2]:[2,...Array(groups[0]-2).fill(1)];
      if(family==='long-line'){
        cells[0]=[groups[0]];
        if(o.rhythmLevel!=='complex'&&groups[0]===4&&groups[1]===4)cells.splice(0,2,[8]);
      }
    }
    if(o.rhythmLevel==='complex'&&o.timeSignature.endsWith('/4')&&bar===4&&!landing&&variant%2&&groups[1]===4)cells[1]=[4/3,4/3,4/3];
    if(final&&o.timeSignature==='4/4')cells.splice(0,cells.length,...(o.rhythmLevel==='complex'?
      family==='dialogue'?[[3,1],[1,1,2],[8]]:[[1,1,1,1],[2,2],[8]]:
      family==='dialogue'?[[2,2],[4],[8]]:[[4],[12]]));
    let position=0;
    const flat=cells.flat(),notes=flat.map((units,index)=>{
      const startUnits=position;position=addRhythmUnits(position,units);
      const delayed=family==='dialogue'&&local===0&&!landing&&total>=8&&index===0;
      const breath=family==='dialogue'&&landing&&!final&&total>=8&&index===flat.length-1&&units<=2;
      return{...written(units),units,startUnits,rest:delayed||breath,...(units===4/3?{tuplet:3 as const}:{})};
    });
    return{meter:o.timeSignature,notes};
  });
}

/** Shared phrase plan for the adopted long line and explicit dialogue candidate. */
export function planContrastIntent(o:PracticeOptions,family:ContrastFamily,random:()=>number=Math.random):MusicalIntent{
  const base=planMusicalIntent(o,random),tonality=describeTonality(o.tonic??o.keySignature,o.scaleId??'major');
  const root=pitchClass(tonality.tonic!),pcs=tonality.notes.map(pitchClass).sort((a,b)=>mod(a-root)-mod(b-root));
  const pent=pcs.length===5,variant=(base.variant+(base.opening?.rhythm??0))%4,phrases=phrasesFor(o.measures,family);
  const degreeRoutes=family==='dialogue'?[[0,4,5,0,3,4,4,0],[0,4,1,0,5,4,4,0],[0,4,3,0,1,4,4,0],[0,4,5,0,1,4,4,0]]:
    [[0,5,3,1,4,5,4,0],[0,3,5,1,3,4,4,0],[0,5,1,3,4,1,4,0],[0,3,1,5,4,3,4,0]];
  const route=pent?[0,2,3,1,3,2,3,0]:degreeRoutes[variant],dominant=Math.max(0,pcs.indexOf(mod(root+7)));
  const harmony:HarmonyBar[]=Array.from({length:o.measures},(_,bar)=>{
    const phrase=phrases.find(p=>bar>=p.startBar&&bar<=p.endBar)!,last=bar===phrase.endBar;
    let degree=route[bar%route.length]%pcs.length;
    if(last)degree=phrase.cadence==='home'?0:dominant;
    if(bar===o.measures-2)degree=dominant;if(bar===0)degree=0;
    const center=pcs[degree],pitches=pent?[center,...[7,5,4,3].filter(i=>pcs.includes(mod(center+i))).slice(0,1).map(i=>mod(center+i))]:[center,pcs[(degree+2)%pcs.length],pcs[(degree+4)%pcs.length]];
    return{root:center,pitches:[...new Set(pitches)],role:last?'arrive':bar===0?'home':bar===o.measures-2?'prepare':'depart'};
  });
  return{version:1,grammar:pent?'pentatonic':family==='dialogue'?'classical':'lyrical',variant,
    motif:family==='dialogue'?[0,2,1,-1,0]:[0,1,3,5,3,1,0],phrases,harmony,rhythm:rhythmFor(o,family,phrases,variant)};
}
