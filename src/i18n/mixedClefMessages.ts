/** Rows follow localeOrder; named catalogs use the last two entries explicitly. */
export const mixedClefMessages={
  mixedClefsTitle:[
    '混合使用的譜表',
    'Clefs for mixed staff',
    '混合譜表で使う音部記号',
    'Claves del pentagrama mixto',
    'Schlüssel im gemischten Notensystem',
    'Clés de la portée mixte',
    '혼합 보표에 사용할 음자리표',
    'Claves da pauta mista',
    'Ключи смешанного нотного стана',
    'Chiavi del pentagramma misto',
    '混合使用的谱表',
    'กุญแจเสียงสำหรับบรรทัดผสม',
  ],
  mixedClefsHelp:[
    '選擇至少兩種譜表；預設為高音與低音。樂譜會依音域在選取的譜號之間切換。',
    'Choose at least two clefs. Treble and bass are selected by default; the score switches between your selected clefs to suit the register.',
    '2種類以上を選んでください。初期設定はト音記号とヘ音記号です。選んだ音部記号の間で、音域に合わせて切り替えます。',
    'Elige al menos dos claves. Sol y fa están seleccionadas por defecto; la partitura cambia entre las claves elegidas según el registro.',
    'Wähle mindestens zwei Schlüssel. Violin- und Bassschlüssel sind vorausgewählt; die Partitur wechselt je nach Tonlage zwischen deiner Auswahl.',
    'Choisissez au moins deux clés. Les clés de sol et de fa sont sélectionnées par défaut ; la partition alterne entre vos clés selon le registre.',
    '음자리표를 두 가지 이상 선택하세요. 기본은 높은음자리표와 낮은음자리표이며, 선택한 음자리표 안에서 음역에 맞게 전환해요.',
    'Escolha pelo menos duas claves. Sol e fá vêm selecionadas; a partitura alterna entre as claves escolhidas conforme o registro.',
    'Выберите не менее двух ключей. По умолчанию выбраны скрипичный и басовый; партитура переключается между выбранными ключами по регистру.',
    'Scegli almeno due chiavi. Violino e basso sono selezionate inizialmente; la partitura passa tra le chiavi scelte in base al registro.',
    '选择至少两种谱表；默认为高音与低音。乐谱会依音域在选取的谱号之间切换。',
    'เลือกอย่างน้อย 2 แบบ ค่าเริ่มต้นคือกุญแจซอลและฟา โน้ตจะสลับใช้กุญแจเสียงที่เลือกให้เหมาะกับช่วงเสียง',
  ],
} as const;

export function mixedClefNamed(index:10|11){
  return Object.fromEntries(Object.entries(mixedClefMessages).map(([key,row])=>[key,row[index]])) as Record<keyof typeof mixedClefMessages,string>;
}
