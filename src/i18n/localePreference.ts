import {locales, type Locale} from './messages';

/** A saved manual choice wins; otherwise use the first supported browser language. */
export function resolveLocale(saved: string | null, browserLanguages: readonly string[]): Locale {
  if (saved && locales.includes(saved as Locale)) return saved as Locale;
  for (const language of browserLanguages) {
    const [base, ...parts] = language.toLowerCase().replaceAll('_', '-').split('-');
    if (base === 'zh') {
      // An explicit script takes precedence over region (e.g. zh-Hant-CN).
      if (parts.includes('hant')) return 'zh-TW';
      if (parts.includes('hans')) return 'zh-CN';
      return parts.some(part => part === 'cn' || part === 'sg') ? 'zh-CN' : 'zh-TW';
    }
    if (base === 'pt') return 'pt-BR';
    if (locales.includes(base as Locale)) return base as Locale;
  }
  return 'en';
}
