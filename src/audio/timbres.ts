import { INSTRUMENTS, type Instrument } from '../music/instruments';
import type { ExerciseData } from '../music';

export interface Timbre {
  label: string; partials: number[]; attack: number; decay: number; sustain: number; release: number;
  volume: number; fm?: {harmonicity:number;modulationIndex:number};
}
const tone = (label:string,partials:number[],attack:number,decay:number,sustain:number,release:number,volume=-15):Timbre => ({label,partials,attack,decay,sustain,release,volume});
export const TIMBRES = {
  piano: {...tone('鋼琴',[1,.5,.2,.08],.003,.9,.08,.3,-13),fm:{harmonicity:1,modulationIndex:1.2}},
  violin: tone('小提琴',[1,.65,.4,.3,.2,.13],.055,.15,.8,.12,-19),
  viola: tone('中提琴',[1,.48,.32,.24,.13],.065,.18,.8,.16,-18),
  cello: tone('大提琴',[1,.55,.23,.17,.08],.075,.2,.85,.18,-17),
  bass: tone('低音提琴',[1,.38,.19,.08],.09,.24,.75,.2,-15),
  flute: tone('長笛',[1,.07,.04],.07,.14,.85,.13,-13),
  clarinet: tone('單簧管',[1,.015,.45,.01,.14,.008,.06],.04,.15,.8,.12,-16),
  oboe: tone('雙簧管',[1,.7,.56,.4,.22,.12],.035,.12,.8,.1,-20),
  bassoon: tone('低音管',[1,.4,.34,.12,.17,.05],.05,.15,.8,.13,-17),
  trumpet: tone('小號',[1,.8,.55,.35,.21,.12],.025,.16,.8,.12,-21),
  horn: tone('法國號',[1,.3,.15,.08,.04],.08,.2,.78,.19,-15),
  trombone: tone('長號',[1,.6,.36,.21,.12],.05,.18,.82,.16,-19),
  tuba: tone('低音號',[1,.25,.12,.06],.09,.2,.8,.2,-14),
  altoSax: tone('中音薩克斯風',[1,.65,.35,.29,.15,.09],.045,.14,.8,.12,-19),
  tenorSax: tone('次中音薩克斯風',[1,.5,.3,.19,.12,.05],.055,.18,.82,.16,-18),
  guitar: tone('木吉他',[1,.4,.16,.07,.025],.003,.6,.015,.18,-12),
  electricBass: tone('電貝斯',[1,.34,.12,.045],.004,.5,.08,.12,-12),
  voice: tone('人聲母音',[1,.2,.4,.09,.13],.11,.15,.75,.18,-17),
  sheng: tone('高音笙',[1,.45,.3,.12,.15,.06],.045,.12,.88,.12,-18),
  tenorSheng: tone('次中音笙',[1,.36,.25,.11,.09],.06,.14,.88,.15,-17),
  bassSheng: tone('低音笙',[1,.29,.16,.1,.04],.08,.16,.9,.18,-15),
  bangdi: tone('梆笛',[1,.25,.12,.08,.045],.025,.12,.8,.09,-16),
  qudi: tone('曲笛',[1,.17,.07,.035],.055,.16,.82,.14,-14),
  xindi: tone('新笛／大笛',[1,.09,.035,.015],.065,.18,.86,.16,-13),
  suona: tone('嗩吶',[1,.95,.7,.55,.36,.22,.12],.018,.1,.88,.085,-23),
  guan: tone('管子',[1,.25,.65,.12,.3,.07],.035,.15,.86,.11,-19),
  liuqin: tone('柳琴／小阮',[1,.7,.4,.22,.1],.002,.22,.008,.08,-17),
  pipa: tone('琵琶',[1,.6,.3,.18,.085,.035],.002,.36,.01,.12,-16),
  zhongruan: tone('中阮',[1,.4,.19,.075],.004,.55,.015,.16,-13),
  daruan: tone('大阮',[1,.3,.15,.055],.005,.68,.018,.2,-12),
  sanxian: tone('三弦',[1,.7,.25,.3,.075],.003,.28,.01,.1,-17),
  guzheng: tone('古箏',[1,.38,.17,.07,.025],.002,1.1,.025,.5,-13),
  yangqin: {...tone('揚琴',[1,.4,.14],.001,.65,.015,.3,-17),fm:{harmonicity:2.01,modulationIndex:2.2}},
  gaohu: tone('高胡',[1,.7,.45,.28,.18,.1],.04,.12,.85,.1,-20),
  erhu: tone('二胡',[1,.5,.39,.16,.12,.065],.055,.17,.86,.15,-18),
  zhonghu: tone('中胡',[1,.42,.28,.12,.07],.07,.2,.85,.18,-17),
  gehu: tone('革胡',[1,.49,.2,.12,.07],.08,.2,.85,.2,-17),
  bassGehu: tone('低音革胡',[1,.32,.16,.07],.1,.24,.86,.22,-15),
  yunluo: {...tone('雲鑼',[1],.001,1.7,0,.6,-21),fm:{harmonicity:1.414,modulationIndex:3}},
} satisfies Record<string,Timbre>;
export type TimbreId = keyof typeof TIMBRES;
const direct: Partial<Record<Instrument,TimbreId>> = {
  Piano:'piano',Violin:'violin',Viola:'viola',Cello:'cello','Double Bass':'bass',Flute:'flute',Clarinet:'clarinet',Oboe:'oboe',Bassoon:'bassoon',Trumpet:'trumpet','French Horn':'horn',Trombone:'trombone',Tuba:'tuba','Alto Saxophone':'altoSax','Tenor Saxophone':'tenorSax',Guitar:'guitar','Bass Guitar':'electricBass',Voice:'voice',
  Sheng:'sheng','Tenor Sheng':'tenorSheng','Bass Sheng':'bassSheng',Liuqin:'liuqin',Pipa:'pipa',Zhongruan:'zhongruan',Daruan:'daruan',Sanxian:'sanxian',Guzheng:'guzheng',Yangqin:'yangqin',Gaohu:'gaohu',Erhu:'erhu',Zhonghu:'zhonghu',Gehu:'gehu','Bass Gehu':'bassGehu',Yunluo:'yunluo',
};
export function getTimbreId(instrument:string):TimbreId {
  const selected=direct[instrument as Instrument];
  if(selected)return selected;
  if(instrument.startsWith('Bangdi '))return 'bangdi';
  if(instrument.startsWith('Qudi '))return 'qudi';
  if(instrument.startsWith('Xindi '))return 'xindi';
  if(instrument.includes('Suona'))return 'suona';
  if(instrument.includes('Guan'))return 'guan';
  return 'piano';
}
export function createTimbrePreview(instrument:Instrument):ExerciseData {
  const profile=INSTRUMENTS[instrument];
  const root=Math.max(profile.min,Math.min(60,profile.max-7));
  const events=[0,2,4,7].map((step,i)=>{
    const midi=root+step;
    const octave=Math.floor(midi/12)-1;
    return {key:['c','c#','d','d#','e','f','f#','g','g#','a','a#','b'][midi%12]+'/'+octave,octave,midi,duration:'q' as const,dots:0,rest:false,startUnits:i*4,durationUnits:4};
  });
  return {instrument:profile.engineInstrument,soundProfile:instrument,transposition:profile.transpose,clef:'treble',difficulty:'beginner',keySignature:'C',timeSignature:'4/4',rhythmLevel:'simple',tempo:100,measures:[{events,totalUnits:16,groups:[4,4,4,4],beamGroups:[4,4,4,4]}]};
}
