import {useEffect,useRef} from 'react';
import {useI18n} from '../i18n/context';
import {words} from '../progress/words';
import {STUDIO_PALETTES,STUDIO_PALETTE_IDS,type StudioPaletteId} from '../theme/studioPalettes';
import './StudioPalettePicker.css';

export default function StudioPalettePicker({value,onChange,warning=false}:{value:StudioPaletteId;onChange:(id:StudioPaletteId)=>void;warning?:boolean}){
  const {locale}=useI18n();
  const w=(zh:string,en:string,ja:string)=>words(locale,zh,en,ja);
  const menu=useRef<HTMLDetailsElement>(null);
  const names={wood:w('暖木','Warm wood','木の温もり'),linen:w('亞麻','Linen','リネン'),blue:w('霧藍','Mist blue','霧のブルー'),forest:w('森林綠','Forest','森の緑')};
  useEffect(()=>{
    const outside=(event:PointerEvent)=>{if(event.target instanceof Node&&!menu.current?.contains(event.target))menu.current?.removeAttribute('open');};
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&menu.current?.open){menu.current.open=false;menu.current.querySelector('summary')?.focus();}};
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
  },[]);
  return <details className="studio-palette-picker" ref={menu}>
    <summary aria-label={w('色系','Colors','色合い')} title={`${w('色系','Colors','色合い')} · ${names[value]}`}>
      <span className="studio-palette-current" aria-hidden="true"/><span className="studio-palette-label">{w('色系','Colors','色合い')}</span>
    </summary>
    <div className="studio-palette-panel">
      <p>{w('柔和色系','Soft colors','やさしい色合い')}</p>
      <div role="group" aria-label={w('選擇色系','Choose colors','色合いを選ぶ')}>
        {STUDIO_PALETTE_IDS.map(id=><button type="button" key={id} aria-pressed={value===id} onClick={()=>{onChange(id);if(menu.current)menu.current.open=false;menu.current?.querySelector('summary')?.focus();}}>
          <span className="studio-palette-swatch" style={{background:STUDIO_PALETTES[id].background,borderColor:STUDIO_PALETTES[id].primary}} aria-hidden="true"><i style={{background:STUDIO_PALETTES[id].primary}}/></span>
          <span>{names[id]}</span><span aria-hidden="true">{value===id?'✓':''}</span>
        </button>)}
      </div>
      {warning&&<small role="status">{w('此裝置暫時無法記住選擇','This device cannot save your choice right now','この端末では選択を保存できません')}</small>}
    </div>
  </details>;
}
