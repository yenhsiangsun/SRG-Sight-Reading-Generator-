import {TIME_SIGNATURES, type Difficulty, type MeasureData, type PracticeOptions, type VexDuration} from '../music';
import {describeTonality, pitchClass, type ScalePitch, type Tonality} from './scales';
import type {PhraseSpan} from './phrasePlan';
import type {HarmonyBar} from './phraseHarmony';
import type {RhythmBarPlan} from './phraseRhythm';
import {pulseGroups} from './meterFeel';
import {intentRhythmCell} from './intentRhythmGrade';
import {planIntentOpening,openingMotif,openingAnchor,validIntentOpening,type IntentOpening} from './intentOpening';
import {addRhythmUnits} from './rhythmTiming';

export const COMPOSITION_STYLES=['auto','classical','lyrical','pentatonic','legacy'] as const;
export type CompositionStyle=typeof COMPOSITION_STYLES[number];
export type MusicalGrammar='classical'|'lyrical'|'pentatonic';
export interface IntentPhrase extends PhraseSpan {
  cadence:'open'|'home';
  gesture:'present'|'extend'|'answer'|'return';
  peak:number;
}
/** Serializable, generated before rhythm or pitches. No score/player state. */
export interface MusicalIntent {
  version:1;
  grammar:MusicalGrammar;
  motif:number[];
  variant:number;
  phrases:IntentPhrase[];
  harmony:HarmonyBar[];
  rhythm:RhythmBarPlan[];
  opening?:IntentOpening;
}
const mod=(n:number,m=12)=>(n%m+m)%m;

