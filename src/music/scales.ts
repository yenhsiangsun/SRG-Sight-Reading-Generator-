export const TONICS = ['C','C#','Db','D','Eb','E','F','F#','Gb','G','Ab','A','Bb','B','Cb'] as const;
export type Tonic = typeof TONICS[number];
interface ScaleDefinition {
  id: string; label: string; family: string; intervals: number[]; degrees?: number[];
  parent?: [number, number]; description: string;
}
const seven = [0,1,2,3,4,5,6];
export const SCALES = [
  {id:'major',label:'大音階／伊奧尼安',family:'大小調與教會調式',intervals:[0,2,4,5,7,9,11],degrees:seven,parent:[0,0],description:'全、全、半、全、全、全、半。'},
  {id:'natural-minor',label:'自然小音階／艾奧利安',family:'大小調與教會調式',intervals:[0,2,3,5,7,8,10],degrees:seven,parent:[3,2],description:'小調的自然形式，包含降三、降六、降七級。'},
  {id:'harmonic-minor',label:'和聲小音階',family:'大小調與教會調式',intervals:[0,2,3,5,7,8,11],degrees:seven,parent:[3,2],description:'自然小音階升高第七級，保留六、七級間的增二度。'},
  {id:'melodic-minor',label:'旋律小音階（爵士型）',family:'大小調與教會調式',intervals:[0,2,3,5,7,9,11],degrees:seven,parent:[3,2],description:'固定使用升六、升七級；上下行相同，不採古典下行還原形式。'},
  {id:'dorian',label:'多里安 Dorian',family:'大小調與教會調式',intervals:[0,2,3,5,7,9,10],degrees:seven,parent:[-2,-1],description:'小調色彩搭配自然六級。'},
  {id:'phrygian',label:'弗里吉安 Phrygian',family:'大小調與教會調式',intervals:[0,1,3,5,7,8,10],degrees:seven,parent:[-4,-2],description:'小調色彩搭配降二級。'},
  {id:'lydian',label:'利底安 Lydian',family:'大小調與教會調式',intervals:[0,2,4,6,7,9,11],degrees:seven,parent:[-5,-3],description:'大調色彩搭配升四級。'},
  {id:'mixolydian',label:'混合利底安 Mixolydian',family:'大小調與教會調式',intervals:[0,2,4,5,7,9,10],degrees:seven,parent:[-7,-4],description:'大調色彩搭配降七級。'},
  {id:'locrian',label:'洛克里安 Locrian',family:'大小調與教會調式',intervals:[0,1,3,5,6,8,10],degrees:seven,parent:[1,1],description:'包含降二級與減五度。'},
  {id:'major-pentatonic',label:'大調五聲／宮調式',family:'五聲音階',intervals:[0,2,4,7,9],degrees:[0,1,2,4,5],parent:[0,0],description:'一、二、三、五、六級；五聲宮調式的音集合。'},
  {id:'shang',label:'商調式（五聲）',family:'五聲音階',intervals:[0,2,5,7,10],degrees:[0,1,3,4,6],parent:[-2,-1],description:'以商音為中心的五聲音集合。'},
  {id:'egyptian-pentatonic',label:'埃及五聲音階',family:'五聲音階',intervals:[0,2,5,7,10],degrees:[0,1,3,4,6],parent:[-2,-1],description:'採常稱 Egyptian pentatonic 的一、二、四、五、降七級形式；與商調式同音集合，不代表完整埃及傳統音樂語法。'},
  {id:'jue',label:'角調式（五聲）',family:'五聲音階',intervals:[0,3,5,8,10],degrees:[0,2,3,5,6],parent:[-4,-2],description:'以角音為中心的五聲音集合。'},
  {id:'zhi',label:'徵調式（五聲）',family:'五聲音階',intervals:[0,2,5,7,9],degrees:[0,1,3,4,5],parent:[-7,-4],description:'以徵音為中心的五聲音集合。'},
  {id:'minor-pentatonic',label:'小調五聲／羽調式',family:'五聲音階',intervals:[0,3,5,7,10],degrees:[0,2,3,4,6],parent:[3,2],description:'一、降三、四、五、降七級。'},
  {id:'hirajoshi',label:'平調子 Hirajōshi',family:'日本音階',intervals:[0,2,3,7,8],degrees:[0,1,2,4,5],description:'採常見的 0–2–3–7–8 半音音集合。'},
  {id:'in',label:'陰音階 In',family:'日本音階',intervals:[0,1,5,7,8],degrees:[0,1,3,4,5],description:'採 0–1–5–7–8 形式；不同傳統對陰音階有不同分類。'},
  {id:'insen',label:'Insen 音階',family:'日本音階',intervals:[0,1,5,7,10],degrees:[0,1,3,4,6],description:'採 0–1–5–7–10 形式。'},
  {id:'iwato',label:'岩戶 Iwato',family:'日本音階',intervals:[0,1,5,6,10],degrees:[0,1,3,4,6],description:'採 0–1–5–6–10 形式。'},
  {id:'yo',label:'陽音階 Yo',family:'日本音階',intervals:[0,2,5,7,9],degrees:[0,1,3,4,5],description:'採 0–2–5–7–9 形式，與徵調式同音集合；不代表完整傳統演奏語法。'},
  {id:'kumoi',label:'雲井 Kumoi',family:'日本音階',intervals:[0,2,3,7,9],degrees:[0,1,2,4,5],description:'採 0–2–3–7–9 形式。'},
  {id:'ryukyu',label:'琉球音階 Ryukyu',family:'日本音階',intervals:[0,4,5,7,11],degrees:[0,2,3,4,6],description:'採 0–4–5–7–11 形式。'},
  // Twelve-tone practice adaptations, not authentic gamelan tunings; see docs/southeast-asian-scales.md.
  {id:'pelog-pentatonic',label:'南洋風格・Pelog 五聲（近似）',family:'東南亞風格音階',intervals:[0,1,3,7,8],degrees:[0,1,2,4,5],description:'採西方音階資料庫常用的 Pelog 五聲近似：一、降二、降三、五、降六級；以十二平均律供視譜練習，不代表完整傳統 Pelog 調律或旋律語法。'},
  {id:'slendro-pentatonic',label:'南洋風格・Slendro 五聲（近似）',family:'東南亞風格音階',intervals:[0,2,5,7,10],degrees:[0,1,3,4,6],description:'將理想化五等分八度的 0、240、480、720、960 音分就近取整為半音；與埃及五聲同音集合，不代表真實 Slendro／Salendro 調律或旋律語法。'},
  {id:'minor-blues',label:'小調藍調音階',family:'藍調與其他音階',intervals:[0,3,5,6,7,10],degrees:[0,2,3,4,4,6],description:'小調五聲加入降五級藍音。'},
  {id:'major-blues',label:'大調藍調音階',family:'藍調與其他音階',intervals:[0,2,3,4,7,9],degrees:[0,1,2,2,4,5],description:'大調五聲加入降三級藍音。'},
  {id:'harmonic-major',label:'和聲大音階',family:'藍調與其他音階',intervals:[0,2,4,5,7,8,11],degrees:seven,parent:[0,0],description:'大音階降低第六級。'},
  {id:'phrygian-dominant',label:'弗里吉安屬音階',family:'藍調與其他音階',intervals:[0,1,4,5,7,8,10],degrees:seven,description:'弗里吉安升高第三級，具有大三度與降二級。'},
  {id:'lydian-dominant',label:'利底安屬音階',family:'藍調與其他音階',intervals:[0,2,4,6,7,9,10],degrees:seven,description:'利底安降低第七級，又稱泛音音階。'},
  {id:'whole-tone',label:'全音音階',family:'對稱音階與非調性',intervals:[0,2,4,6,8,10],degrees:[0,1,2,3,4,6],description:'相鄰音皆相隔全音，使用六個音級。'},
  {id:'diminished-wh',label:'減音階（全半）',family:'對稱音階與非調性',intervals:[0,2,3,5,6,8,9,11],degrees:[0,1,2,3,4,5,5,6],description:'全音與半音交替的八音音階。'},
  {id:'diminished-hw',label:'減音階（半全）',family:'對稱音階與非調性',intervals:[0,1,3,4,6,7,9,10],degrees:[0,1,2,2,3,4,5,6],description:'半音與全音交替的八音音階。'},
  {id:'atonal',label:'非調性（自由半音）',family:'對稱音階與非調性',intervals:[0,1,2,3,4,5,6,7,8,9,10,11],description:'不指定主音或調號，從十二個半音選音；仍遵守拍數、音域與難度限制。'},
] satisfies ScaleDefinition[];
export type ScaleId = typeof SCALES[number]['id'];
export interface Tonality { tonic: string | null; scaleId: string; label: string; notes: string[]; signature: string | null }
export interface ScalePitch { midi: number; key: string; octave: number }
export interface PitchMaterial { pitches: ScalePitch[]; pitchClasses: number[]; tonicPC: number | null }
const LETTERS = ['C','D','E','F','G','A','B'];
const NATURAL = [0,2,4,5,7,9,11];
const mod = (n: number, base=12) => ((n % base) + base) % base;
export function pitchClass(name: string): number {
  return mod(NATURAL[LETTERS.indexOf(name[0].toUpperCase())] + [...name.slice(1)].reduce((sum,c)=>sum+(c==='#'?1:c==='b'?-1:0),0));
}
function spelling(tonic: string, semitones: number, degree: number) {
  const letter = mod(LETTERS.indexOf(tonic[0])+degree,7);
  let delta=mod(pitchClass(tonic)+semitones-NATURAL[letter]);
  if(delta>6) delta-=12;
  return LETTERS[letter]+(delta>0?'#'.repeat(delta):'b'.repeat(-delta));
}
export function getScale(id: string) {
  const scale=SCALES.find(s=>s.id===id);
  if(!scale) throw new Error('找不到這個音階，請重新選擇。');
  return scale as ScaleDefinition;
}
export function describeTonality(tonic: Tonic, id: string): Tonality {
  const scale=getScale(id);
  if(id==='atonal') return {tonic:null,scaleId:id,label:scale.label,notes:['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'],signature:null};
  const notes=scale.intervals.map((interval,i)=>spelling(tonic,interval,scale.degrees![i]));
  const parent=scale.parent?spelling(tonic,...scale.parent):null;
  const signature=parent&&TONICS.includes(parent as Tonic)?parent:null;
  return {tonic,scaleId:id,label:`${tonic} ${scale.label}`,notes,signature};
}
export function buildPitchMaterial(tonality: Tonality, range: {min:number;max:number}): PitchMaterial {
  const pitches: ScalePitch[]=[];
  for(let midi=range.min;midi<=range.max;midi++) {
    const name=tonality.notes.find(note=>pitchClass(note)===mod(midi));
    if(!name) continue;
    const natural=NATURAL[LETTERS.indexOf(name[0])];
    const alteration=[...name.slice(1)].reduce((sum,c)=>sum+(c==='#'?1:-1),0);
    // Written octave is based on the letter: B#3 sounds C4; Cb4 sounds B3.
    const octave=(midi-natural-alteration)/12-1;
    pitches.push({midi,key:name,octave});
  }
  return {pitches,pitchClasses:tonality.notes.map(pitchClass),tonicPC:tonality.tonic?pitchClass(tonality.tonic):null};
}
