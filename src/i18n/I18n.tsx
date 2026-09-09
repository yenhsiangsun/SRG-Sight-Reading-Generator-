import {LocalizationContext as Context,useI18n} from './context';
import {useEffect,useState,type ReactNode} from 'react';
import {locales,translate,type Locale} from './messages';
export function I18nProvider({children}:{children:ReactNode}) {
  const [locale,setLocale]=useState<Locale>(()=>{
    try{const saved=localStorage.getItem('sight-reading-language') as Locale;if(locales.includes(saved))return saved;}catch{/* private browsing */}
    return navigator.language.startsWith('zh')?'zh-TW':navigator.language.startsWith('ja')?'ja':'en';
  });
  useEffect(()=>{document.documentElement.lang=locale;try{localStorage.setItem('sight-reading-language',locale);}catch{/* persistence is optional */}},[locale]);
  return <Context.Provider value={{locale,setLocale,t:key=>translate(locale,key)}}>{children}</Context.Provider>;
}
export function LanguageSwitcher(){const {locale,setLocale,t}=useI18n();return <label className="language-switch">{t('language')}<select value={locale} onChange={e=>setLocale(e.target.value as Locale)}><option value="zh-TW">繁體中文</option><option value="en">English</option><option value="ja">日本語</option></select></label>;}
