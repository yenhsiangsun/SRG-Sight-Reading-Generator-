import {useRef,useState} from 'react';
import {useI18n} from '../i18n/context';
import {instrumentLabel,scaleLabel} from '../i18n/musicLabels';
import {getScale} from '../music/scales';
import {tempoMark} from '../audio/tempo';
import {practiceFocusMessage,selectedPracticeFocus,togglePracticeFocus,type PracticeFocus} from '../practice/focus';
import type {Library, LibraryMessage, SavedStudy} from '../practice/library';
import {StudioDialog} from './StudioDialogs';
import {normalizeMixedClefs} from '../notation/mixedClefs';
import {searchLibrary} from '../practice/librarySearch';
import './PracticeTools.css';
import './LibraryFolio.css';
import './PracticeWorksheet.css';

export function PracticeTools({busy,focus,onFocus,onSavePreset}:{
  busy:boolean;focus:PracticeFocus[];
  onFocus:(focus:PracticeFocus[])=>void;onSavePreset:()=>void;
}) {
  const {t}=useI18n();
  const [selected,setSelected]=useState(focus);
  return <details className="practice-tools"><summary>{t('practiceTools')}{!focus.includes('balanced')&&<span className="tool-active"> · {focus.map(value=>t(practiceFocusMessage[value])).join(' + ')}</span>}</summary>
    <div className="practice-tools-content">
    <section><h3>{t('focusPractice')}</h3><div className="focus-options" role="group" aria-label={t('focusPractice')}>{(['balanced','sixteenths','dotted','triplets','offbeats','scales','leaps','mixed'] as const).map(value=><button key={value} aria-pressed={selected.includes(value)} disabled={busy} onClick={()=>setSelected(previous=>togglePracticeFocus(previous,value))}><span aria-hidden="true">{{balanced:'♩',sixteenths:'♬',dotted:'♪·',triplets:'3',offbeats:'↗',scales:'↗↘',leaps:'↕',mixed:'↔'}[value]}</span>{t(practiceFocusMessage[value])}</button>)}</div><p>{t('multiFocusHelp')}</p>{selected.includes('scales')&&<p>{t('focusScalesHelp')}</p>}{selected.includes('triplets')&&<p>{t(selected.includes('mixed')?'tripletMixedHelp':'focusTripletHelp')}</p>}{selected.includes('mixed')&&<p>{t('focusMixedHelp')}</p>}<button className="secondary-button" disabled={busy} onClick={()=>onFocus(selected)}>{t('newExercise')} →</button></section></div>
    <div className="tools-footer"><button className="back-link" disabled={busy} onClick={onSavePreset}>{t('savePreset')}</button></div>
  </details>;
}

