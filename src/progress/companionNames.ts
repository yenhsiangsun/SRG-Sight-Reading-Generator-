import type {PetCompanion} from './progress';
import type {Locale} from '../i18n/messages';
import {words} from './words';

const names: Record<PetCompanion | 'original', readonly [string, string, string]> = {
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

export function companionName(pet: PetCompanion | null, locale: Locale): string {
  const [zh, en, ja] = names[pet ?? 'original'];
  return words(locale, zh, en, ja);
}
