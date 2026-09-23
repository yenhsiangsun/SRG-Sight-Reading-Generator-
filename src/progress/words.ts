import type {Locale} from '../i18n/messages';
import {localizeEnglish} from '../i18n/localizeText';
export function words(locale:Locale, zh:string, en:string, ja:string):string{
  return locale==='zh-TW' ? zh
    : locale==='ja' ? ja
    : localizeEnglish(locale, en);
}
