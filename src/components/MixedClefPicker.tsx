import {useId} from 'react';
import type {Clef} from '../music';
import {useI18n} from '../i18n/context';
import {MIXED_STAFF_CLEFS,normalizeMixedClefs} from '../notation/mixedClefs';
import './MixedClefPicker.css';

export function MixedClefPicker({value,onChange,disabled=false}:{
  value?:readonly Clef[];
  onChange:(value:Clef[])=>void;
  disabled?:boolean;
}){
  const {t}=useI18n(),id=useId(),selected=normalizeMixedClefs(value);
  const toggle=(clef:Clef)=>{
    if(disabled)return;
    if(selected.includes(clef)){
      if(selected.length>2)onChange(selected.filter(item=>item!==clef));
    }else onChange(normalizeMixedClefs([...selected,clef]));
  };
  return <fieldset className="mixed-clef-picker" disabled={disabled} aria-describedby={`${id}-help`}>
    <legend>{t('mixedClefsTitle')}</legend>
    <p id={`${id}-help`} className="field-note">{t('mixedClefsHelp')}</p>
    <div className="mixed-clef-options">
      {MIXED_STAFF_CLEFS.map(clef=><button key={clef} type="button" className="mixed-clef-option"
        aria-pressed={selected.includes(clef)}
        aria-disabled={selected.length===2&&selected.includes(clef)?true:undefined}
        onClick={()=>toggle(clef)}>
        <span aria-hidden="true">{selected.includes(clef)?'✓':'＋'}</span>{t(clef)}
      </button>)}
    </div>
  </fieldset>;
}
