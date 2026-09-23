import {layoutSizes, type useLayoutSize} from '../hooks/useLayoutSize';
import {useI18n} from '../i18n/context';
import {StudioDialog} from './StudioDialogs';
import './LayoutSettings.css';

export default function LayoutSettings({size,change,warning,onClose}:ReturnType<typeof useLayoutSize>&{onClose:()=>void}){
  const {t}=useI18n();
  return <StudioDialog title={t('layoutSize')} onClose={onClose}>
    <p className="layout-description">{t('layoutHelp')}</p>
    <div className="layout-choices" role="group" aria-label={t('layoutSize')}>
      {layoutSizes.map(value=><button key={value} className="layout-choice" aria-pressed={size===value} onClick={()=>change(value)}>
        <span className={'layout-preview layout-preview-'+value} aria-hidden="true"><i/><i/><i/></span>
        <strong>{t(value==='compact'?'layoutCompact':value==='standard'?'layoutStandard':'layoutComfortable')}</strong>
        <span aria-hidden="true">{size===value?'✓':'○'}</span>
      </button>)}
    </div>
    <p className="layout-description" role="status">{t(warning?'layoutSaveWarning':'layoutSaved')}</p>
    <button className="primary-button" onClick={onClose}>{t('themeDone')}</button>
  </StudioDialog>;
}
