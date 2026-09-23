import type {Locale} from './messages';
import {additionalText} from './additionalText';
import {companionText} from './companionText';
import {namedCatalogs} from './namedCatalogs';

export const textCatalog = {...additionalText, ...companionText};
const extraLocales = ['es', 'de', 'fr', 'ko', 'pt-BR', 'ru', 'it'];

export function localizeEnglish(locale: Locale, source: string): string {
  const named = namedCatalogs[locale];
  if (named) {
    if (named.text[source]) return named.text[source];
    const name = source.replace(/^(?:Pet|Metronome pet): /, '');
    if (name !== source) return `${named.text.Companion} · ${named.text[name] ?? name}`;
    return source;
  }
  const index = extraLocales.indexOf(locale);
  if (index < 0) return source;
  const translated = textCatalog[source]?.[index];
  if (translated) return translated;
  // Reward titles combine the same translated name used by the equipped pet.
  const name = source.replace(/^(?:Pet|Metronome pet): /, '');
  if (name !== source) return `${textCatalog.Companion[index]} · ${textCatalog[name]?.[index] ?? name}`;
  return source;
}