export function supportsMusicalIntent(o:PracticeOptions) {
  return o.compositionStyle!==undefined&&o.compositionStyle!=='legacy'&&!o.allowAccidentals&&!o.mixedMeters&&
    (!o.pitchFocus||o.pitchFocus==='balanced')&&(!o.rhythmFocus||o.rhythmFocus==='balanced')&&
    o.measures>=4&&o.measures<=16&&[5,7].includes(describeTonality(o.tonic??o.keySignature,o.scaleId??'major').notes.length)&&
    !['atonal','whole-tone','diminished-wh','diminished-hw'].includes(o.scaleId??'major');
}
function partition(length:number,grammar:MusicalGrammar,variant:number):number[] {
  const forms:Record<MusicalGrammar,Record<number,number[]>>={
    classical:{4:[2,2],8:[4,4],12:[4,4,4],16:[4,4,4,4]},
    lyrical:{4:[4],8:[3,5],12:[3,4,5],16:[4,5,4,3]},
    pentatonic:{4:[2,2],8:[2,3,3],12:[3,2,4,3],16:[3,3,4,3,3]},
  };
  // Keep the familiar period among the choices. Other realizations follow a
  // different musical journey: a continuous sentence, a longer call/short
  // release, or a balanced modal reply. These are whole-form plans, not random
  // bar lengths; the same variant drives their motive, energy and cadence.
  const alternatives:Record<MusicalGrammar,Record<number,number[][]>>={
    classical:{8:[[8],[3,5]],12:[[4,8],[6,6]],16:[[8,8],[4,4,8]]},
    lyrical:{8:[[5,3],[4,4]],12:[[5,7],[6,6]],16:[[8,8],[5,5,6]]},
    pentatonic:{8:[[3,5],[4,4]],12:[[4,4,4],[3,5,4]],16:[[4,4,4,4],[5,5,6]]},
  };
  const alternative=variant>=2?alternatives[grammar][length]?.[variant-2]:undefined;
  if(alternative)return alternative;
  if(forms[grammar][length])return forms[grammar][length];
  const parts:number[]=[];let remaining=length;
  while(remaining>0){const n=remaining<=5?remaining:grammar==='pentatonic'?3:4;parts.push(n);remaining-=n;}
  return parts;
}
function harmonyFor(tonality:Tonality,phrases:IntentPhrase[],grammar:MusicalGrammar,variant:number):HarmonyBar[] {
  const root=pitchClass(tonality.tonic!),pcs=[...new Set(tonality.notes.map(pitchClass))].sort((a,b)=>mod(a-root)-mod(b-root));
  const fifth=pcs.indexOf(mod(root+7)),dominant=fifth<0?pcs.length-1:fifth;
  return phrases.flatMap((phrase,p)=>Array.from({length:phrase.endBar-phrase.startBar+1},(_,b)=>{
    const last=b===phrase.endBar-phrase.startBar,prepare=b===phrase.endBar-phrase.startBar-1;
    let degree=0;
    if(grammar==='pentatonic')degree=last?phrase.cadence==='home'?0:2:[0,2,3,1,3][(b+2*p+variant)%5]%pcs.length;
    else if(last)degree=phrase.cadence==='home'?0:dominant;
    else if(prepare)degree=phrase.cadence==='home'?dominant:1;
    else degree=(grammar==='classical'?[0,5,3,1]:[0,5,3,2])[(b+p+variant)%4]%pcs.length;
    if(p===0&&b===0)degree=0;
    const center=pcs[degree];
    // Five-tone narratives use actual modal support; never manufacture a leading tone.
    const pitches=grammar==='pentatonic'?[center,...[7,5,9].filter(interval=>pcs.includes(mod(center+interval))).slice(0,1).map(interval=>mod(center+interval))]:
      [center,pcs[(degree+2)%pcs.length],pcs[(degree+4)%pcs.length]];
    return {root:center,pitches:[...new Set(pitches)],role:last?'arrive':prepare?'prepare':p===0&&b===0?'home':'depart'};
  }));
}
function written(units:number):{duration:VexDuration;dots:number} {
  if(units===4/3)return {duration:'8',dots:0};
  if(units===12)return {duration:'h',dots:1};
  if(units===8)return {duration:'h',dots:0};
  if(units===6)return {duration:'q',dots:1};
  if(units===4)return {duration:'q',dots:0};
  if(units===3)return {duration:'8',dots:1};
  if(units===2)return {duration:'8',dots:0};
  return {duration:units===.5?'32':'16',dots:0};
}
/** Rhythmic syntax depends on grammar and the phrase's job, never pitch grade. */
function intentRhythm(o:PracticeOptions,grammar:MusicalGrammar,phrases:IntentPhrase[],variant:number,opening?:IntentOpening):RhythmBarPlan[] {
  const info=TIME_SIGNATURES[o.timeSignature],groups=pulseGroups({timeSignature:o.timeSignature,groups:[]}),compound=info.denominator===8;
  const totalUnits=info.numerator*16/info.denominator;
  return Array.from({length:o.measures},(_,bar)=>{
    const phrase=phrases.find(p=>bar>=p.startBar&&bar<=p.endBar)!,local=bar-phrase.startBar;
    const length=phrase.endBar-phrase.startBar+1,response=phrase.startBar>0;
    const landing=bar===phrase.endBar,final=bar===o.measures-1;
    const sentence=grammar==='classical'&&length>=6;
    const reprise=sentence&&local===length-2;
    const motiveLocal=sentence&&local>=2&&local<4?local-2:reprise?0:local;
    const developing=grammar==='classical'?local>=Math.ceil(length/2)&&!landing&&!reprise:
      local===Math.floor(length*phrase.peak)||local===Math.floor(length*phrase.peak)-1;
    let position=0;
    const cells=groups.map((pulse,g)=>{
      const ending=landing&&g===groups.length-1;
      if(ending){
        if(!final&&o.rhythmLevel==='complex'&&pulse===6)return [1,1,2,2];
        return !final&&o.rhythmLevel!=='simple'&&pulse===4&&totalUnits<16?[2,2]:[pulse];
      }
      // The figure follows the motive on its return. The selected tier supplies
      // its vocabulary throughout the phrase, including lyrical and modal calls.
      if(o.rhythmLevel!=='simple'){
        const figure=variant*2+motiveLocal+g*(grammar==='lyrical'?2:grammar==='pentatonic'?3:1)+
          (grammar==='pentatonic'?2:0)+(response?3:0);
        return intentRhythmCell(pulse,o.rhythmLevel,figure,developing);
      }
      // Beginner phrases keep the existing longer tones and small vocabulary.
      const active=grammar==='lyrical'?local===Math.floor(length*phrase.peak):
        grammar==='pentatonic'?local%2===(response?1:0):local===1||local===length-2;
      return active&&g===(variant+local)%groups.length?[2,pulse-2]:[pulse];
    });
    // A singing line has sustained spans, while the answer's cadence broadens.
    if(!compound&&groups.length>=2&&groups[0]===4&&groups[1]===4&&
      ((grammar==='lyrical'&&local%2===0&&o.rhythmLevel!=='complex')||(landing&&o.rhythmLevel==='simple')||final&&o.rhythmLevel!=='complex'))cells.splice(0,2,[8]);
    // Each grammar arrives in its own way. A universal q-q-half ending used
    // to erase the distinction again at the most memorable part of the song.
    if(final&&o.timeSignature==='4/4'){
      const closing=o.rhythmLevel==='complex'?
        grammar==='lyrical'?[[3,1],[1,1,2],[8]]:grammar==='pentatonic'?[[1,2,1],[2,2],[8]]:[[1,1,2],[2,1,1],[8]]:
        grammar==='lyrical'?[[4],[12]]:grammar==='pentatonic'?[[8],[8]]:
        o.rhythmLevel==='simple'?[[4],[4],[8]]:[[2,2],[4],[8]];
      cells.splice(0,cells.length,...closing);
    }
    if(final&&grammar==='lyrical'&&o.timeSignature==='6/8'&&o.rhythmLevel!=='complex')cells.splice(0,cells.length,[12]);
    // One complete triplet gesture can decorate a quarter-pulse phrase. In
    // compound meter its three eighths are already the natural pulse, not 3:2.
    const tripletColor=o.rhythmLevel==='complex'?variant!==0:o.rhythmLevel==='medium'?variant>=2:variant===3;
    if(!compound&&bar===1&&tripletColor){
      const pulse=cells.findIndex((cell,index)=>index<cells.length-1&&cell.reduce((s,n)=>s+n,0)===4);
      if(pulse>=0)cells[pulse]=[4/3,4/3,4/3];
    }
    // Vary the order and internal direction of the existing pulse cells. Their
    // inventory stays intact, preserving grade separation and the increase
    // in activity during a continuation. Unequal pulses never trade places.
    if(opening&&motiveLocal<2&&!landing){
      const sums=cells.map(cell=>cell.reduce((sum,n)=>sum+n,0));
      for(const units of new Set(sums)){
        const indices=sums.flatMap((sum,index)=>Math.abs(sum-units)<1e-7?[index]:[]);
        const originals=indices.map(index=>[...cells[index]]);
        for(const [n,index]of indices.entries()){
          const cell=originals[(n+opening.rhythm)%indices.length];
          cells[index]=opening.rhythm%2?[...cell].reverse():cell;
        }
      }
      if(o.rhythmLevel==='simple'&&!compound&&opening.rhythm%3!==0){
        const start=opening.rhythm%2?0:cells.length-2;
        if(start>=0&&[cells[start],cells[start+1]].every(cell=>cell?.reduce((sum,n)=>sum+n,0)===4))cells.splice(start,2,[8]);
      }
    }
    const flat=cells.flat();
    const restLimit=o.rhythmLevel==='simple'?4:Math.min(4,totalUnits/4);
    const cadenceRest=!final&&landing&&grammar!=='lyrical'&&flat.at(-1)!<=restLimit?flat.at(-1)!:0;
    const gapBudget=Math.max(0,Math.min(2,totalUnits/4-cadenceRest));
    let shortRestUnits=0,previousRest=false;
    const notes=flat.map((units,index)=>{
      const startUnits=position;position=addRhythmUnits(position,units);
      // Brief gaps inside a figure practise re-entry. They follow the same
      // motive on a return, never replace a tuplet or the opening downbeat,
      // and never erase consecutive notes or more than two sixteenths a bar.
      const gap=o.rhythmLevel==='complex'&&!final&&units===1&&index>0&&!previousRest&&shortRestUnits+units<=gapBudget&&
        !(compound&&startUnits%6===0)&&
        (variant+motiveLocal+index)%7===3;
      const rest=gap||!final&&landing&&index===flat.length-1&&cadenceRest>0;
      if(gap)shortRestUnits+=units;
      previousRest=rest;
      return {...written(units),units,startUnits,rest,...(units===4/3?{tuplet:3 as const}:{})};
    });
    // An occasional short delayed melody entrance keeps the written bar and
    // pulse intact. The accompanying hand can still establish the downbeat.
    if(opening?.weak&&motiveLocal===0&&!landing&&notes.length>2&&notes[0].units<=2&&!notes[1].rest&&
      notes[0].units+notes.reduce((sum,n)=>sum+(n.rest?n.units:0),0)<=totalUnits/4)notes[0].rest=true;
    // Leave space at the start of an occasional modal answer, never the whole bar.
    if(grammar==='pentatonic'&&phrase.gesture==='answer'&&local===0&&notes.length>2&&notes[0].units<=2&&
      (o.rhythmLevel==='simple'||!notes[1].rest&&notes[0].units+notes.reduce((s,n)=>s+(n.rest?n.units:0),0)<=totalUnits/4))notes[0].rest=true;
    return {meter:o.timeSignature,notes};
  });
}

