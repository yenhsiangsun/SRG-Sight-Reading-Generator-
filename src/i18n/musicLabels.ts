import type { Locale } from './messages';
import { INSTRUMENTS, type Instrument } from '../music/instruments';
export function instrumentLabel(id:Instrument,locale:Locale) {
  if(locale==='zh-TW')return INSTRUMENTS[id].zh;
  const names:Partial<Record<Instrument,string>>={Piano:'Piano · 88 keys',Flute:'Flute · B footjoint',Clarinet:'Clarinet in B♭',Trumpet:'Trumpet in C','French Horn':'Horn in F',Tuba:'Bass tuba in F',Guitar:'Guitar · 6 strings / 20 frets','Bass Guitar':'Bass guitar · 4 strings / 24 frets','Double Bass':'Double bass · 4 strings',Sheng:'Soprano keyed sheng','Bangdi G':'Bangdi','Qudi C':'Qudi','Xindi G':'Xindi / Dadi','Suona C':'Traditional soprano suona','Suona G':'Traditional alto suona','Guan G':'Soprano guan',Guzheng:'Guzheng · 21 strings',Yangqin:'Yangqin · orchestral model',Yunluo:'Yunluo · 37 gongs',Voice:locale==='ja'?'声（音域を設定）':'Voice · custom range'};
  return names[id]??id;
}
const scaleNames:Record<string,[string,string]>={
  major:['Major / Ionian','長音階／アイオニアン'],'natural-minor':['Natural minor / Aeolian','自然短音階'],'harmonic-minor':['Harmonic minor','和声的短音階'],'melodic-minor':['Melodic minor (jazz)','旋律的短音階（ジャズ）'],
  dorian:['Dorian','ドリアン'],phrygian:['Phrygian','フリジアン'],lydian:['Lydian','リディアン'],mixolydian:['Mixolydian','ミクソリディアン'],locrian:['Locrian','ロクリアン'],
  'major-pentatonic':['Major pentatonic / Gong','長調五音音階／宮'],shang:['Shang pentatonic','商調式'],jue:['Jue pentatonic','角調式'],zhi:['Zhi pentatonic','徴調式'],'minor-pentatonic':['Minor pentatonic / Yu','短調五音音階／羽'],
  hirajoshi:['Hirajōshi','平調子'],in:['In scale','陰音階'],insen:['Insen','陰旋'],iwato:['Iwato','岩戸'],yo:['Yo scale','陽音階'],kumoi:['Kumoi','雲井'],ryukyu:['Ryukyu','琉球音階'],
  'minor-blues':['Minor blues','マイナー・ブルース'],'major-blues':['Major blues','メジャー・ブルース'],'harmonic-major':['Harmonic major','和声的長音階'],'phrygian-dominant':['Phrygian dominant','フリジアン・ドミナント'],'lydian-dominant':['Lydian dominant','リディアン・ドミナント'],
  'whole-tone':['Whole tone','全音音階'],'diminished-wh':['Diminished (whole–half)','ディミニッシュ（全半）'],'diminished-hw':['Diminished (half–whole)','ディミニッシュ（半全）'],atonal:['Atonal / chromatic','無調／半音階'],
};
export function scaleLabel(id:string,original:string,locale:Locale){return locale==='zh-TW'?original:scaleNames[id]?.[locale==='ja'?1:0]??id;}
