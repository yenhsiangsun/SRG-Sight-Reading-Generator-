import type {Locale} from '../i18n/messages';

const copy: Record<Locale, readonly [string, string, string, string]> = {
  'zh-TW': ['選擇小精靈畫風', '經典原版', '點選即套用，隨時可切換，不需要星點。', '雲朵布偶貓'],
  en: ['Choose an art style', 'Classic', 'Tap to apply. Switch anytime, with no stars needed.', 'Cloud Ragdoll'],
  ja: ['小さな仲間の絵柄', 'クラシック', 'タップで変更。スター不要でいつでも戻せます。', 'ふわ雲ラグドール'],
  es: ['Elige el estilo', 'Clásico', 'Toca para aplicar. Cambia cuando quieras, sin estrellas.', 'Ragdoll Nube'],
  de: ['Zeichenstil wählen', 'Klassisch', 'Antippen zum Anwenden. Jederzeit kostenlos wechseln.', 'Wolken-Ragdoll'],
  fr: ['Choisir un style', 'Classique', 'Touchez pour appliquer. Changez librement, sans étoiles.', 'Ragdoll Nuage'],
  ko: ['친구 그림체 선택', '기존 스타일', '눌러서 적용해요. 별 없이 언제든 바꿀 수 있어요.', '구름 랙돌'],
  'pt-BR': ['Escolha o estilo', 'Clássico', 'Toque para aplicar. Troque quando quiser, sem estrelas.', 'Ragdoll Nuvem'],
  ru: ['Выберите стиль', 'Классический', 'Нажмите, чтобы применить. Меняйте в любое время без звёзд.', 'Облачный рэгдолл'],
  it: ['Scegli lo stile', 'Classico', 'Tocca per applicare. Cambia quando vuoi, senza stelle.', 'Ragdoll Nuvola'],
  'zh-CN': ['选择小精灵画风', '经典原版', '点选即应用，随时可切换，不需要星点。', '云朵布偶猫'],
  th: ['เลือกรูปแบบเพื่อนตัวน้อย', 'แบบดั้งเดิม', 'แตะเพื่อใช้ เปลี่ยนได้ทุกเมื่อโดยไม่ต้องใช้ดาว', 'แมวแร็กดอลล์ก้อนเมฆ'],
};
const storybookNames: Record<Locale, string> = {
  'zh-TW': '森林手繪', en: 'Forest storybook', ja: '森の絵本', es: 'Cuento del bosque',
  de: 'Waldmärchen', fr: 'Conte de la forêt', ko: '숲속 그림책', 'pt-BR': 'Conto da floresta',
  ru: 'Лесная сказка', it: 'Fiaba del bosco', 'zh-CN': '森林手绘', th: 'นิทานป่า',
};
export function companionDesignCopy(locale: Locale) {
  const [heading, classic, help, ragdoll] = copy[locale];
  return {heading, classic, storybook: storybookNames[locale], help, ragdoll};
}