export function planMusicalIntent(o:PracticeOptions,random:()=>number=Math.random):MusicalIntent {
  const tonality=describeTonality(o.tonic??o.keySignature,o.scaleId??'major');
  const pent=tonality.notes.length===5;
  const grammar:MusicalGrammar=pent?'pentatonic':o.compositionStyle==='lyrical'?'lyrical':
    o.compositionStyle==='classical'?'classical':random()<.5?'classical':'lyrical';
  const variant=Math.floor(random()*4),direction=random()<.5?1:-1;
  const opening=planIntentOpening(tonality,random(),variant),motif=openingMotif(grammar,opening,direction);
  let start=0;
  const lengths=partition(o.measures,grammar,variant);
  const phrases:IntentPhrase[]=lengths.map((length,index)=>{
    const end=start+length-1,last=index===lengths.length-1;
    const p:IntentPhrase={startBar:start,endBar:end,role:last?'closing':index===0?'opening':index===1?'answer':'development',
      cadence:last||index%2===1?'home':'open',gesture:index===0?'present':last?'return':index%2?'answer':'extend',
      peak:variant<2?grammar==='lyrical'?(last?.64:.74):grammar==='classical'?.46:.32+(index%2)*.3:
        grammar==='classical'?(length>=6?.62:.5):grammar==='lyrical'?(last?.45:.68):index===0?.4:.6};
    start=end+1;return p;
  });
  return {version:1,grammar,motif,variant,opening,phrases,harmony:harmonyFor(tonality,phrases,grammar,variant),rhythm:intentRhythm(o,grammar,phrases,variant,opening)};
}

