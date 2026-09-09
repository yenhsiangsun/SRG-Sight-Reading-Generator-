import {createContext,useContext} from 'react';
import {translate,type Locale,type MessageKey} from './messages';
export const LocalizationContext=createContext<{locale:Locale;setLocale:(locale:Locale)=>void;t:(key:MessageKey)=>string}>({locale:'zh-TW',setLocale:()=>{},t:key=>translate('zh-TW',key)});
export const useI18n=()=>useContext(LocalizationContext);
