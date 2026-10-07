import type {Locale} from './messages';

export interface KeySignatureLabels {
  title: string;
  help: string;
  all: string;
  none: string;
  sharps: string;
  flats: string;
  open: string;
  openHelp: string;
  emptyHelp: string;
}

const copy: Record<Locale, KeySignatureLabels> = {
  'zh-TW': {
    title: '調號',
    help: '可複選；每份新樂譜會從你選的調號中抽選一種。',
    all: '自動（所有調號）',
    none: '無升降記號',
    sharps: '升記號',
    flats: '降記號',
    open: '無調號／非調性',
    openHelp: '無調號練習，包含非調性；不會套用升降調號。',
    emptyHelp: '請至少選一項，或使用「自動」。',
  },
  en: {
    title: 'Key signatures',
    help: 'Select one or more; each new score uses one of your choices.',
    all: 'Automatic (all key signatures)',
    none: 'No sharps or flats',
    sharps: 'Sharps',
    flats: 'Flats',
    open: 'No key signature / atonal',
    openHelp: 'Practice without a key signature, including atonal exercises; no sharps or flats are added to the key signature.',
    emptyHelp: 'Choose at least one, or use Automatic.',
  },
  ja: {
    title: '調号',
    help: '複数選べます。新しい楽譜ごとに、選んだ調号から1つを使用します。',
    all: '自動（すべての調号）',
    none: 'シャープ・フラットなし',
    sharps: 'シャープ',
    flats: 'フラット',
    open: '調号なし／無調',
    openHelp: '調号なしの練習です。無調の練習を含み、調号のシャープ・フラットは付きません。',
    emptyHelp: '1つ以上選ぶか、「自動」を選んでください。',
  },
  es: {
    title: 'Armaduras',
    help: 'Selecciona una o más; cada partitura nueva usará una de tus opciones.',
    all: 'Automático (todas las armaduras)',
    none: 'Sin sostenidos ni bemoles',
    sharps: 'Sostenidos',
    flats: 'Bemoles',
    open: 'Sin armadura / atonal',
    openHelp: 'Ejercicios sin armadura, incluidos los atonales; no se añaden sostenidos ni bemoles a la armadura.',
    emptyHelp: 'Elige al menos una opción o usa Automático.',
  },
  de: {
    title: 'Tonartvorzeichen',
    help: 'Wähle eine oder mehrere Optionen. Jede neue Partitur verwendet eine deiner Auswahlen.',
    all: 'Automatisch (alle Tonartvorzeichen)',
    none: 'Keine Kreuze oder Bs',
    sharps: 'Kreuze',
    flats: 'Bs',
    open: 'Ohne Tonartvorzeichen / atonal',
    openHelp: 'Übungen ohne Tonartvorzeichen, einschließlich atonaler Übungen; keine Kreuze oder Bs als Tonartvorzeichen.',
    emptyHelp: 'Wähle mindestens eine Option oder „Automatisch“.',
  },
  fr: {
    title: 'Armures',
    help: 'Choisissez une ou plusieurs options ; chaque nouvelle partition utilisera l’une d’elles.',
    all: 'Automatique (toutes les armures)',
    none: 'Sans dièse ni bémol',
    sharps: 'Dièses',
    flats: 'Bémols',
    open: 'Sans armure / atonal',
    openHelp: 'Exercices sans armure, y compris atonaux ; aucun dièse ni bémol n’est ajouté à l’armure.',
    emptyHelp: 'Choisissez au moins une option ou « Automatique ».',
  },
  ko: {
    title: '조표',
    help: '여러 개를 선택할 수 있어요. 새 악보마다 선택한 조표 중 하나를 사용해요.',
    all: '자동 (모든 조표)',
    none: '올림표·내림표 없음',
    sharps: '올림표',
    flats: '내림표',
    open: '조표 없음 / 무조',
    openHelp: '조표 없이 연습해요. 무조 연습을 포함하며, 올림표·내림표 조표를 붙이지 않아요.',
    emptyHelp: '하나 이상 선택하거나 자동을 사용하세요.',
  },
  'pt-BR': {
    title: 'Armaduras de clave',
    help: 'Selecione uma ou mais; cada nova partitura usará uma das suas escolhas.',
    all: 'Automático (todas as armaduras)',
    none: 'Sem sustenidos ou bemóis',
    sharps: 'Sustenidos',
    flats: 'Bemóis',
    open: 'Sem armadura / atonal',
    openHelp: 'Exercícios sem armadura, incluindo os atonais; sem sustenidos ou bemóis na armadura.',
    emptyHelp: 'Escolha pelo menos uma opção ou use Automático.',
  },
  ru: {
    title: 'Ключевые знаки',
    help: 'Выберите один или несколько вариантов. В каждой новой партитуре будет использован один из них.',
    all: 'Автоматически (все ключевые знаки)',
    none: 'Без диезов и бемолей',
    sharps: 'Диезы',
    flats: 'Бемоли',
    open: 'Без ключевых знаков / атональность',
    openHelp: 'Упражнения без ключевых знаков, включая атональные; диезы и бемоли при ключе не добавляются.',
    emptyHelp: 'Выберите хотя бы один вариант или режим «Автоматически».',
  },
  it: {
    title: 'Armature di chiave',
    help: 'Seleziona una o più opzioni; ogni nuovo spartito userà una delle tue scelte.',
    all: 'Automatico (tutte le armature)',
    none: 'Senza diesis o bemolli',
    sharps: 'Diesis',
    flats: 'Bemolli',
    open: 'Senza armatura / atonale',
    openHelp: 'Esercizi senza armatura, compresi quelli atonali; nessun diesis o bemolle nell’armatura.',
    emptyHelp: 'Scegli almeno un’opzione oppure usa Automatico.',
  },
  'zh-CN': {
    title: '调号',
    help: '可多选；每份新乐谱会从你选的调号中抽选一种。',
    all: '自动（所有调号）',
    none: '无升降记号',
    sharps: '升记号',
    flats: '降记号',
    open: '无调号／非调性',
    openHelp: '无调号练习，包含非调性；不会使用升降调号。',
    emptyHelp: '请至少选一项，或使用“自动”。',
  },
  th: {
    title: 'เครื่องหมายประจำกุญแจเสียง',
    help: 'เลือกได้มากกว่าหนึ่งแบบ โน้ตชุดใหม่แต่ละชุดจะใช้หนึ่งในตัวเลือกของคุณ',
    all: 'อัตโนมัติ (ทุกเครื่องหมายประจำกุญแจเสียง)',
    none: 'ไม่มีชาร์ปหรือแฟลต',
    sharps: 'ชาร์ป',
    flats: 'แฟลต',
    open: 'ไม่กำหนดเครื่องหมายประจำกุญแจเสียง / อะโทนัล',
    openHelp: 'ฝึกโดยไม่มีเครื่องหมายประจำกุญแจเสียง รวมถึงแบบฝึกอะโทนัล ไม่มีชาร์ปหรือแฟลตประจำกุญแจเสียง',
    emptyHelp: 'เลือกอย่างน้อยหนึ่งแบบ หรือใช้อัตโนมัติ',
  },
};

export function keySignatureLabels(locale: Locale): KeySignatureLabels {
  return copy[locale];
}
