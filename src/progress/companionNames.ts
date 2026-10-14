import type {PetCompanion} from './progress';
import type {Locale} from '../i18n/messages';
import {words} from './words';
import {companionDesignCopy} from './companionDesignCopy';

const names: Record<PetCompanion | 'original', readonly [string, string, string]> = {
  'pet-mainecoon': ['森林緬因貓', 'Forest Maine Coon', '森のメインクーン'],
  'pet-calico': ['花花三花貓', 'Calico Cat', '三毛ねこ'],
  'pet-orange': ['暖陽橘貓', 'Sunshine Ginger Cat', 'ひだまり茶トラ'],
  'pet-bluecat': ['霧藍貓', 'Misty Blue Cat', '霧色ブルーねこ'],
  'pet-husky': ['雪原哈士奇', 'Snowfield Husky', '雪原ハスキー'],
  'pet-shiba': ['小日柴犬', 'Little Sunshine Shiba', 'ひなた柴犬'],
  'pet-poodle': ['棉花貴賓犬', 'Cotton Poodle', 'わた雲プードル'],
  'pet-ragdoll': ['雲朵布偶貓', 'Cloud Ragdoll', 'ふわ雲ラグドール'],
  "pet-dragon": ["暮光幼龍","Twilight Dragon","夕暮れのちびドラゴン"],
  "pet-snowbird": ["北海道雪糰","Hokkaido Snowbird","シマエナガ"],
  "pet-kiwi": ["紐西蘭奇異鳥","New Zealand Kiwi","ニュージーランドのキーウィ"],
  "pet-blackbear": ["台灣黑熊","Taiwan Black Bear","台湾ツキノワグマ"],
  "pet-otter": ["河畔水獺","River Otter","川辺のカワウソ"],
  "pet-kangaroo": ["澳洲袋鼠","Australian Kangaroo","オーストラリアのカンガルー"],
  "pet-lion": ["暖陽獅子","Sunshine Lion","ひだまりライオン"],
  original: ['拍米', 'Mimo', 'ミモ'],
  'pet-celeste': ['雲雀', 'Lark', 'ひばり'],
  'pet-musicfox': ['音狐', 'Music Fox', 'ミュージックフォックス'],
  'pet-lily': ['狸子', 'Raccoon', 'タヌキ'],
  'pet-moonrabbit': ['月兔', 'Moon Bunny', '月うさぎ'],
  "pet-nocturne": ["銀紋美短貓","American Shorthair","アメリカンショートヘア"],
  'pet-bamboo': ['竹音熊貓', 'Bamboo Panda', '竹音パンダ'],
  "pet-penguin": ["藍拍企鵝","Little Blue Penguin","コガタペンギン"],
};

const newPets = ['pet-mainecoon', 'pet-calico', 'pet-orange', 'pet-bluecat', 'pet-husky', 'pet-shiba', 'pet-poodle'] as const;
const newNames: Record<Locale, readonly string[]> = {
  'zh-TW': ['森林緬因貓','花花三花貓','暖陽橘貓','霧藍貓','雪原哈士奇','小日柴犬','棉花貴賓犬'],
  en: ['Forest Maine Coon','Calico Cat','Sunshine Ginger Cat','Misty Blue Cat','Snowfield Husky','Little Sunshine Shiba','Cotton Poodle'],
  ja: ['森のメインクーン','三毛ねこ','ひだまり茶トラ','霧色ブルーねこ','雪原ハスキー','ひなた柴犬','わた雲プードル'],
  es: ['Maine Coon del Bosque','Gata Tricolor','Gato Naranja Soleado','Gato Azul de Niebla','Husky de las Nieves','Shiba Solecito','Caniche de Algodón'],
  de: ['Wald-Maine-Coon','Dreifarbige Katze','Sonnige Rote Katze','Nebelblaue Katze','Schneefeld-Husky','Sonnenschein-Shiba','Wattepudel'],
  fr: ['Maine Coon de la Forêt','Chatte Tricolore','Chat Roux Soleil','Chat Bleu Brume','Husky des Neiges','Shiba Petit Soleil','Caniche Coton'],
  ko: ['숲속 메인쿤','삼색 고양이','햇살 치즈 고양이','안개빛 블루 고양이','설원 허스키','햇살 시바견','솜뭉치 푸들'],
  'pt-BR': ['Maine Coon da Floresta','Gata Tricolor','Gato Laranja Ensolarado','Gato Azul da Névoa','Husky da Neve','Shiba Solzinho','Poodle Algodão'],
  ru: ['Лесной мейн-кун','Трёхцветная кошка','Солнечный рыжий кот','Туманно-голубая кошка','Снежный хаски','Солнечный сиба-ину','Пудель-облачко'],
  it: ['Maine Coon del Bosco','Gatta Tricolore','Gatto Rosso Sole','Gatto Blu Nebbia','Husky delle Nevi','Shiba Sole','Barboncino di Cotone'],
  'zh-CN': ['森林缅因猫','花花三花猫','暖阳橘猫','雾蓝猫','雪原哈士奇','小日柴犬','棉花贵宾犬'],
  th: ['แมวเมนคูนแห่งป่า','แมวสามสี','แมวส้มแสงแดด','แมวสีเทาฟ้าสายหมอก','ฮัสกี้ทุ่งหิมะ','ชิบะน้อยแสงแดด','พุดเดิ้ลปุยฝ้าย'],
};

export function companionName(pet: PetCompanion | null, locale: Locale): string {
  const newIndex = newPets.findIndex(id => id === pet);
  if (newIndex >= 0) return newNames[locale][newIndex];
  if (pet === 'pet-ragdoll') return companionDesignCopy(locale).ragdoll;
  const [zh, en, ja] = names[pet ?? 'original'];
  return words(locale, zh, en, ja);
}
