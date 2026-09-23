import type {Locale} from './messages';
import type {LocaleCatalog} from './catalogTypes';
import {simplifiedChinese} from './zhCN';
import {thai} from './th';

export const namedCatalogs: Partial<Record<Locale, LocaleCatalog>> = {
  'zh-CN': simplifiedChinese,
  th: thai,
};