/** Realize the prewritten intention on actual onset time, with the existing
 * global legal-path solver enforcing range, spelling and grade reach. */
export function intentPitchTargets(measures:MeasureData[],pitches:ScalePitch[],tonality:Tonality,difficulty:Difficulty,intent:MusicalIntent,instrument?:string) {
  const targets:{index:number;midi?:number;interval?:number;weight:number;preferredStep?:number;stepWeight?:number}[]=[];
  const root=pitchClass(tonality.tonic!),pcs=tonality.notes.map(pitchClass).sort((a,b)=>mod(a-root)-mod(b-root));
  const midpoint=pitches[0].midi+(pitches.at(-1)!.midi-pitches[0].midi)*.43;
  // A full piano/yangqin range should not push a beginner melody into the
  // highest register merely because the instrument has many available keys.
  const center=['Piano','Yangqin'].includes(instrument??'')?Math.max(pitches[0].midi,Math.min(pitches.at(-1)!.midi,72)):midpoint;
  const tonic=pitches.filter(p=>p.midi%12===root).sort((a,b)=>Math.abs(a.midi-center)-Math.abs(b.midi-center))[0]??pitches[Math.floor(pitches.length/2)];
  const tonicIndex=pitches.indexOf(tonic),band={beginner:3,intermediate:5,advanced:7}[difficulty];
  const entry=intent.opening?openingAnchor(pitches,root,tonic.midi,difficulty,intent.opening,intent.motif):tonicIndex;
  const polarity=intent.opening?Math.sign(intent.motif.find(n=>n!==0)??1):1;
  const slots=measures.flatMap((m,bar)=>m.events.filter(n=>!n.rest).map(n=>({n,bar})));
  const nearest=(index:number)=>pitches[Math.max(0,Math.min(pitches.length-1,index))].midi;
  const cellAt=(cell:number[],fraction:number)=>{
    const point=Math.min(cell.length-1,Math.max(0,fraction)*(cell.length-1)),left=Math.floor(point);
    return cell[left]+(cell[Math.min(left+1,cell.length-1)]-cell[left])*(point-left);
  };
  for(const [index,{n,bar}] of slots.entries()){
    const pIndex=intent.phrases.findIndex(p=>bar>=p.startBar&&bar<=p.endBar),phrase=intent.phrases[pIndex];
    const length=phrase.endBar-phrase.startBar+1,local=(bar-phrase.startBar+n.startUnits/measures[bar].totalUnits)/length;
    const phase=local<phrase.peak?local/phrase.peak:(1-local)/(1-phrase.peak);
    const time=(bar-phrase.startBar)*measures[bar].totalUnits+n.startUnits;
    const answer=phrase.gesture==='answer'||phrase.startBar>0&&phrase.gesture==='return';
    const span=measures[bar].totalUnits*Math.min(2,length),cycle=Math.floor(time/span),fraction=(time%span)/span;
    // The core cell occupies two bars. A continuation develops its tail rather
    // than cycling a five-beat lookup unrelated to the meter. The closing
    // phrase answers the cell instead of merely transposing it down one step.
    const returning=intent.grammar==='classical'&&length>=6&&cycle===Math.ceil(length/2)-1;
    const cell=cycle===0||returning?intent.motif:intent.motif.slice(-3);
    let offset=cellAt(cell,fraction);
    if(intent.grammar==='classical')offset=(answer?-offset*.65:offset)+phase*band*(intent.opening?.3*polarity:.65)+(cycle&&!returning?phase:0);
    else if(intent.grammar==='lyrical')offset=phase*band*(intent.opening?.55*polarity:1)+cellAt(intent.motif,local)*.5;
    else offset=(answer?-offset:offset)+(pIndex%2?2:0)+phase*band*.35*polarity;
    if(intent.opening)offset+=(entry-tonicIndex)*(1-local)*(answer?.6:1);
    offset=Math.round(offset);
    // Advanced development uses turn/neighbor decoration; not compulsory octave leaps.
    if(difficulty!=='beginner'&&n.durationUnits<=2&&index%4===1)offset+=difficulty==='advanced'?2:1;
    const desired=nearest(tonicIndex+offset),previousMidi=targets[index-1]?.midi;
    targets.push({index,midi:desired,weight:intent.grammar==='lyrical'?5:4,
      ...(n.durationUnits<=2&&previousMidi!==undefined?{preferredStep:Math.sign(desired-previousMidi),stepWeight:1}: {})});
    // Lean above the planned harmony, then resolve by step on the next note.
    if(intent.grammar==='lyrical'&&difficulty!=='beginner'&&local>.4&&local<.8&&n.startUnits===0&&slots[index+1]?.bar===bar){
      const chord=intent.harmony[bar],desired=nearest(tonicIndex+offset);
      const resolution=pitches.filter(p=>chord.pitches.includes(p.midi%12)).sort((a,b)=>Math.abs(a.midi-desired)-Math.abs(b.midi-desired))[0];
      const r=resolution&&pitches.indexOf(resolution);
      if(r!==undefined&&r+1<pitches.length){targets[index]={index,midi:pitches[r+1].midi,weight:14};
        // Assigned on next iteration below, so the resolution cannot be overwritten.
      }
    }
    const previous=targets[index-1];
    if(intent.grammar==='lyrical'&&previous?.weight===14&&previous.midi!==undefined){
      const r=pitches.findIndex(p=>p.midi===previous.midi)-1;
      if(r>=0)targets[index]={index,midi:pitches[r].midi,weight:16};
    }
  }
  // Present a short recognizable nucleus on actual attacks. The later answer
  // recalls/inverts that nucleus; the preplanned line develops its tail. This
  // also lets a busy opening turn within its first few sounds instead of
  // rounding several sixteenths to the same tonic on a slow two-bar ramp.
  if(intent.opening)for(const phrase of intent.phrases){
    const members=slots.flatMap((slot,index)=>slot.bar>=phrase.startBar&&slot.bar<=Math.min(phrase.startBar+1,phrase.endBar)?[index]:[]);
    const count=Math.min(intent.motif.length,members.length-2);
    if(count<2)continue;
    const answer=phrase.gesture==='answer',shape=phrase.gesture==='extend'?intent.motif.slice(-3):intent.motif;
    const anchor=openingAnchor(pitches,root,tonic.midi,difficulty,intent.opening,shape,answer);
    for(let n=0;n<Math.min(count,shape.length);n++){
      const index=members[n],degree=anchor+(answer?-shape[n]:shape[n]);
      if(degree<0||degree>=pitches.length)continue;
      targets[index]={index,midi:pitches[degree].midi,weight:n===0?12:8};
    }
  }
  // Reserve an actual approach and landing after expressive decorations. The
  // old endpoint-only preference could jump a fifth into the final tonic;
  // a leaning-note resolution could also overwrite a phrase's resting tone.
  for(const phrase of intent.phrases){
    const end=slots.findLastIndex(slot=>slot.bar<=phrase.endBar);
    if(end<0)continue;
    const degree=phrase.cadence==='home'?0:intent.grammar==='pentatonic'?2:Math.max(0,pcs.indexOf(mod(root+7)));
    // A tonic resting point releases the phrase's register arc; selecting the
    // nearest tonic to an elevated last ornament could turn the cadence into
    // a new high point and force an octave drop at the next phrase entrance.
    const resting=pcs[degree],desired=phrase.cadence==='home'?tonic.midi:targets[end].midi??tonic.midi;
    const landing=pitches.filter(p=>p.midi%12===resting).sort((a,b)=>Math.abs(a.midi-desired)-Math.abs(b.midi-desired))[0];
    if(!landing)continue;
    targets[end]={index:end,midi:landing.midi,interval:mod(resting-root),weight:45};
    if(end===0||slots[end-1].bar<phrase.startBar)continue;
    // Western tonal closure favours 2–1 (or the actual raised leading tone in
    // harmonic minor); five-tone closure uses only an existing modal neighbour.
    const raisedLeading=tonality.scaleId==='harmonic-minor'&&phrase.cadence==='home';
    const neighbors=pitches.filter(p=>p.midi!==landing.midi&&Math.abs(p.midi-landing.midi)<=3)
      .sort((a,b)=>(raisedLeading?Math.abs(a.midi-(landing.midi-1))-Math.abs(b.midi-(landing.midi-1)):
        Math.abs(a.midi-(landing.midi+2))-Math.abs(b.midi-(landing.midi+2))));
    if(neighbors.length)targets[end-1]={index:end-1,midi:neighbors[0].midi,weight:18};
  }
  return targets;
}

