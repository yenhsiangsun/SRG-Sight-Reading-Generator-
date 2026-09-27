import type {Locale} from './messages';

const copy: Record<Locale, readonly [string, string, string, string]> = {
  'zh-TW': ['繼續上次練習', '第 {bar} 小節 · 點選後自行開始播放', '上次樂譜與播放位置已自動保存。', '無法保存上次練習，關閉 App 後可能遺失。'],
  en: ['Continue last practice', 'Bar {bar} · Press play when ready', 'Your last score and playback position are saved automatically.', 'Last practice could not be saved and may be lost when the app closes.'],
  ja: ['前回の練習を続ける', '{bar} 小節目 · 準備ができたら再生', '前回の楽譜と再生位置を自動保存しました。', '前回の練習を保存できません。アプリを閉じると失われる場合があります。'],
  es: ['Continuar la última práctica', 'Compás {bar} · Reproduce cuando estés listo', 'La última partitura y la posición se guardan automáticamente.', 'No se pudo guardar la práctica; puede perderse al cerrar la aplicación.'],
  de: ['Letzte Übung fortsetzen', 'Takt {bar} · Starten, wenn du bereit bist', 'Die letzte Partitur und Wiedergabeposition werden automatisch gespeichert.', 'Die Übung konnte nicht gespeichert werden und kann beim Schließen verloren gehen.'],
  fr: ['Reprendre la dernière séance', 'Mesure {bar} · Lancez la lecture quand vous êtes prêt', 'La dernière partition et la position sont enregistrées automatiquement.', 'La séance n’a pas pu être enregistrée et risque d’être perdue à la fermeture.'],
  ko: ['지난 연습 이어하기', '{bar}마디 · 준비되면 재생하세요', '마지막 악보와 재생 위치가 자동으로 저장돼요.', '연습을 저장하지 못했어요. 앱을 닫으면 사라질 수 있어요.'],
  'pt-BR': ['Continuar a última prática', 'Compasso {bar} · Toque quando estiver pronto', 'A última partitura e a posição são salvas automaticamente.', 'Não foi possível salvar a prática; ela pode ser perdida ao fechar o aplicativo.'],
  ru: ['Продолжить последнее занятие', 'Такт {bar} · Нажмите воспроизведение, когда будете готовы', 'Последняя партитура и позиция сохраняются автоматически.', 'Не удалось сохранить занятие. При закрытии приложения оно может быть потеряно.'],
  it: ['Riprendi l’ultima esercitazione', 'Battuta {bar} · Avvia quando sei pronto', 'L’ultima partitura e la posizione vengono salvate automaticamente.', 'Impossibile salvare l’esercitazione; potrebbe andare persa alla chiusura.'],
  'zh-CN': ['继续上次练习', '第 {bar} 小节 · 点选后自行开始播放', '上次乐谱与播放位置已自动保存。', '无法保存上次练习，关闭 App 后可能丢失。'],
  th: ['ฝึกต่อจากครั้งที่แล้ว', 'ห้องที่ {bar} · กดเล่นเมื่อพร้อม', 'บันทึกโน้ตและตำแหน่งเล่นล่าสุดโดยอัตโนมัติ', 'บันทึกการฝึกไม่ได้ ข้อมูลอาจหายเมื่อปิดแอป'],
};
export function resumeCopy(locale: Locale) {
  const [title, position, help, error] = copy[locale];
  return {title, position, help, error};
}
