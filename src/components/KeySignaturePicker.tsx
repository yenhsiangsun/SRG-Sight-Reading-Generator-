import {useId} from 'react';
import {useI18n} from '../i18n/context';
import {keySignatureLabels} from '../i18n/keySignatureLabels';
import {FLAT_SIGNATURES, SHARP_SIGNATURES, normalizeKeySignatureChoices, type KeySignatureChoice} from '../music/keySignatureChoices';
import './KeySignaturePicker.css';

export function KeySignaturePicker({value,onChange,disabled=false}:{
  value?: readonly KeySignatureChoice[];
  onChange:(value:KeySignatureChoice[]|undefined)=>void;
  disabled?:boolean;
}) {
  const {locale}=useI18n(), copy=keySignatureLabels(locale), id=useId();
  const selected=normalizeKeySignatureChoices(value);
  const toggle=(choice:KeySignatureChoice)=>{
    if(disabled)return;
    if(!selected)onChange([choice]);
    else if(selected.includes(choice)) {
      // Retain the last explicit choice; Automatic is a separate, deliberate action.
      if(selected.length>1)onChange(selected.filter(item=>item!==choice));
    } else onChange(normalizeKeySignatureChoices([...selected,choice]));
  };
  const chip=(choice:KeySignatureChoice,label:string,detail?:string)=><button
    key={choice} type="button" className="key-signature-chip" aria-pressed={selected?.includes(choice)??false}
    aria-disabled={selected?.length===1&&selected[0]===choice?true:undefined}
    onClick={()=>toggle(choice)}>
    <strong>{label}</strong>{detail&&<small>{detail.replaceAll('#','♯').replaceAll('b','♭')}</small>}
  </button>;
  return <fieldset className="key-signature-picker" disabled={disabled} aria-describedby={`${id}-help`}>
    <legend>{copy.title}</legend>
    <p id={`${id}-help`} className="field-note">{copy.help}</p>
    <div className="key-signature-primary">
      <button type="button" className="key-signature-auto" aria-pressed={!selected} onClick={()=>onChange(undefined)}>{copy.all}</button>
      {chip('C',copy.none,'C')}
    </div>
    {([[SHARP_SIGNATURES,'♯',copy.sharps],[FLAT_SIGNATURES,'♭',copy.flats]] as const).map(([signatures,symbol,label])=>
      <div key={symbol} className="key-signature-row" role="group" aria-label={label}>
        <span className="key-signature-row-label">{label}</span>
        <div className="key-signature-grid">{signatures.map((signature,index)=>chip(signature,`${index+1}${symbol}`,signature))}</div>
      </div>)}
    <div className="key-signature-open">{chip('open',copy.open)}<p className="field-note">{copy.openHelp}</p></div>
  </fieldset>;
}
