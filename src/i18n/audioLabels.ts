import {localeOrder, type Locale} from './messages';
import {INSTRUMENTS, type Instrument} from '../music/instruments';
import {instrumentLabel} from './musicLabels';

const sourceNames: Record<string, readonly string[]> = {
  Harmonica: ['口琴','Harmonica','ハーモニカ','Armónica','Mundharmonika','Harmonica','하모니카','Gaita','Губная гармошка','Armonica','口琴','ฮาร์โมนิกา'],
  'Hammered Dulcimer': ['西洋揚琴','Hammered dulcimer','ハンマーダルシマー','Dulcémele de martillos','Hackbrett','Dulcimer à marteaux','해머드 덜시머','Dulcimer de martelos','Цимбалы','Salterio a percussione','西洋扬琴','ขิมแบบตะวันตก'],
  Vibraphone: ['鐵琴','Vibraphone','ヴィブラフォン','Vibráfono','Vibraphon','Vibraphone','비브라폰','Vibrafone','Вибрафон','Vibrafono','颤音琴','ไวบราโฟน'],
};
const substituteNames = ['替代錄音音色','Recorded substitute','代用楽器の録音','Grabación de instrumento sustituto','Aufnahme eines Ersatzinstruments','Instrument de remplacement enregistré','대체 악기 녹음','Gravação de instrumento substituto','Запись заменяющего инструмента','Registrazione di strumento sostitutivo','替代录音音色','เสียงบันทึกเครื่องดนตรีทดแทน'];

export function audioSourceLabel(source: string, locale: Locale): string {
  if (Object.hasOwn(INSTRUMENTS, source)) return instrumentLabel(source as Instrument, locale);
  return sourceNames[source]?.[localeOrder.indexOf(locale)] ?? source;
}

export function recordedSubstituteLabel(locale: Locale): string {
  return substituteNames[localeOrder.indexOf(locale)];
}
