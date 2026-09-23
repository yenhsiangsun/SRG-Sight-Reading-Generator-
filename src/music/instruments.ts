import type { Instrument as EngineInstrument } from '../music';
export type StaffChoice = 'treble' | 'bass' | 'alto' | 'tenor' | 'mixedStaff' | 'grand';
export interface InstrumentProfile {
  zh: string; family: string; clef: StaffChoice; engineInstrument: EngineInstrument;
  min: number; max: number; transpose: number; note: string; source: string;
  tonic?: 'D'; scaleId?: string;
}
const HKCO = 'https://www.hkco.org/uploads/docs/682542db204771.pdf';
const vsl = (path: string) => `https://www.vsl.co.at/academy/${path}`;
const p = (zh: string, family: string, clef: StaffChoice, min: number, max: number, source: string, note = '', transpose = 0, engineInstrument: EngineInstrument = 'Piano'): InstrumentProfile => ({zh,family,clef,min,max,source,note,transpose,engineInstrument});
const cn = (zh: string, family: string, clef: StaffChoice, min: number, max: number, note = '', transpose = 0) => p(zh,family,clef,min,max,HKCO,note,transpose);
// Scientific pitch notation (C4 = MIDI 60). Bounds are WRITTEN pitches.
// HKCO profiles use open-circle range endpoints, excluding black-note extreme extensions.
export const INSTRUMENTS = {
  Piano: p('鋼琴（88 鍵）','鍵盤','grand',21,108,'https://es.yamaha.com/es/musical-instruments/pianos/explore/musical-instrument-guide/piano/trivia/trivia007.html','標準 88 鍵 A0–C8；大譜表採左右手雙聲部。'),
  Violin: p('小提琴','弦樂','treble',55,105,vsl('strings/violin'),'G3–A7，不含泛音延伸。',0,'Violin'),
  Viola: p('中提琴','弦樂','alto',48,93,vsl('strings/viola'),'C3–A6，不含泛音延伸。'),
  Cello: p('大提琴','弦樂','bass',36,81,vsl('strings/cello'),'C2–A5，不含泛音延伸。',0,'Cello'),
  'Double Bass': p('低音提琴（四弦）','弦樂','bass',40,79,vsl('strings/double-bass'),'標準四弦；採實音 E1–G4 的音域，記譜高八度。',-12,'Cello'),
  Flute: p('長笛（B 尾管）','木管','treble',59,98,vsl('woodwinds/concert-flute'),'B3–D7；C 尾管請將最低音設為 C4。',0,'Flute'),
  Clarinet: p('降 B 調單簧管','木管','treble',52,93,vsl('woodwinds/clarinet'),'採管弦樂音域，實音 D3–G6；播放低大二度。',-2,'Clarinet'),
  Oboe: p('雙簧管','木管','treble',58,91,vsl('woodwinds/oboe'),'B♭3–G6，不含極限 A6。'),
  Bassoon: p('低音管','木管','bass',34,75,vsl('woodwinds/bassoon'),'B♭1–E♭5，不含極限 F5。'),
  Trumpet: p('C 調小號','銅管','treble',54,84,vsl('brass/trumpet-c'),'F♯3–C6，不含極限音。',0,'Trumpet'),
  'French Horn': p('F 調法國號','銅管','treble',42,84,vsl('brass/horn-f'),'實音 B1–F5；播放低完全五度。',-7,'Trumpet'),
  Trombone: p('次中音長號','銅管','bass',40,77,vsl('brass/tenor-trombone'),'E2–F5，不含踏板音及附加閥延伸。',0,'Trombone'),
  Tuba: p('低音號（F 調）','銅管','bass',26,67,vsl('brass/bass-tuba'),'實音 D1–G4；低音譜表不移調。'),
  'Alto Saxophone': p('中音薩克斯風（E♭）','木管','treble',58,90,'https://www.yamaha.com/en/musical_instrument_guide/saxophone/play/play002.html','具高 F♯ 鍵，未含超吹；播放低大六度。',-9),
  'Tenor Saxophone': p('次中音薩克斯風（B♭）','木管','treble',58,90,'https://www.yamaha.com/en/musical_instrument_guide/saxophone/play/play002.html','具高 F♯ 鍵，未含超吹；播放低大九度。',-14),
  Guitar: p('木吉他（六弦／20 格）','其他','treble',52,96,'https://europe.yamaha.com/en/musical-instruments/guitars-basses-amps/explore/musical-instrument-guide/acoustic-guitar/structure002.html','標準 EADGBE 定弦；最高音依 20 格推算，實音 E2–C6。',-12),
  'Bass Guitar': p('電貝斯（四弦／24 格）','其他','bass',40,79,'https://usa.yamaha.com/products/musical_instruments/guitars_basses/el_basses/trbx/specs.html','標準 EADG 定弦；最高音依 24 格推算，實音 E1–G4。',-12),
  Voice: p('人聲（自訂音域）','其他','treble',60,72,'','C4–C5 僅為起始練習範圍；人聲沒有統一音域，請依自己的舒適音域設定。'),
  Sheng: cn('高音鍵笙','國樂・吹管','treble',55,90,'香港中樂團加鍵型，G3–F♯6；不適用傳統 17 簧笙。'),
  'Alto Sheng': p('中音笙','國樂・吹管','mixedStaff',48,83,'','依指定練習音域 C3–B5；實音記譜，預設依音高切換高、低音譜號。',0,'Sheng'),
  'Tenor Sheng': cn('次中音笙','國樂・吹管','alto',43,78,'香港中樂團加鍵型，G2–F♯5。'),
  'Bass Sheng': cn('低音笙','國樂・吹管','bass',36,67,'香港中樂團加鍵型，C2–G4。'),
  'Bangdi G': cn('梆笛','國樂・吹管','treble',62,88,'參考 G 調型號音域；樂曲調性可另選，其他型號請自訂音域。採香港中樂團高八度實音慣例；含超吹，不含極限音。快速連續半音需特殊指法。',12),
  'Bangdi F': cn('梆笛（F 調）','國樂・吹管','treble',60,86,'實音高記譜八度；傳統非加鍵。',12),
  'Bangdi A': cn('梆笛（A 調）','國樂・吹管','treble',64,90,'實音高記譜八度；傳統非加鍵。',12),
  'Bangdi C': cn('梆笛（小 C 調）','國樂・吹管','treble',67,93,'實音高記譜八度；傳統非加鍵。',12),
  'Qudi C': cn('曲笛','國樂・吹管','treble',55,81,'參考 C 調型號音域；樂曲調性可另選，其他型號請自訂音域。實音高記譜八度；傳統非加鍵，含超吹，不含極限音。',12),
  'Qudi Bb': cn('曲笛（B♭ 調）','國樂・吹管','treble',53,79,'實音高記譜八度；傳統非加鍵。',12),
  'Qudi D': cn('曲笛（D 調）','國樂・吹管','treble',57,83,'實音高記譜八度；傳統非加鍵。',12),
  'Qudi E': cn('曲笛（E 調）','國樂・吹管','treble',59,85,'實音高記譜八度；傳統非加鍵。',12),
  'Xindi G': cn('新笛／大笛','國樂・吹管','treble',62,88,'參考 G 調型號音域；樂曲調性可另選，其他型號請自訂音域。實音記譜；新笛無膜、大笛有膜。'),
  'Xindi F': cn('新笛／大笛（F 調）','國樂・吹管','treble',60,86,'實音記譜；不含極限音。'),
  'Xindi A': cn('新笛／大笛（A 調）','國樂・吹管','treble',64,90,'實音記譜；不含極限音。'),
  'Xindi Bb': cn('新笛／大笛（B♭ 調）','國樂・吹管','treble',65,91,'實音記譜；不含極限音。'),
  'Soprano Suona': cn('高音加鍵嗩吶','國樂・吹管','treble',62,89,'含半音與超吹；不含極限延伸。'),
  'Alto Suona': cn('中音加鍵嗩吶','國樂・吹管','treble',57,84,'含半音與超吹；不含極限延伸。'),
  'Tenor Suona': cn('次中音加鍵嗩吶','國樂・吹管','alto',50,76,'含半音與超吹；不含極限延伸。'),
  'Bass Suona': cn('低音加鍵嗩吶','國樂・吹管','bass',43,64,'含半音與超吹；不含極限延伸。'),
  'Suona C': cn('傳統高音嗩吶','國樂・吹管','treble',67,91,'參考 C 調型號音域；樂曲調性可另選，其他型號請自訂音域。非加鍵；含超吹，不含極限音。快速連續半音受指法限制。'),
  'Suona D': cn('傳統高音嗩吶（D 調）','國樂・吹管','treble',69,93,'非加鍵；含超吹，不含極限音。'),
  'Suona Bb': cn('傳統高音嗩吶（B♭ 調）','國樂・吹管','treble',65,89,'非加鍵；含超吹，不含極限音。'),
  'Suona G': cn('傳統中音嗩吶','國樂・吹管','treble',62,86,'參考 G 調型號音域；樂曲調性可另選，其他型號請自訂音域。非加鍵；含超吹，不含極限音。'),
  'Suona A': cn('傳統中音嗩吶（A 調）','國樂・吹管','treble',64,88,'非加鍵；含超吹，不含極限音。'),
  'Suona F': cn('傳統中音嗩吶（F 調）','國樂・吹管','treble',60,84,'非加鍵；含超吹，不含極限音。'),
  'Guan G': cn('高音管','國樂・吹管','treble',62,86,'參考 G 調型號音域；樂曲調性可另選，其他型號請自訂音域。傳統非加鍵管子；含超吹。'),
  'Guan F': cn('高音管（F 調）','國樂・吹管','treble',60,84,'傳統非加鍵管子；含超吹。'),
  'Guan A': cn('高音管（A 調）','國樂・吹管','treble',64,88,'傳統非加鍵管子；含超吹。'),
  'Alto Guan': cn('中音加鍵管','國樂・吹管','treble',62,83,'實音 D3–B4；高八度記譜，未含極限音。',-12),
  'Bass Guan': cn('低音加鍵管','國樂・吹管','bass',45,64,'實音 A2–E4，未含極限音。'),
  Liuqin: cn('柳琴／小阮','國樂・彈撥','treble',55,93,'香港中樂團表列音域 G3–A6，未含極限延伸。'),
  Pipa: cn('琵琶','國樂・彈撥','mixedStaff',45,88,'實音 A2–E6；預設混合譜表，於單行內依音高切換高、低音譜號。'),
  Zhongruan: cn('中阮','國樂・彈撥','treble',55,83,'採香港中樂團高八度記譜；實音 G2–B4。',-12),
  Daruan: cn('大阮','國樂・彈撥','bass',38,67,'實音 D2–G4，未含極限延伸。'),
  Sanxian: cn('大三弦','國樂・彈撥','bass',43,74,'香港中樂團定弦 G2–D3–G3；音域至 D5。'),
  Guzheng: {...cn('古箏（21 弦）','國樂・彈撥','grand',38,86,'開放弦 D2–D6，D 宮五聲定弦；其他調式及半音需按弦或演奏前移碼。'),tonic:'D' as const,scaleId:'major-pentatonic'},
  Yangqin: cn('揚琴（樂團型）','國樂・彈撥','grand',43,93,'香港中樂團表列 G2–A6，含半音；其他型號請依實琴調整。'),
  Gaohu: cn('高胡','國樂・拉弦','treble',67,93,'採香港中樂團環保高胡表列音域，G4–A6，未含極限音。'),
  Erhu: cn('二胡','國樂・拉弦','treble',62,86,'D4–D6 表列音域；香港中樂團環保胡琴型，未含極限延伸。'),
  Zhonghu: cn('中胡','國樂・拉弦','alto',55,74,'G3–D5 表列音域；香港中樂團環保胡琴型，未含極限延伸。'),
  Gehu: cn('革胡','國樂・拉弦','bass',36,74,'香港中樂團環保革胡表列 C2–D5。'),
  'Bass Gehu': cn('低音革胡','國樂・拉弦','bass',40,67,'香港中樂團環保低音革胡；實音 E1–G3，高八度記譜。',-12),
  Yunluo: cn('雲鑼（37 面）','國樂・打擊','treble',55,91,'G3–G6，37 面半音階配置；不適用傳統十面雲鑼。'),
} satisfies Record<string, InstrumentProfile>;
export type Instrument = keyof typeof INSTRUMENTS;
const hiddenVariants = new Set(['Bangdi F','Bangdi A','Bangdi C','Qudi Bb','Qudi D','Qudi E','Xindi F','Xindi A','Xindi Bb','Suona D','Suona Bb','Suona A','Suona F','Guan F','Guan A']);
export const INSTRUMENT_LIST = Object.entries(INSTRUMENTS).filter(([name])=>!hiddenVariants.has(name)).map(([name,profile])=>({name:name as Instrument,...profile}));
