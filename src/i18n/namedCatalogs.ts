import type {Locale} from './messages';
import type {LocaleCatalog} from './catalogTypes';
import {simplifiedChinese} from './zhCN';
import {thai} from './th';
import {folioNamed} from './folioText';

export const namedCatalogs: Partial<Record<Locale, LocaleCatalog>> = {
  'zh-CN': {...simplifiedChinese,text:{...simplifiedChinese.text,...folioNamed('zh-CN')}},
  th: {...thai,text:{...thai.text,...folioNamed('th')}},
};