/** Old scores omit this field. Saved metadata never rewrites an existing score. */
export function validMusicalIntent(value:unknown,bars:number):value is MusicalIntent|undefined {
  if(value===undefined)return true;
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const v=value as Record<string,unknown>;
  if(!validIntentOpening(v.opening))return false;
  if(v.version!==1||!['classical','lyrical','pentatonic'].includes(String(v.grammar))||
    !Number.isInteger(v.variant)||Number(v.variant)<0||Number(v.variant)>3||
    !Array.isArray(v.motif)||v.motif.length<2||v.motif.length>8||!v.motif.every(n=>Number.isInteger(n)&&Math.abs(n)<=8)||
    !Array.isArray(v.phrases)||!v.phrases.length||v.phrases.length>bars||
    !Array.isArray(v.harmony)||v.harmony.length!==bars||!Array.isArray(v.rhythm)||v.rhythm.length!==bars)return false;
  let next=0;
  for(const p of v.phrases){
    if(!p||typeof p!=='object'||p.startBar!==next||!Number.isInteger(p.endBar)||p.endBar<next||p.endBar>=bars||
      !['opening','development','answer','closing'].includes(p.role)||!['open','home'].includes(p.cadence)||
      !['present','extend','answer','return'].includes(p.gesture)||typeof p.peak!=='number'||p.peak<=0||p.peak>=1)return false;
    next=p.endBar+1;
  }
  if(next!==bars)return false;
  if(!v.harmony.every(h=>h&&typeof h==='object'&&Number.isInteger(h.root)&&h.root>=0&&h.root<=11&&
    ['home','depart','prepare','arrive'].includes(h.role)&&Array.isArray(h.pitches)&&h.pitches.length>0&&h.pitches.length<=3&&h.pitches.every((n:unknown)=>Number.isInteger(n)&&Number(n)>=0&&Number(n)<=11)))return false;
  return v.rhythm.every(b=>b&&typeof b==='object'&&Object.hasOwn(TIME_SIGNATURES,b.meter)&&Array.isArray(b.notes)&&b.notes.length>0&&b.notes.length<=64&&
    b.notes.every((n:Record<string,unknown>)=>n&&typeof n==='object'&&typeof n.rest==='boolean'&&typeof n.startUnits==='number'&&Number.isFinite(n.startUnits)&&n.startUnits>=0&&
      typeof n.units==='number'&&Number.isFinite(n.units)&&n.units>0&&n.units<=16&&['w','h','q','8','16','32'].includes(String(n.duration))));
}
