import {useId, type Dispatch, type SetStateAction} from 'react';
import {useI18n} from '../i18n/context';
import type {MessageKey} from '../i18n/messages';
import {themePresets, type ThemeColors, type ThemeColorKey} from '../theme/theme';
import {StudioDialog} from './StudioDialogs';
import './ThemeSettings.css';

const presetLabels: Record<string, MessageKey> = {
  forest: 'themeForest', ocean: 'themeOcean', lavender: 'themeLavender',
  rose: 'themeRose', sand: 'themeSand', midnight: 'themeMidnight',
};
const colorFields: Array<[ThemeColorKey, MessageKey]> = [
  ['primary', 'primaryColor'], ['accent', 'accentColor'],
  ['background', 'backgroundColor'], ['surface', 'surfaceColor'],
];

function ColorField({label, value, onChange}: {label: string; value: string; onChange: (value: string) => void}) {
  const {t}=useI18n();
  const id=useId();
  return <div className="theme-color-field">
    <label htmlFor={id}>{label}</label>
    <div className="theme-color-input-wrap">
      <input id={id} type="color" value={value} onChange={e=>onChange(e.target.value)}/>
      <input key={value} type="text" defaultValue={value.toUpperCase()} aria-label={`${label} · ${t('hexColor')}`}
        maxLength={7} spellCheck={false} autoComplete="off" autoCapitalize="off"
        onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}
        onBlur={e=>{
          const next=e.target.value.trim();
          if(/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(next))onChange(next);
          else e.target.value=value.toUpperCase();
        }}/>
    </div>
  </div>;
}

export default function ThemeSettings({theme,setTheme,resetTheme,storageWarning,onClose}: {
  theme: ThemeColors; setTheme: Dispatch<SetStateAction<ThemeColors>>;
  resetTheme: () => void; storageWarning: boolean; onClose: () => void;
}) {
  const {t}=useI18n();
  return <StudioDialog title={t('theme')} onClose={onClose}>
    <div className="theme-settings">
      <p className="theme-description">{t('themeHelp')}</p>
      <fieldset className="theme-preset-section">
        <legend>{t('themePresets')}</legend>
        <div className="theme-presets">
          {themePresets.map(preset=>{
            const active=colorFields.every(([key])=>theme[key]===preset.colors[key]);
            return <button key={preset.id} className="theme-preset" aria-pressed={active} onClick={()=>setTheme(preset.colors)}>
              <span className="theme-preset-preview" style={{background:preset.colors.background}} aria-hidden="true">
                <span className="theme-preset-paper" style={{background:preset.colors.surface}}>
                  <i style={{background:preset.colors.primary}}/><i style={{background:preset.colors.accent}}/>
                </span>
              </span>
              <span className="theme-preset-name">{t(presetLabels[preset.id])}<span aria-hidden="true">{active?'✓':''}</span></span>
            </button>;
          })}
        </div>
      </fieldset>
      <fieldset className="theme-custom-section">
        <legend>{t('customColors')}</legend>
        <div className="theme-picker-grid">{colorFields.map(([key,label])=><ColorField key={key} label={t(label)} value={theme[key]} onChange={value=>setTheme(prev=>({...prev,[key]:value}))}/>)}</div>
        <p className="theme-description">{t('themeContrastHelp')}</p>
      </fieldset>
      <div className="theme-settings-footer">
        <p role="status">{t(storageWarning?'themeSaveWarning':'themeSaved')}</p>
        <button className="secondary-button" onClick={resetTheme}>{t('resetTheme')}</button>
        <button className="primary-button" onClick={onClose}>{t('themeDone')}</button>
      </div>
    </div>
  </StudioDialog>;
}
