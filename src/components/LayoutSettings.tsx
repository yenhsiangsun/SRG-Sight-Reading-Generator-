import {layoutSizes,textSizes,type useLayoutSize} from '../hooks/useLayoutSize';
import {useI18n} from '../i18n/context';
import {StudioDialog} from './StudioDialogs';
import './LayoutSettings.css';

export default function LayoutSettings({size,change,textSize,changeText,warning,onClose}:ReturnType<typeof useLayoutSize>&{onClose:()=>void}){
  const {t}=useI18n();
  return <StudioDialog title={t('displaySettings')} onClose={onClose}>
    <p className="layout-description">{t('displayHelp')}</p>
    <fieldset className="display-setting-group"><legend>{t('layoutSpacing')}</legend>
    <div className="layout-choices">
      {layoutSizes.map(value=><button key={value} className="layout-choice" aria-pressed={size===value} onClick={()=>change(value)}>
        <span className={'layout-preview layout-preview-'+value} aria-hidden="true"><i/><i/><i/></span>
        <strong>{t(value==='compact'?'layoutCompact':value==='standard'?'layoutStandard':'layoutComfortable')}</strong>
        <span aria-hidden="true">{size===value?'✓':'○'}</span>
      </button>)}
    </div>
    </fieldset>
    <fieldset className="display-setting-group"><legend>{t('textSize')}</legend>
      <div className="text-size-choices">
        {textSizes.map(value=><button key={value} className="text-size-choice" aria-pressed={textSize===value} onClick={()=>changeText(value)}>{t(value==='auto'?'textFollowLayout':value==='standard'?'textStandard':value==='large'?'textLarge':'textExtraLarge')}</button>)}
      </div>
    </fieldset>
    <p className="display-type-preview">{t('displayPreview')}</p>
    <p className="layout-description" role="status">{t(warning?'layoutSaveWarning':'displaySaved')}</p>
    <button className="primary-button" onClick={onClose}>{t('themeDone')}</button>
  </StudioDialog>;
}
