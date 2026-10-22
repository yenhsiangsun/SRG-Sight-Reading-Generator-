import {ASSESSMENT_MODE_ENABLED,MEMBERSHIP_ENABLED} from './featureFlags';
import {availablePracticeMode,type PracticeMode} from './practice/practiceMode';
import {Fragment,useCallback,useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {useStudioPageMotion} from './hooks/useStudioMotion';
import {useI18n} from './i18n/context';
import {I18nProvider,LanguageSwitcher} from './i18n/I18n';
import {instrumentLabel} from './i18n/musicLabels';
import {scoreTonalityLabel} from './i18n/scoreTonality';
import {tempoSymbol,openingMeter,tempoMark,beatUnits} from './audio/tempo';
import {tempoInputRange} from './practice/tempo';
import ScoreDisplay from './components/ScoreDisplay';
import ScorePdfExport from './components/ScorePdfExport';
import PlaybackButtonLabel from './components/PlaybackButtonLabel';
import MobileInstallPrompt from './components/MobileInstallPrompt';
import ProgressStorageNotice from './components/ProgressStorageNotice';
import SetupPage from './components/SetupPage';
import AssessmentPanel from './components/AssessmentPanel';
import {useExercise} from './hooks/useExercise';
import {makeStudySnapshot,swapStudyComparison,type StudyComparison,type StudySnapshot} from './practice/studyComparison';
import {usePracticeResume} from './hooks/usePracticeResume';
import {useNativeBack} from './hooks/useNativeBack';
import {loadSoundCredits} from './native/loadSoundCredits';
import {PrivacySupportDialog} from './components/PrivacySupportDialog';
import {legalLabels} from './legal/content';
import {brand} from './brand';
import {resumeCopy} from './i18n/resumeCopy';
import {usePlayback} from './hooks/usePlayback';
import {midiToNoteLabel} from './exerciseConfig';
import StudioHome from './components/StudioHome';
import {RewardsDialog,PlansDialog,StudioDialog} from './components/StudioDialogs';
import {useProgress,usePracticeClock} from './progress/useProgress';
import {getCompanionGrowth} from './progress/companionGrowth';
import {words} from './progress/words';
import './App.css';
import './Studio.css';
import './Atelier.css';
import {useStudioPalette} from './hooks/useStudioPalette';
import {studioPaletteStyle} from './theme/studioPalettes';
import StudioPalettePicker from './components/StudioPalettePicker';
import PracticeCompanion from './components/PracticeCompanion';
import {PracticeTools,LibraryDialog} from './components/PracticeTools';
import {useLibrary} from './hooks/useLibrary';
import type {SavedStudy} from './practice/library';
import {focusSettings,selectedPracticeFocus,type PracticeFocus} from './practice/focus';
import {useTraining} from './hooks/useTraining';
import {recommendTraining} from './practice/training';
import TrainingSuggestion from './components/TrainingSuggestion';
import {useScoreFocus} from './hooks/useScoreFocus';
import './components/ScoreFocus.css';
import type {AssessmentResult} from './assessment/scoring';
import {suggestedPractice} from './practice/feedback';
import type {ExerciseData} from './music';
import LayoutSettings from './components/LayoutSettings';
import {useLayoutSize} from './hooks/useLayoutSize';
import TuningFork from './components/TuningFork';
import PracticeSettings from './components/PracticeSettings';
import './components/AtelierSetup.css';
import './components/AtelierPractice.css';
import './components/StudioMotion.css';
import './safeArea.css';
import './theme/folioFonts.css';
import './theme/ForestFolio.css';
import './theme/ForestScoreStudio.css';
import './theme/ReadingDesk.css';
import './theme/EditorialTypography.css';
import './theme/GlobalMinchoTypography.css';
import './theme/RegionalSongTypography.css';
import './theme/StudioPalette.css';
import './theme/InterfaceSizing.css';
import './theme/PracticeReadability.css';
import {forMonophonicAssessment} from './music/notePitches';
import {usesMixedStaff} from './notation/mixedStaff';
import {normalizeMixedClefs} from './notation/mixedClefs';
import {getTonalityPreview,withoutTonalityPreview} from './practice/tonalityPreview';

export default function App(){return <I18nProvider><Studio/></I18nProvider>;}
function ReadingDeskNavigation({children}:{children:ReactNode}){return <div className="practice-navigation">{children}</div>;}
function Studio(){
  const [setupStep,setSetupStep]=useState(0);
  const previewScale=getTonalityPreview(window.location.search,import.meta.env.DEV);
  const {locale,t}=useI18n();const practice=useExercise(previewScale),playback=usePlayback();
  const [bpm,setBpm]=useState(72),[page,setPage]=useState<'home'|'setup'|'practice'>(previewScale?'setup':'home'),[requestedMode,setRequestedMode]=useState<PracticeMode>('practice'),[examActive,setExamActive]=useState(false);
  const mode=availablePracticeMode(requestedMode);
  const setMode=(value:PracticeMode)=>setRequestedMode(availablePracticeMode(value));
  const growth=useProgress(import.meta.env.DEV);const w=(zh:string,en:string,ja:string)=>words(locale,zh,en,ja);
  const [dialog,setDialog]=useState<'rewards'|'plans'|'library'|'layout'|'credits'|'privacy'|'support'|'practice-settings'|null>(null);
  const [soundCredits,setSoundCredits]=useState<string|null>(null),[creditsFailed,setCreditsFailed]=useState(false);
  useEffect(()=>{
    if(dialog!=='credits')return;
    const controller=new AbortController();let closed=false;
    void loadSoundCredits(document.baseURI,import.meta.env.BASE_URL,controller.signal)
      .then(text=>{if(!closed)setSoundCredits(text);})
      .catch(()=>{if(!closed)setCreditsFailed(true);});
    return()=>{closed=true;controller.abort();};
  },[dialog]);
  const layoutSize=useLayoutSize();
  const palette=useStudioPalette();
  const paletteStyle=useMemo(()=>studioPaletteStyle(palette.id),[palette.id]);
  const collection=useLibrary();
  const training=useTraining();
  const recordTraining=training.record;
  const {focus:scoreFocused,toggle:toggleScoreFocus,size:scoreSize,changeSize:changeScoreSize,entryRef:scoreFocusEntryRef,exitRef:scoreFocusExitRef}=useScoreFocus(page==='practice');
  const [feedback,setFeedback]=useState<{exercise:ExerciseData;result:AssessmentResult|null}|null>(null);
  const [sessionBase]=useState(()=>globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));
  const {current}=practice;
  const studioRoot=useRef<HTMLDivElement>(null);
  useStudioPageMotion(studioRoot,page,current?.number);
  const [resumeIdentity,setResumeIdentity]=useState<{exercise:ExerciseData;id:string;number?:number}|null>(null);
  const sessionId=current?(resumeIdentity?.exercise===current.exercise?resumeIdentity.id:sessionBase+'-'+current.number):null;
  const studyNumber=current?(resumeIdentity?.exercise===current.exercise?resumeIdentity.number??current.number:current.number):0;
  const [comparison,setComparison]=useState<StudyComparison>({previous:null,showingPrevious:false});
  const captureCurrentStudy=()=>current&&!current.isPreview&&sessionId?makeStudySnapshot({exercise:current.exercise,settings:current.settings,bpm,id:sessionId,position:playback.getPosition(),number:studyNumber}):null;
  const rememberPrevious=(previous:StudySnapshot|null)=>setComparison({previous,showingPrevious:false});
  const resumeStudy=useMemo(()=>current&&!current.isPreview&&sessionId?{id:sessionId,bpm,exercise:current.exercise,settings:current.settings}:null,[current,sessionId,bpm]);
  const resume=usePracticeResume(resumeStudy,page==='practice'&&mode==='practice',playback.getPosition);
  const previewPending=practice.previewPending;
  const previewId=previewScale?.scaleId;
  useEffect(()=>{
    if(previewId && !previewPending) window.history.replaceState(window.history.state,'',withoutTonalityPreview(window.location.href));
  },[previewId,previewPending]);
  const addCompanionPracticeTime=growth.addPracticeTime;
  const creditCompanionTime=useCallback((seconds:number)=>addCompanionPracticeTime(growth.state.activePet,seconds),[addCompanionPracticeTime,growth.state.activePet]);
  const practiceSeconds=usePracticeClock(sessionId,page==='practice'&&(mode==='practice'||examActive)&&!dialog&&!current?.isPreview,creditCompanionTime);
  const companionStage=getCompanionGrowth(growth.state,growth.state.activePet).displayStage;
  const completed=!!sessionId&&growth.state.completedSessions.includes(sessionId);const busy=playback.status!=='idle'||examActive;
  const recordResult=useCallback((result:AssessmentResult|null)=>{if(current){setFeedback({exercise:current.exercise,result});if(result&&sessionId)recordTraining(sessionId,current.exercise,current.settings,bpm,result);}},[current,sessionId,bpm,recordTraining]);
  const advice=current?recommendTraining(training.history,current.exercise,current.settings,bpm):null;
  const assessment=mode==='test'&&feedback?.exercise===current?.exercise?feedback?.result:null;
  const testExercise=useMemo(()=>current?forMonophonicAssessment(current.exercise):null,[current]);
  const tonalHeading=scoreTonalityLabel((mode==='test'?testExercise:current?.exercise)?.tonality,locale);
  const PracticeNavigationTag=mode==='practice'?ReadingDeskNavigation:Fragment;
  const PracticeTitleTag=mode==='practice'?'p':'h1';
  const ScoreTitleTag=mode==='practice'?'h1':'h2';
  const mixedStaff=current&&usesMixedStaff(current.exercise);
  const staffLabel=current?mixedStaff
    ? `${t('mixedStaff')} · ${normalizeMixedClefs(current.exercise.mixedClefs).map(clef=>t(clef)).join(' + ')}`
    : t(current.exercise.lowerMeasures?'grand':current.exercise.clef):'';
  const generateNew=(overrides: Parameters<typeof practice.generateNew>[1] = {},previous:StudySnapshot|null=captureCurrentStudy())=>{
    const tempo=practice.generateNew(bpm,overrides);
    if(tempo!==false){setBpm(tempo);rememberPrevious(previous);}
    return tempo!==false;
  };
  const focusStudy=(focus:PracticeFocus[])=>{
    collection.clearMessage();
    const previous=captureCurrentStudy();playback.stop();
    if(generateNew(focusSettings(focus,current?.settings.measureCount),previous)){setMode('practice');setPage('practice');window.scrollTo(0,0);}
  };
  const practiceWeakness=(result:AssessmentResult)=>{
    collection.clearMessage();
    if(!current)return;
    const suggested=suggestedPractice(current.exercise,bpm,result);
    if(!suggested)return;
    const previous=captureCurrentStudy();playback.stop();
    if(generateNew({...focusSettings(suggested.mixedMeterFocus?'mixed':suggested.pitchFocus==='leaps'?'leaps':suggested.rhythmFocus,current.settings.measureCount)},previous)){setMode('practice');window.scrollTo(0,0);}
  };
  const applyPracticeSettings=(next:Parameters<typeof practice.generateFrom>[0])=>{
    if(busy)return false;
    const previous=captureCurrentStudy();collection.clearMessage();playback.stop();
    const tempo=practice.generateFrom(next,bpm);
    if(tempo===false)return false;
    setBpm(tempo);rememberPrevious(previous);setMode('practice');return true;
  };
  const applyAdvice=()=>{
    if(!current||!advice)return;const previous=captureCurrentStudy();playback.stop();
    const tempo=practice.generateFrom({...current.settings,...advice.settings},bpm,advice.tempo??bpm);
    if(tempo!==false){setBpm(tempo);rememberPrevious(previous);setMode('practice');window.scrollTo(0,0);}
  };
  const openStudy=(study:SavedStudy)=>{
    collection.clearMessage();
    if(study.exercise){setComparison({previous:null,showingPrevious:false});playback.stop();setBpm(study.bpm);setMode('practice');practice.restore(study.exercise,study.settings);setPage('practice');}
    else {const tempo=practice.generateFrom(study.settings,study.bpm,study.bpm);if(tempo!==false){setComparison({previous:null,showingPrevious:false});playback.stop();setBpm(tempo);setMode('practice');setPage('practice');}}
    setDialog(null);window.scrollTo(0,0);
  };
  const resumeLast=()=>{
    const last=resume.last;if(!last?.study.exercise)return;
    setComparison({previous:null,showingPrevious:false});playback.stop();collection.clearMessage();
    const accepted=practice.restore(last.study.exercise,last.study.settings);
    setResumeIdentity({exercise:accepted,id:last.study.id});
    setBpm(last.study.bpm);setMode('practice');
    void playback.seek(accepted,last.study.bpm,last.position);
    setPage('practice');window.scrollTo(0,0);
  };
  const restorePrevious=()=>{
    if(busy)return;
    const exchange=swapStudyComparison(comparison,captureCurrentStudy());
    if(!exchange)return;
    resume.capture();playback.stop();collection.clearMessage();
    const accepted=practice.restore(exchange.restore.exercise,exchange.restore.settings);
    setResumeIdentity({exercise:accepted,id:exchange.restore.id,number:exchange.restore.number});
    setBpm(exchange.restore.bpm);setComparison(exchange.state);setMode('practice');setPage('practice');
    void playback.seek(accepted,exchange.restore.bpm,exchange.restore.position);
    window.scrollTo(0,0);
  };
  const isSaved=!!current&&collection.library.scores.some(study=>study.bpm===bpm&&JSON.stringify(study.exercise)===JSON.stringify(current.exercise));
  const start=()=>{const previous=captureCurrentStudy();collection.clearMessage();playback.stop();if(generateNew({},previous)){setPage('practice');window.scrollTo(0,0);}};
  const settings=()=>{resume.capture();playback.stop();setSetupStep(0);setPage('setup');window.scrollTo(0,0);};
  const home=()=>{resume.capture();playback.stop();setPage('home');window.scrollTo(0,0);};
  useNativeBack({dialogOpen:dialog!==null,examActive,page,closeDialog:()=>setDialog(null),goHome:home});
  return <div ref={studioRoot} className={'app studio-app folio-edition forest-studio '+(page==='practice'?'practice-app':'setup-app')+(scoreFocused?' is-score-focused':'')} style={paletteStyle} data-colorway={palette.id} data-page={page} data-practice-mode={page==='practice'?mode:undefined} data-design="atelier" data-art-direction="forest-score-studio" data-setup-step={page==='setup'?setupStep:undefined} data-layout={layoutSize.size} data-text-size={layoutSize.textSize}><header className="header"><div className="header-content"><button className="brand" onClick={home}><span className="brand-mark" aria-hidden="true">𝄞</span><span>{brand.chinese}<span className="brand-subtitle">{brand.english}</span></span></button><nav className="studio-nav" aria-label={w('主要導覽','Main navigation','メインナビゲーション')}><button aria-current={page==='home'?'page':undefined} onClick={home}>{w('我的練習室','My studio','練習室')}</button><button disabled={examActive} onClick={()=>setDialog('library')}>☆ {t('library')}</button></nav><StudioPalettePicker value={palette.id} onChange={palette.change} warning={palette.warning}/><div className="studio-header-settings"><button className="layout-trigger" aria-haspopup="dialog" onClick={()=>setDialog('layout')}>{t('displaySettings')}</button><LanguageSwitcher/><button onClick={()=>setDialog('rewards')}>✦ {growth.state.points} {w('星點','stars','スター')}</button>{MEMBERSHIP_ENABLED&&<button className="plus-button" onClick={()=>setDialog('plans')}>Plus ↗</button>}</div></div></header>
    <MobileInstallPrompt />
    <ProgressStorageNotice warning={growth.storageWarning||training.storageWarning} conflict={growth.storageConflict||training.storageConflict} />
    {(practice.previewPending||current?.isPreview)&&<aside className="tonality-preview-notice" role="status"><span>{t('tonalityPreviewNotice')}</span><a href={withoutTonalityPreview(window.location.href)}>{t('returnRandomPractice')}</a></aside>}
    {page==='home'?<StudioHome lastPractice={resume.last} onResume={resumeLast} progress={growth.state} onStart={settings} onRewards={()=>setDialog('rewards')} onPlans={()=>setDialog('plans')}/>:page==='setup'||!current?<SetupPage initialStep={setupStep} onStepChange={setSetupStep} settings={practice.settings} change={(key,value)=>{playback.stop();practice.change(key,value);}} onStart={start} error={practice.error||playback.error}/>:
      <main className={'practice-main'+(mode==='practice'?' reading-desk':'')} id="main"><PracticeNavigationTag><div className="practice-heading"><button className="back-link" onClick={settings}>{t('backSetup')}</button>{comparison.previous&&<button className="back-link studio-previous-study" disabled={busy} onClick={restorePrevious} title={w('前一份只暫存於本次練習；想保留請收藏。','The previous study is kept for this visit. Save a favorite to keep it.','前の譜例はこの練習中だけ保持されます。残したい譜例はお気に入りへ。')}>{comparison.showingPrevious?w('回到新譜','Return to the new study','新しい譜例に戻る'):w('回看上一份','Previous study','前の譜例を見る')} <span aria-hidden="true">↔</span></button>}<span className="session-number">{w('練習','SESSION','練習')} / {String(studyNumber).padStart(2,'0')}</span></div><div className="practice-title"><div aria-hidden={mode==='practice'?true:undefined}><span className="eyebrow">TONECRAFT / SIGHT-READING</span><PracticeTitleTag>{w('你的練習室','YOUR PRACTICE ROOM','あなたの練習室')}{comparison.showingPrevious&&<small className="studio-comparison-badge">{w('回看中','Previous','前の譜例')}</small>}</PracticeTitleTag></div><div className="studio-session-actions"><button className="back-link studio-edit-trigger" disabled={busy} aria-haspopup="dialog" onClick={()=>setDialog('practice-settings')}>{t('quickSettings')}</button><details className="studio-score-actions"><summary>{w('保存與匯出','Save and export','保存と書き出し')} ↗</summary><div className="study-actions"><button className="secondary-button" disabled={examActive||isSaved} onClick={()=>collection.save({exercise:current.exercise,settings:current.settings,bpm},'scores')}>{isSaved?'★':'☆'} {t(isSaved?'savedStudy':'saveStudy')}</button><ScorePdfExport key={current.number+'-'+mode} disabled={examActive} locale={locale} exercise={mode==='test'?testExercise!:current.exercise} bpm={bpm} studyNumber={studyNumber} title={instrumentLabel(current.settings.instrument,locale)} subtitle={`${current.settings.mixedMeters?t('mixed'):current.exercise.timeSignature} · ${current.exercise.measures.length} ${t('length')} · ${staffLabel}`}/></div></details></div></div></PracticeNavigationTag>{ASSESSMENT_MODE_ENABLED&&<div className="practice-modes" role="group" aria-label={t('practice')}>{(['practice','test'] as const).map(value=><button key={value} aria-pressed={mode===value} disabled={examActive} onClick={()=>{playback.stop();setMode(value);}}>{t(value)}</button>)}</div>}
      {comparison.showingPrevious&&<p className="study-comparison-status" role="status">{w('正在回看前一份，可自行重播或收藏。','Viewing the previous study. Replay or save it when you wish.','前の譜例を表示中。再生やお気に入りへの保存ができます。')}</p>}
      {collection.message&&<p className="library-status" role="status">{t(collection.message)}</p>}
      {(practice.error||playback.error)&&<p className="error-message" role="alert">{locale==='zh-TW'?(practice.error||playback.error):t('error')}</p>}


      <section className="practice-toolbar" aria-label={t('tempo')}>{scoreFocused&&<button ref={scoreFocusExitRef} type="button" className="secondary-button focus-exit score-focus-button" aria-pressed={true} onClick={toggleScoreFocus}><svg className="score-focus-symbol" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true" focusable="false"><path d="M2 6h4V2m4 0v4h4M2 10h4v4m4 0v-4h4"/></svg><span>{t('exitFocus')}</span></button>}{mode==='practice'&&<div className="player-controls"><button className="play-main" aria-busy={playback.status==='starting'} disabled={playback.status==='starting'||(playback.status==='playing'&&playback.mode==='score')} onClick={()=>{void playback.play(current.exercise,bpm);}}><span aria-hidden="true">▶</span><PlaybackButtonLabel label={playback.status==='starting'?'loadingAudio':playback.status==='paused'?'resume':'play'}/></button><button className="icon-button" aria-label={t('pause')} disabled={playback.status!=='playing'} onClick={playback.pause}><svg className="pause-symbol" viewBox="0 0 20 20" width="18" height="18" fill="currentColor" aria-hidden="true" focusable="false"><rect x="4" y="3" width="4" height="14" rx="1"/><rect x="12" y="3" width="4" height="14" rx="1"/></svg></button><button className="icon-button" aria-label={t('stop')} disabled={!busy} onClick={playback.stop}>■</button><button className="icon-button" aria-label={t('replay')} disabled={playback.status==='starting'} onClick={()=>{void playback.replay(current.exercise,bpm);}}>↶</button></div>}
        <div className="tempo"><label htmlFor="tempo">{t('tempo')} <small>BPM · {tempoSymbol(openingMeter(current.exercise))}</small></label><input id="tempo" type="range" min={Math.min(bpm,tempoInputRange(current.exercise).min)} max={Math.max(bpm,tempoInputRange(current.exercise).max)} value={bpm} disabled={examActive||playback.status==='starting'||(playback.mode==='score'&&playback.status==='playing')} onChange={e=>{const next=Number(e.target.value);void playback.changeTempo(current.exercise,bpm,next);setBpm(next);}}/><output htmlFor="tempo">{bpm}</output></div><button className="studio-next-score secondary-button" disabled={busy} onClick={start}>{t('newExercise')} <span aria-hidden="true">↗</span></button>
        </section>


      {mode!=='practice'&&<AssessmentPanel exercise={testExercise!} bpm={bpm} onNext={start} onActive={setExamActive} onResult={recordResult} onPracticeWeakness={practiceWeakness}/>}
      <div className="score-utility-bar"><div className="studio-secondary-controls"><TuningFork key={current.number+'-'+mode} disabled={examActive || playback.status==='starting' || playback.status==='playing'}/>{mode==='practice'&&<div className="metronome-control"><div><strong>{t('metronome')}</strong><small>{t('downbeat')}</small></div><button className="switch" role="switch" aria-label={t('metronome')} aria-checked={playback.metronome} disabled={playback.status==='starting'} onClick={()=>playback.toggleMetronome(current.exercise,bpm)}><span/></button></div>}</div><div className="score-focus-controls">{!scoreFocused&&<button ref={scoreFocusEntryRef} type="button" className="secondary-button score-focus-button" aria-pressed={false} onClick={toggleScoreFocus}><svg className="score-focus-symbol" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true" focusable="false"><path d="M6 2H2v4m8-4h4v4M2 10v4h4m8-4v4h-4"/></svg><span>{t('focusScore')}</span></button>}<label>{t('scoreSize')}<input type="range" min="0.8" max="1.5" step="0.05" value={scoreSize} onChange={e=>changeScoreSize(+e.target.value)}/><output>{Math.round(scoreSize*100)}%</output></label></div></div><section className="score-card" aria-labelledby="score-heading"><div className="score-top"><div><span className="score-kicker">{w('視譜練習','SIGHT-READING STUDY','初見演奏の練習')} / {String(studyNumber).padStart(2,'0')}{mode==='practice'&&comparison.showingPrevious&&<small className="studio-comparison-badge">{w('回看中','Previous','前の譜例')}</small>}</span><ScoreTitleTag id="score-heading">{instrumentLabel(current.settings.instrument,locale)}</ScoreTitleTag><p>{current.settings.mixedMeters?t('mixed'):current.exercise.timeSignature} <span>·</span> {current.exercise.measures.length} {t('length')}</p>{tonalHeading&&<p className="score-tonality">{tonalHeading}</p>}</div><div className="score-info"><strong>{`♩ = ${bpm*beatUnits(openingMeter(current.exercise))/4}`}</strong><span className={mixedStaff?"mixed-clef-summary":undefined}>{staffLabel}</span><span>{midiToNoteLabel(current.settings.rangeMinMidi)} — {midiToNoteLabel(current.settings.rangeMaxMidi)}</span></div></div><div className="score-scroll" tabIndex={0} role="region" aria-label={t('score')}><ScoreDisplay key={current.number} size={scoreSize} exercise={mode==='test'?testExercise!:current.exercise} bpm={bpm} assessment={assessment} playback={mode==='practice'?{status:playback.status,mode:playback.mode,getPosition:playback.getPosition,onSeek:seconds=>{void playback.seek(current.exercise,bpm,seconds);}}:undefined}/></div><div className="score-bottom"><span>{t(({Beginner:'beginner',Intermediate:'intermediate',Advanced:'advanced'} as const)[current.settings.difficulty])}</span><span>{t('transpose')}: {current.exercise.transposition??0}</span></div></section><section className="studio-practice-tools" aria-label={w('練習工具與設定','Settings and practice tools','練習ツールと設定')}><PracticeSettings key={`settings-${current.number}`} settings={current.settings} busy={busy} onApply={applyPracticeSettings}/>{mode==='practice'&&<PracticeTools key={`tools-${current.number}`} busy={busy} focus={selectedPracticeFocus(current.settings)} onFocus={focusStudy} onSavePreset={()=>collection.save({settings:current.settings,bpm},'presets')}/>}<details className="studio-assistant"><summary>{w('一起練習的小夥伴','Your practice companion','練習の仲間')}</summary><TrainingSuggestion advice={advice} busy={busy} onApply={applyAdvice}/><PracticeCompanion exercise={current.exercise} pet={growth.state.activePet} stage={companionStage} playing={playback.status==='playing'||playback.status==='starting'} metronomeOnly={playback.mode==='metronome'} examActive={examActive} completed={completed}/></details></section><ProgressStorageNotice inline warning={growth.storageWarning||training.storageWarning} conflict={growth.storageConflict||training.storageConflict}/>{mode==='practice'&&<section className="practice-checkout"><div className="checkout-icon" aria-hidden="true">✦</div><div><strong>{completed?t('practiceCompletedTitle'):w('給這段練習，一個小小的肯定。','Give your practice a little recognition.','練習した自分に、小さなごほうび。')}</strong><p>{completed?w('同一份譜可繼續練習，不會重複計點。','Keep revisiting this study; rewards are counted once.','この譜例は何度でも練習できます。ポイントは1回分です。'):w('前景練習滿 60 秒後，自行確認完成。每日前 3 次獲得星點。','After 60 seconds in the foreground, confirm your practice. Earn stars for the first 3 each day.','画面を開いて60秒練習後、完了を記録。毎日最初の3回でスター獲得。')}</p></div><button className="secondary-button" disabled={completed||practiceSeconds<60||busy} onClick={()=>{if(sessionId && practiceSeconds>=60 && !busy && !completed)growth.complete(sessionId);}}>{completed?'✓ '+w('已完成','Completed','完了'):practiceSeconds<60?practiceSeconds+' / 60 '+w('秒','sec','秒'):w('完成練習','Complete practice','練習を完了')}</button></section>}<p className="practice-footnote">{t('tempoHelp')}</p></main>}
    {dialog==='layout'&&<LayoutSettings {...layoutSize} onClose={()=>setDialog(null)}/>}
    {dialog==='practice-settings'&&current&&<StudioDialog title={t('quickSettings')} onClose={()=>setDialog(null)}><div className="studio-settings-dialog"><div className="studio-settings-current"><span>{instrumentLabel(current.settings.instrument,locale)} · {tempoMark(current.exercise,bpm)}</span><button className="secondary-button" disabled={isSaved} onClick={()=>collection.save({exercise:current.exercise,settings:current.settings,bpm},'scores')}>{isSaved?'★':'☆'} {t(isSaved?'savedStudy':'saveStudy')}</button></div>{collection.message&&<p className="library-status" role="status">{t(collection.message)}</p>}<PracticeSettings key={`dialog-settings-${current.number}`} settings={current.settings} busy={busy} expanded error={practice.error} onApply={next=>{if(!applyPracticeSettings(next))return false;setDialog(null);return true;}}/></div></StudioDialog>}
    {dialog==='library'&&<LibraryDialog library={collection.library} message={collection.message} onOpen={openStudy} onRemove={collection.remove} onClose={()=>setDialog(null)}/>}
    {(dialog==='privacy'||dialog==='support')&&<PrivacySupportDialog kind={dialog} onClose={()=>setDialog(null)}/>}
    {dialog==='credits'&&<StudioDialog title={t('soundCredits')} onClose={()=>setDialog(null)}>{creditsFailed?<p className="error-message" role="alert">{t('error')}</p>:<pre aria-busy={soundCredits===null} style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',font:'inherit'}}>{soundCredits??'…'}</pre>}</StudioDialog>}
    {(resume.readWarning||resume.storageWarning)&&<p className="storage-note" role="status">{resume.readWarning?resumeCopy(locale).unreadable:resumeCopy(locale).error}</p>}
    {dialog==='rewards'&&<RewardsDialog progress={growth.state} onRedeem={growth.redeem} onResetPet={growth.resetPet} onSelectStage={growth.selectStage} onGrantPreviewPoints={growth.grantPreviewPoints} onClose={()=>setDialog(null)}/>} {MEMBERSHIP_ENABLED&&dialog==='plans'&&<PlansDialog onClose={()=>setDialog(null)}/>}<footer className="privacy-support-footer"><div className="privacy-support-links"><button type="button" aria-haspopup="dialog" disabled={examActive} onClick={()=>setDialog('privacy')}>{legalLabels[locale].privacy}</button><button type="button" aria-haspopup="dialog" disabled={examActive} onClick={()=>setDialog('support')}>{legalLabels[locale].support}</button><a href={`${import.meta.env.BASE_URL}samples/CREDITS.txt`} aria-haspopup="dialog" onClick={event=>{event.preventDefault();setSoundCredits(null);setCreditsFailed(false);setDialog('credits');}}>{t('soundCredits')}</a></div><span>{brand.displayName} / {w('音樂練習室','PRACTICE STUDIO','練習スタジオ')}</span><span>{t('intro')}</span></footer></div>;
}
