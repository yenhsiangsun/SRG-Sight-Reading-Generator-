// zh-TW, en, ja, es, de, fr, ko, pt-BR, ru, it, zh-CN, th.
export const pipaMessages = {
  pipaTechniqueGuide: [
    '琵琶：五射線記號＝輪指。',
    'Pipa: five rays = finger roll.',
    '琵琶：五本の放射線＝輪指。',
    'Pipa: cinco rayos = trémolo de dedos.',
    'Pipa: fünf Strahlen = Finger-Tremolo.',
    'Pipa : cinq rayons = trémolo des doigts.',
    '비파: 다섯 갈래 표시 = 윤지.',
    'Pipa: cinco raios = trêmolo dos dedos.',
    'Пипа: пять лучей — тремоло пальцами.',
    'Pipa: cinque raggi = tremolo delle dita.',
    '琵琶：五射线记号＝轮指。',
    'ผีผา: เส้นรัศมีห้าแฉก = รัวนิ้ว'
  ],
  pipaAuditionHelp: [
    '播放以現有取樣模擬輪指時序。測驗使用去除技法與和聲的單旋律版。',
    'Playback approximates finger rolls with existing samples. Assessment uses the plain melody without techniques or chords.',
    '再生は既存サンプルで輪指のタイミングを近似します。テストは奏法と和音を除いた単旋律で行います。',
    'La reproducción aproxima trémolos de dedos con las muestras actuales. La evaluación usa la melodía sin técnicas ni acordes.',
    'Wiedergabe nähert Finger-Tremolo mit vorhandenen Samples an. Tests nutzen die Melodie ohne Spieltechniken und Akkorde.',
    'La lecture simule le trémolo des doigts avec les échantillons actuels. Le test utilise la mélodie sans techniques ni accords.',
    '재생은 기존 샘플로 윤지의 타이밍을 근사해요. 시험에서는 주법과 화음 없는 단선율을 사용해요.',
    'A reprodução aproxima trêmolos dos dedos com as amostras atuais. A avaliação usa a melodia sem técnicas ou acordes.',
    'Воспроизведение имитирует тремоло пальцами имеющимися сэмплами. Тест использует мелодию без приёмов и аккордов.',
    'La riproduzione simula tremoli delle dita con i campioni attuali. Il test usa la melodia senza tecniche e accordi.',
    '播放以现有采样模拟轮指时序。测验使用去除技法与和声的单旋律版。',
    'การเล่นเสียงจำลองการรัวนิ้วด้วยตัวอย่างเสียงเดิม การทดสอบใช้ทำนองเดี่ยวโดยตัดเทคนิคและคอร์ดออก'
  ],
} as const;

export function pipaNamed(index: 10 | 11) {
  return Object.fromEntries(Object.entries(pipaMessages).map(([key,row]) => [key,row[index]])) as Record<keyof typeof pipaMessages,string>;
}
