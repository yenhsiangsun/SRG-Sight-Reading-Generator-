// zh-TW, en, ja, es, de, fr, ko, pt-BR, ru, it, zh-CN, th.
export const assessmentMessages={
  durationScore:['音長','Note length','音の長さ','Duración','Notenlänge','Durée des notes','음 길이','Duração','Длительность','Durata','音长','ความยาวเสียง'],
  extraNotes:['多餘起音','Extra attacks','余分な発音','Ataques extra','Zusätzliche Anschläge','Attaques supplémentaires','추가 발음','Ataques extras','Лишние атаки','Attacchi aggiuntivi','多余起音','การขึ้นเสียงเกิน'],
  assessmentTimingHelp:[
    '節奏分數包含起音、音長與多餘起音；短奏依記號縮短。',
    'Rhythm includes attack timing, note length and extra attacks. Staccato notes may be shorter.',
    'リズムは発音のタイミング、音の長さ、余分な発音を含みます。スタッカートは短く演奏できます。',
    'El ritmo incluye el inicio, la duración y los ataques extra. Las notas staccato pueden ser más cortas.',
    'Rhythmus umfasst Einsatz, Notenlänge und zusätzliche Anschläge. Staccato darf kürzer sein.',
    'Le rythme tient compte du départ, de la durée et des attaques supplémentaires. Le staccato peut être plus court.',
    '리듬에는 시작 타이밍, 음 길이와 추가 발음이 반영돼요. 스타카토는 짧게 연주할 수 있어요.',
    'O ritmo inclui o início, a duração e os ataques extras. Notas staccato podem ser mais curtas.',
    'Ритм учитывает момент атаки, длительность и лишние атаки. Стаккато может быть короче.',
    'Il ritmo comprende l’inizio, la durata e gli attacchi aggiuntivi. Le note staccato possono essere più brevi.',
    '节奏分数包含起音、音长与多余起音；短奏按记号缩短。',
    'คะแนนจังหวะรวมเวลาขึ้นเสียง ความยาวเสียง และการขึ้นเสียงเกิน โน้ตสตักกาโตเล่นให้สั้นได้',
  ],
  assessmentDecayHelp:[
    '此樂器的音長判斷已放寬，以容許自然衰減；結果僅供練習參考。',
    'Note length allows for this instrument’s natural decay. Results are practice estimates.',
    'この楽器の自然な減衰を考慮し、音の長さの判定を緩めています。練習の目安です。',
    'La duración admite el decaimiento natural del instrumento. Es una estimación para practicar.',
    'Die Notenlänge berücksichtigt das natürliche Ausklingen des Instruments. Das Ergebnis ist eine Übungshilfe.',
    'La durée tient compte de la décroissance naturelle de cet instrument. Le résultat reste une estimation pour la pratique.',
    '이 악기의 자연스러운 감쇠를 고려해 음 길이 기준을 완화했어요. 연습용 추정치예요.',
    'A duração considera o decaimento natural do instrumento. O resultado é uma estimativa para praticar.',
    'Учитывается естественное затухание инструмента. Результат служит ориентиром для практики.',
    'La durata tiene conto del decadimento naturale dello strumento. Il risultato è una stima per esercitarsi.',
    '此乐器的音长判断已放宽，以允许自然衰减；结果仅供练习参考。',
    'เกณฑ์ความยาวเสียงผ่อนปรนตามการเบาลงตามธรรมชาติของเครื่องดนตรีนี้ ผลเป็นค่าประมาณเพื่อฝึกซ้อม',
  ],
} as const;

export function assessmentNamed(index:10|11) {
  return Object.fromEntries(Object.entries(assessmentMessages).map(([key,row])=>[key,row[index]])) as Record<keyof typeof assessmentMessages,string>;
}
