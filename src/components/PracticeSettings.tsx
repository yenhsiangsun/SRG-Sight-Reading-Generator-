import {useState} from 'react';
import type {ExerciseSettings} from '../hooks/useExercise';
import {CLEFS,INSTRUMENTS,midiToNoteLabel,RANGE_OPTIONS} from '../exerciseConfig';
import {useI18n} from '../i18n/context';
import {StaffRangePicker} from './StaffRangePicker';
import {KeySignaturePicker} from './KeySignaturePicker';
import {MixedClefPicker} from './MixedClefPicker';
import './PracticeSettings.css';
import {keySignatureLabels} from '../i18n/keySignatureLabels';

/** Draft edits stay local until generation succeeds; the visible score and its
 * playback/settings snapshot always describe the same exercise. */
export default function PracticeSettings({settings,busy,onApply,expanded=false,error=''}:{
  settings:ExerciseSettings;busy:boolean;onApply:(settings:ExerciseSettings)=>boolean;expanded?:boolean;error?:string;
}){
  const {t,locale}=useI18n();
  const [draft,setDraft]=useState(()=>({...settings}));
  const [open,setOpen]=useState(expanded);
  const change=<K extends keyof ExerciseSettings>(key:K,value:ExerciseSettings[K])=>{
    if(!busy)setDraft(previous=>({...previous,[key]:value}));
  };
  const twoHands=draft.clef==='grand'&&['Piano','Yangqin'].includes(draft.instrument);
  const invalid=twoHands&&(draft.rangeMinMidi>58||draft.rangeMaxMidi<61);
  const profile=INSTRUMENTS[draft.instrument];
  const levels={Beginner:'beginner',Intermediate:'intermediate',Advanced:'advanced'} as const;
  return <details className="practice-settings" open={open} onToggle={event=>setOpen(event.currentTarget.open)}>
    <summary>{t('quickSettings')}<span>{midiToNoteLabel(settings.rangeMinMidi)}–{midiToNoteLabel(settings.rangeMaxMidi)} · {t(levels[settings.difficulty])}</span></summary>
    {open&&<div className="practice-settings-content">
      <p className="field-note">{t('quickSettingsHelp')}</p>
      <fieldset disabled={busy}>
        <div className="practice-setting-fields practice-setting-fields--primary">
          <label>{t('pitchDifficulty')}<select value={draft.difficulty} onChange={e=>change('difficulty',e.target.value as ExerciseSettings['difficulty'])}>{(['Beginner','Intermediate','Advanced'] as const).map(level=><option key={level} value={level}>{t(levels[level])}</option>)}</select></label>
          <label>{t('rhythm')}<select value={draft.rhythmLevel} onChange={e=>change('rhythmLevel',e.target.value as ExerciseSettings['rhythmLevel'])}>{(['Simple','Moderate','Complex'] as const).map(level=><option key={level} value={level}>{t(({Simple:'simple',Moderate:'moderate',Complex:'complex'} as const)[level])}</option>)}</select></label>
        </div>
        <details className="practice-settings-advanced">
        <summary>{t('rangeStaff')} · {keySignatureLabels(locale).title}<span>{midiToNoteLabel(draft.rangeMinMidi)}–{midiToNoteLabel(draft.rangeMaxMidi)}</span></summary>
        <div className="practice-setting-fields practice-setting-fields--staff"><label>{t('rangeStaff')}<select value={draft.clef} onChange={e=>change('clef',e.target.value as ExerciseSettings['clef'])}>{CLEFS.map(clef=><option key={clef} value={clef}>{t(clef)}</option>)}</select></label></div>
        {draft.clef==='mixedStaff'&&<MixedClefPicker value={draft.mixedClefs} onChange={value=>change('mixedClefs',value)} disabled={busy}/>}
        <KeySignaturePicker value={draft.allowedKeySignatures} onChange={value=>change('allowedKeySignatures',value)} disabled={busy}/>
        <StaffRangePicker settings={draft} disabled={busy} onMin={value=>change('rangeMinMidi',value)} onMax={value=>change('rangeMaxMidi',value)}/>
        <div className="practice-setting-fields">
          <label>{t('minimum')}<select value={draft.rangeMinMidi} onChange={e=>change('rangeMinMidi',+e.target.value)}>{RANGE_OPTIONS.filter(midi=>midi<draft.rangeMaxMidi).map(midi=><option key={midi} value={midi}>{midiToNoteLabel(midi)}</option>)}</select></label>
          <label>{t('maximum')}<select value={draft.rangeMaxMidi} onChange={e=>change('rangeMaxMidi',+e.target.value)}>{RANGE_OPTIONS.filter(midi=>midi>draft.rangeMinMidi).map(midi=><option key={midi} value={midi}>{midiToNoteLabel(midi)}</option>)}</select></label>
          <label className="practice-chromatic"><input type="checkbox" checked={draft.allowAccidentals} onChange={e=>change('allowAccidentals',e.target.checked)}/>{t('chromatic')}</label>
        </div>
        <p className="field-note">{t('pitchDifficultyHelp')}</p>
        </details>
        {(draft.rangeMinMidi<profile.min||draft.rangeMaxMidi>profile.max)&&<p className="validation-note">{t('outside')}</p>}
        {invalid&&<p className="validation-note" role="alert">{t('grandRangeRequired')}</p>}
        {error&&<p className="error-message" role="alert">{locale==='zh-TW'?error:t('error')}</p>}
        <button className={'secondary-button'+(expanded?' studio-apply-settings':'')} disabled={invalid||busy} onClick={()=>{if(onApply(draft))setOpen(false);}}>{t('applyPracticeSettings')}</button>
      </fieldset>
    </div>}
  </details>;
}
