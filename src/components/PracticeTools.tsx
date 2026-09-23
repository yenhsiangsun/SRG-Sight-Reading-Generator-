import {useState} from 'react';
import {useI18n} from '../i18n/context';
import {instrumentLabel} from '../i18n/musicLabels';
import type {RhythmFocus} from '../practice/focus';
import type {Library, SavedStudy} from '../practice/library';
import {StudioDialog} from './StudioDialogs';
import './PracticeTools.css';

export function PracticeTools({measures,busy,looping,focus,onLoop,onFocus,onSavePreset}:{
  measures:number;busy:boolean;looping:boolean;focus:RhythmFocus;
  onLoop:(first:number,last:number)=>void;onFocus:(focus:RhythmFocus)=>void;onSavePreset:()=>void;
}) {
  const {t}=useI18n();
  const [first,setFirst]=useState(1),[last,setLast]=useState(Math.min(2,measures));
  const [selected,setSelected]=useState(focus);
  return <details className="practice-tools"><summary>{t('practiceTools')}{focus!=='balanced'&&<span className="tool-active"> · {t(focus==='sixteenths'?'focusSixteenths':'focusDotted')}</span>}{looping&&<span className="tool-active"> ↻ {t('loopActive')}</span>}</summary>
    <div className="practice-tools-content"><section><h3>{t('loopBars')}</h3><div className="loop-fields">
      <label>{t('firstBar')}<select value={first} disabled={busy} onChange={e=>{const n=+e.target.value;setFirst(n);setLast(Math.max(n,last));}}>{Array.from({length:measures},(_,i)=><option key={i} value={i+1}>{i+1}</option>)}</select></label>
      <span aria-hidden="true">—</span><label>{t('lastBar')}<select value={last} disabled={busy} onChange={e=>setLast(+e.target.value)}>{Array.from({length:measures-first+1},(_,i)=><option key={i} value={i+first}>{i+first}</option>)}</select></label>
      <button className="secondary-button" disabled={busy} onClick={()=>onLoop(first,last)}>↻ {t('startLoop')}</button>
    </div><p>{t('loopHelp')}</p></section>
    <section><h3>{t('focusPractice')}</h3><div className="focus-options" role="group" aria-label={t('focusPractice')}>{(['balanced','sixteenths','dotted'] as const).map(value=><button key={value} aria-pressed={selected===value} disabled={busy} onClick={()=>setSelected(value)}><span aria-hidden="true">{value==='balanced'?'♩':value==='sixteenths'?'♬':'♪·'}</span>{t(value==='balanced'?'focusBalanced':value==='sixteenths'?'focusSixteenths':'focusDotted')}</button>)}</div><p>{t('focusHelp')}</p><button className="secondary-button" disabled={busy} onClick={()=>onFocus(selected)}>{t('newExercise')} →</button></section></div>
    <div className="tools-footer"><button className="back-link" disabled={busy} onClick={onSavePreset}>{t('savePreset')}</button></div>
  </details>;
}

export function LibraryDialog({library,onOpen,onRemove,onClose}:{library:Library;onOpen:(study:SavedStudy)=>void;onRemove:(id:string,kind:'scores'|'presets')=>void;onClose:()=>void}) {
  const {t,locale}=useI18n();const [tab,setTab]=useState<'scores'|'presets'>('scores');
  return <StudioDialog title={t('library')} onClose={onClose}><div className="practice-modes">{(['scores','presets'] as const).map(kind=><button key={kind} aria-pressed={tab===kind} onClick={()=>setTab(kind)}>{t(kind==='scores'?'savedScores':'savedPresets')} · {library[kind].length}</button>)}</div>
    <p className="library-note">{t('libraryLocal')}</p><div className="library-list">{library[tab].length===0?<p className="library-empty">☆<span>{t('libraryEmpty')}</span></p>:library[tab].map(study=><article key={study.id}><div><h3>{instrumentLabel(study.settings.instrument,locale)}</h3><p>{study.settings.mixedMeters?t('mixed'):study.settings.timeSignature} · {study.exercise?.measures.length??study.settings.measureCount} {t('length')} · {study.bpm} BPM</p><small>{t(study.settings.clef)} · {t(study.settings.rhythmFocus==='sixteenths'?'focusSixteenths':study.settings.rhythmFocus==='dotted'?'focusDotted':'focusBalanced')} · {new Date(study.created).toLocaleDateString(locale)}</small></div><div className="library-actions"><button className="secondary-button" onClick={()=>onOpen(study)}>{t('openStudy')}</button><button className="back-link" onClick={()=>onRemove(study.id,tab)}>{t('removeStudy')}</button></div></article>)}</div>
  </StudioDialog>;
}
