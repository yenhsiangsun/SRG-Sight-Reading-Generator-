import {LocalizationContext as Context,useI18n} from './context';
import {useEffect,useState,type ReactNode} from 'react';
import {translate,type Locale} from './messages';
import {resolveLocale} from './localePreference';
import './localeTypography.css';

const localeOptions: Array<{value: Locale; label: string}> = [
  {value:'zh-TW', label:'繁體中文'},
  {value:'zh-CN', label:'简体中文'},
  {value:'en', label:'English'},
  {value:'ja', label:'日本語'},
  {value:'es', label:'Español'},
  {value:'de', label:'Deutsch'},
  {value:'fr', label:'Français'},
  {value:'ko', label:'한국어'},
  {value:'th', label:'ไทย'},
  {value:'pt-BR', label:'Português (BR)'},
  {value:'ru', label:'Русский'},
  {value:'it', label:'Italiano'},
];

export function I18nProvider({children}:{children:ReactNode}) {
  const [locale,setLocale]=useState<Locale>(()=>{
    let saved: string | null = null;
    try{saved=localStorage.getItem('sight-reading-language');}catch{/* private browsing */}
    return resolveLocale(saved, [...(navigator.languages ?? []), navigator.language]);
  });
  useEffect(()=>{document.documentElement.lang=locale;try{localStorage.setItem('sight-reading-language',locale);}catch{/* persistence is optional */}},[locale]);
  return <Context.Provider value={{locale,setLocale,t:key=>translate(locale,key)}}>{children}</Context.Provider>;
}
export function LanguageSwitcher(){const {locale,setLocale,t}=useI18n();return <label className="language-switch">{t('language')}<select value={locale} onChange={e=>setLocale(e.target.value as Locale)}>{localeOptions.map(option=><option value={option.value} key={option.value}>{option.label}</option>)}</select></label>;}