export function LibraryDialog({library,message,onOpen,onRemove,onClose}:{library:Library;message?:LibraryMessage|null;onOpen:(study:SavedStudy)=>void;onRemove:(id:string,kind:'scores'|'presets')=>void;onClose:()=>void}) {
  const {t,locale}=useI18n();const [tab,setTab]=useState<'scores'|'presets'>('scores');
  const [query,setQuery]=useState('');
  const searchField=useRef<HTMLInputElement>(null);
  const matches=searchLibrary(library[tab],query,locale);
  const protectedRead=message==='libraryReadProtected'||message==='libraryReadUnavailable';
  const failure=message==='libraryError'||message==='libraryFull'||message==='libraryInvalidScore'||protectedRead?message:null;
  const levels={Beginner:'beginner',Intermediate:'intermediate',Advanced:'advanced'} as const;
  const rhythms={Simple:'simple',Moderate:'moderate',Complex:'complex'} as const;
  return <StudioDialog title={t('library')} onClose={onClose}><section className="library-folio">
    <span className="library-folio-kicker" aria-hidden="true">TONECRAFT / THE MUSIC SHELF</span>
    <div className="practice-modes library-folio-tabs">{(['scores','presets'] as const).map(kind=><button key={kind} aria-pressed={tab===kind} onClick={()=>setTab(kind)}>{t(kind==='scores'?'savedScores':'savedPresets')} <span>{String(library[kind].length).padStart(2,'0')}</span></button>)}</div>
    {failure&&<p className="error-message" role="alert">{t(failure)}</p>}
    {(library[tab].length>0||query!=='')&&<div className="library-find"><label htmlFor="library-search">{t('searchLibrary')}</label><div className="library-find-field"><input ref={searchField} id="library-search" type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder={t('librarySearchHint')}/>{query&&<button type="button" className="back-link" onClick={()=>{setQuery('');searchField.current?.focus();}}>{t('clearInstrumentSearch')}</button>}</div><p role="status" aria-live="polite" aria-atomic="true">{t('librarySearchResults').replace('{count}',String(matches.length)).replace('{total}',String(library[tab].length))}</p></div>}
    {library[tab].length>0&&matches.length===0&&<p className="library-find-empty">{t('librarySearchEmpty')}</p>}
    <div className="library-list">{library[tab].length===0?<div className="library-empty"><svg viewBox="0 0 64 60" width="64" height="60" fill="none" aria-hidden="true"><path d="M32 50V13C23 7 14 7 5 10V46C14 43 23 44 32 50ZM32 50C41 44 50 43 59 46V10C50 7 41 7 32 13M12 18C17 17 23 18 27 20M12 25C17 24 23 25 27 27M39 20C43 18 49 17 54 18M39 27C43 25 49 24 54 25" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg><span>{t(protectedRead?'libraryUnavailableEmpty':tab==='presets'?'libraryPresetEmpty':'libraryEmpty')}</span></div>:matches.map(study=>{
      const index=library[tab].indexOf(study);
      const name=instrumentLabel(study.settings.instrument,locale);
      const created=new Date(study.created);
      const timestamp=created.toLocaleString(locale,{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'});
      const identity=`${name} · ${timestamp}`;
      const date=created.toLocaleDateString(locale,{year:'numeric',month:'short',day:'numeric'});
      const tonality=study.exercise?.tonality;
      const scale=tonality?getScale(tonality.scaleId):null;
      const staff=study.settings.clef==='mixedStaff'
        ? `${t('mixedStaff')} · ${normalizeMixedClefs(study.exercise?.mixedClefs??study.settings.mixedClefs).map(clef=>t(clef)).join(' + ')}`
        : t(study.settings.clef);
      return <article key={study.id}><span className="library-folio-index" aria-hidden="true">{String(index+1).padStart(2,'0')}</span><div className="library-folio-entry"><h3>{name}</h3>
        <p className="library-tonality">{tonality&&scale?<>{tonality.tonic&&<b>{tonality.tonic} <span aria-hidden="true">/</span> </b>}{scaleLabel(scale.id,scale.label,locale)}</>:staff}</p>
        <dl className="library-score-facts"><div><dt>{t('meter')}</dt><dd>{study.settings.mixedMeters?t('mixed'):study.settings.timeSignature}</dd></div><div><dt>{t('length')}</dt><dd>{study.exercise?.measures.length??study.settings.measureCount}</dd></div><div><dt>{t('tempo')}</dt><dd>{study.exercise?tempoMark(study.exercise,study.bpm):`${study.bpm} BPM`}</dd></div></dl>
        <p className="library-challenge"><span>{t('pitchDifficulty')} <strong>{t(levels[study.settings.difficulty])}</strong></span><span>{t('rhythm')} <strong>{t(rhythms[study.settings.rhythmLevel])}</strong></span></p>
        <small className="library-reading-detail">{tonality&&<>{staff} · </>}{selectedPracticeFocus(study.settings).map(value=>t(practiceFocusMessage[value])).join(' + ')}</small>
        <div className="library-entry-footer"><time title={timestamp} dateTime={Number.isFinite(created.getTime())?created.toISOString():undefined}>{date}</time><div className="library-actions"><button className="secondary-button library-open" aria-label={`${t('openStudy')}: ${identity}`} onClick={()=>onOpen(study)}>{t('openStudy')} <span aria-hidden="true">↗</span></button><button className="back-link" disabled={protectedRead} aria-label={`${t('removeStudy')}: ${identity}`} onClick={()=>onRemove(study.id,tab)}>{t('removeStudy')}</button></div></div></div></article>;
    })}</div>
    <p className="library-note">{t('libraryLocal')}</p>
    </section>
  </StudioDialog>;
}
