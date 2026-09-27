// zh-TW, en, ja, es, de, fr, ko, pt-BR, ru, it, zh-CN, th.
export const pipaMessages = {
  pipaTechniqueGuide: [
    '琵琶：五射線記號＝輪指，直箭頭＝掃弦，波浪線＝琶音。',
    'Pipa: five rays = finger roll; straight arrow = brush; wavy line = arpeggio.',
    '琵琶：五本の放射線＝輪指、直線矢印＝掃弦、波線＝アルペジオ。',
    'Pipa: cinco rayos = trémolo de dedos; flecha recta = rasgueo; línea ondulada = arpegio.',
    'Pipa: fünf Strahlen = Finger-Tremolo; gerader Pfeil = Anschlag über die Saiten; Wellenlinie = Arpeggio.',
    'Pipa : cinq rayons = trémolo des doigts ; flèche droite = balayage ; ligne ondulée = arpège.',
    '비파: 다섯 갈래 표시 = 윤지, 직선 화살표 = 쓸어치기, 물결선 = 아르페지오.',
    'Pipa: cinco raios = trêmolo dos dedos; seta reta = varredura; linha ondulada = arpejo.',
    'Пипа: пять лучей — тремоло пальцами; прямая стрелка — удар по струнам; волнистая линия — арпеджио.',
    'Pipa: cinque raggi = tremolo delle dita; freccia diritta = spazzolata; linea ondulata = arpeggio.',
    '琵琶：五射线记号＝轮指，直箭头＝扫弦，波浪线＝琶音。',
    'ผีผา: เส้นรัศมีห้าแฉก = รัวนิ้ว; ลูกศรตรง = กวาดสาย; เส้นหยัก = อาร์เปจจิโอ'
  ],
  pipaAuditionHelp: [
    '播放以現有取樣模擬輪指與掃弦時序。測驗使用去除技法與和聲的單旋律版。',
    'Playback approximates rolls and brushes with existing samples. Assessment uses the plain melody without techniques or chords.',
    '再生は既存サンプルで輪指と掃弦のタイミングを近似します。テストは奏法と和音を除いた単旋律で行います。',
    'La reproducción aproxima trémolos y rasgueos con las muestras actuales. La evaluación usa la melodía sin técnicas ni acordes.',
    'Wiedergabe nähert Tremolo und Saitenanschläge mit vorhandenen Samples an. Tests nutzen die Melodie ohne Spieltechniken und Akkorde.',
    'La lecture simule trémolos et balayages avec les échantillons actuels. Le test utilise la mélodie sans techniques ni accords.',
    '재생은 기존 샘플로 윤지와 쓸어치기의 타이밍을 근사해요. 시험에서는 주법과 화음 없는 단선율을 사용해요.',
    'A reprodução aproxima trêmolos e varreduras com as amostras atuais. A avaliação usa a melodia sem técnicas ou acordes.',
    'Воспроизведение имитирует тремоло и удары имеющимися сэмплами. Тест использует мелодию без приёмов и аккордов.',
    'La riproduzione simula tremoli e spazzolate con i campioni attuali. Il test usa la melodia senza tecniche e accordi.',
    '播放以现有采样模拟轮指与扫弦时序。测验使用去除技法与和声的单旋律版。',
    'การเล่นเสียงจำลองการรัวและกวาดสายด้วยตัวอย่างเสียงเดิม การทดสอบใช้ทำนองเดี่ยวโดยตัดเทคนิคและคอร์ดออก'
  ],
} as const;

export function pipaNamed(index: 10 | 11) {
  return Object.fromEntries(Object.entries(pipaMessages).map(([key,row]) => [key,row[index]])) as Record<keyof typeof pipaMessages,string>;
}
