import {useCallback,useEffect,useMemo,useState} from 'react';
import {useI18n} from './i18n/context';
import {I18nProvider,LanguageSwitcher} from './i18n/I18n';
import {instrumentLabel} from './i18n/musicLabels';
import {hasSamples} from './audio/createPlaybackInstrument';
import {tempoSymbol,openingMeter,tempoMark} from './audio/tempo';
import {tempoInputRange} from './practice/tempo';
import ScoreDisplay from './components/ScoreDisplay';
import ScorePdfExport from './components/ScorePdfExport';
import MobileInstallPrompt from './components/MobileInstallPrompt';
import SetupPage from './components/SetupPage';
import AssessmentPanel from './components/AssessmentPanel';
import {useExercise} from './hooks/useExercise';
import {usePlayback} from './hooks/usePlayback';
import {midiToNoteLabel} from './exerciseConfig';
import StudioHome from './components/StudioHome';
import {RewardsDialog,PlansDialog} from './components/StudioDialogs';
import {useProgress,usePracticeClock} from './progress/useProgress';
import {words} from './progress/words';
import './App.css';
import './Studio.css';
import {useTheme} from './theme/useTheme';
import {themeStyleFromState} from './theme/theme';
import ThemeSettings from './components/ThemeSettings';
import PracticeCompanion from './components/PracticeCompanion';
import {PracticeTools,LibraryDialog} from './components/PracticeTools';
import {useLibrary} from './hooks/useLibrary';
import type {SavedStudy} from './practice/library';
import type {RhythmFocus} from './practice/focus';
import type {AssessmentResult} from './assessment/scoring';
import {suggestedPractice} from './practice/feedback';
import type {ExerciseData} from './music';
import LayoutSettings from './components/LayoutSettings';
import {useLayoutSize} from './hooks/useLayoutSize';
import TuningFork from './components/TuningFork';
import {forMonophonicAssessment} from './music/notePitches';
import {usesMixedStaff} from './notation/mixedStaff';
import {getTonalityPreview,withoutTonalityPreview} from './practice/tonalityPreview';

export default function App(){return <I18nProvider><Studio/></I18nProvider>;}
function Studio(){
  const previewScale=getTonalityPreview(window.location.search,import.meta.env.DEV);
  const {locale,t}=useI18n();const practice=useExercise(previewScale),playback=usePlayback();
  const [bpm,setBpm]=useState(72),[page,setPage]=useState<'home'|'setup'|'practice'>(previewScale?'setup':'home'),[mode,setMode]=useState<'practice'|'test'>('practice'),[examActive,setExamActive]=useState(false);
  const growth=useProgress(import.meta.env.DEV);const w=(zh:string,en:string,ja:string)=>words(locale,zh,en,ja);
  const [dialog,setDialog]=useState<'rewards'|'plans'|'theme'|'library'|'layout'|null>(null);
  const appearance=useTheme();
  const layoutSize=useLayoutSize();
  const collection=useLibrary();
  const [feedback,setFeedback]=useState<{exercise:ExerciseData;result:AssessmentResult|null}|null>(null);
  const [sessionBase]=useState(()=>globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));
  const {current}=practice;const sessionId=current?sessionBase+'-'+current.number:null;
  const previewPending=practice.previewPending;
  const previewId=previewScale?.scaleId;
  useEffect(()=>{
    if(previewId && !previewPending) window.history.replaceState(window.history.state,'',withoutTonalityPreview(window.location.href));
  },[previewId,previewPending]);
  const practiceSeconds=usePracticeClock(sessionId,page==='practice'&&mode==='practice'&&!dialog);
  const completed=!!sessionId&&growth.state.completedSessions.includes(sessionId);const busy=playback.status!=='idle'||examActive;
  const themeStyle=useMemo(()=>themeStyleFromState(appearance.theme),[appearance.theme]);
  const recordResult=useCallback((result:AssessmentResult|null)=>{if(current)setFeedback({exercise:current.exercise,result});},[current]);
  const assessment=mode==='test'&&feedback?.exercise===current?.exercise?feedback?.result:null;
  const testExercise=useMemo(()=>current?forMonophonicAssessment(current.exercise):null,[current]);
  const staffLabel=current? t(usesMixedStaff(current.exercise)?'mixedStaff':current.exercise.lowerMeasures?'grand':current.exercise.clef):'';
  const generateNew=(overrides: Parameters<typeof practice.generateNew>[1] = {})=>{
    const tempo=practice.generateNew(bpm,overrides);
    if(tempo!==false)setBpm(tempo);
    return tempo!==false;
  };
  const focusStudy=(rhythmFocus:RhythmFocus)=>{
    collection.clearMessage();
    playback.stop();
    if(generateNew({rhythmFocus})){setMode('practice');setPage('practice');window.scrollTo(0,0);}
  };
  const practiceWeakness=(result:AssessmentResult)=>{
    collection.clearMessage();
    if(!current)return;
    const suggested=suggestedPractice(current.exercise,bpm,result);
    if(!suggested)return;
    playback.stop();
    if(generateNew({rhythmFocus:suggested.rhythmFocus,...(suggested.target==='pitch'?{rhythmLevel:'Simple' as const}:{})})){setMode('practice');window.scrollTo(0,0);}
  };
  const openStudy=(study:SavedStudy)=>{
    collection.clearMessage();
    playback.stop();setBpm(study.bpm);setMode('practice');
    if(study.exercise){practice.restore(study.exercise,study.settings);setPage('practice');}
    else {const tempo=practice.generateFrom(study.settings,bpm);if(tempo!==false){setBpm(tempo);setPage('practice');}}
    setDialog(null);window.scrollTo(0,0);
  };
  const isSaved=!!current&&collection.library.scores.some(study=>study.bpm===bpm&&JSON.stringify(study.exercise)===JSON.stringify(current.exercise));
  const start=()=>{collection.clearMessage();playback.stop();if(generateNew()){setPage('practice');window.scrollTo(0,0);}};
  const settings=()=>{playback.stop();setPage('setup');window.scrollTo(0,0);};
  const home=()=>{playback.stop();setPage('home');window.scrollTo(0,0);};
  const status=t(playback.status==='starting'?'loadingAudio':playback.status==='playing'?(playback.mode==='metronome'?'clicking':'playing'):playback.status==='paused'?'paused':'ready');
  return <div className={'app studio-app '+(page==='practice'?'practice-app':'setup-app')} style={themeStyle} data-layout={layoutSize.size}><header className="header"><div className="header-content"><button className="brand" onClick={home}><span className="brand-mark" aria-hidden="true">𝄞</span><span>Sight Reading<span className="brand-subtitle">{w('音樂練習室','PRACTICE STUDIO','練習スタジオ')}</span></span></button><nav className="studio-nav" aria-label={w('主要導覽','Main navigation','メインナビゲーション')}><button aria-current={page==='home'?'page':undefined} onClick={home}>{w('我的練習室','My studio','練習室')}</button><button disabled={examActive} onClick={()=>setDialog('library')}>☆ {t('library')}</button><button onClick={()=>setDialog('rewards')}>✦ {growth.state.points} <span>{w('星點','stars','スター')}</span></button></nav><div className="header-tools"><button className="layout-trigger" aria-haspopup="dialog" onClick={()=>setDialog('layout')}>{t('layoutSize')}</button><button className="theme-trigger" aria-label={t('theme')} title={t('theme')} aria-haspopup="dialog" onClick={()=>setDialog('theme')}><span className="theme-trigger-swatch" aria-hidden="true"/><span className="theme-trigger-label">{t('theme')}</span></button><LanguageSwitcher/><button className="plus-button" onClick={()=>setDialog('plans')}>Plus <span>↗</span></button></div></div></header>
    <MobileInstallPrompt />
    {(practice.previewPending||current?.isPreview)&&<aside className="tonality-preview-notice" role="status"><span>{t('tonalityPreviewNotice')}</span><a href={withoutTonalityPreview(window.location.href)}>{t('returnRandomPractice')}</a></aside>}
    {page==='home'?<StudioHome progress={growth.state} onStart={settings} onRewards={()=>setDialog('rewards')} onPlans={()=>setDialog('plans')}/>:page==='setup'||!current?<SetupPage settings={practice.settings} change={(key,value)=>{playback.stop();practice.change(key,value);}} onStart={start} error={practice.error||playback.error}/>:
      <main className="practice-main" id="main"><div className="practice-heading"><button className="back-link" onClick={settings}>{t('backSetup')}</button><span className="session-number">{w('練習','SESSION','練習')} / {String(current.number).padStart(2,'0')}</span></div><div className="practice-title"><div><span className="eyebrow">{w('你的練習室','YOUR PRACTICE ROOM','あなたの練習室')}</span><h1>{t('practiceTitle')}</h1></div><div className="study-actions"><button className="secondary-button" disabled={examActive||isSaved} onClick={()=>collection.save({exercise:current.exercise,settings:current.settings,bpm},'scores')}>{isSaved?'★':'☆'} {t(isSaved?'savedStudy':'saveStudy')}</button><ScorePdfExport key={current.number+'-'+mode} disabled={examActive} exercise={mode==='test'?testExercise!:current.exercise} bpm={bpm} studyNumber={current.number} title={instrumentLabel(current.settings.instrument,locale)} subtitle={`${current.settings.mixedMeters?t('mixed'):current.exercise.timeSignature} · ${current.exercise.measures.length} ${t('length')} · ${staffLabel}`}/><button className="secondary-button" disabled={examActive} onClick={start}>{t('newExercise')}</button></div></div><div className="practice-modes" role="group" aria-label={t('practice')}>{(['practice','test'] as const).map(value=><button key={value} aria-pressed={mode===value} disabled={examActive} onClick={()=>{playback.stop();setMode(value);}}>{t(value)}</button>)}</div>
      {collection.message&&<p className="library-status" role="status">{t(collection.message)}</p>}
      {(practice.error||playback.error)&&<p className="error-message" role="alert">{locale==='zh-TW'?(practice.error||playback.error):t('error')}</p>}
      <PracticeCompanion exercise={current.exercise} pet={growth.state.activePet} playing={playback.status==='playing'||playback.status==='starting'} metronomeOnly={playback.mode==='metronome'} examActive={examActive} completed={completed}/>
      <section className="practice-toolbar" aria-label={t('tempo')}>{mode==='practice'&&<div className="player-controls"><button className="play-main" disabled={playback.status==='starting'||(playback.status==='playing'&&playback.mode==='score')} onClick={()=>{void playback.play(current.exercise,bpm);}}><span aria-hidden="true">▶</span>{t(playback.status==='paused'?'resume':'play')}</button><button className="icon-button" aria-label={t('pause')} disabled={playback.status!=='playing'} onClick={playback.pause}>Ⅱ</button><button className="icon-button" aria-label={t('stop')} disabled={!busy} onClick={playback.stop}>■</button><button className="icon-button" aria-label={t('replay')} disabled={playback.status==='starting'} onClick={()=>{void playback.replay(current.exercise,bpm);}}>↶</button></div>}
        <TuningFork key={current.number+'-'+mode} disabled={examActive || playback.status==='starting' || playback.status==='playing'}/><div className="tempo"><label htmlFor="tempo">{t('tempo')} <small>BPM · {tempoSymbol(openingMeter(current.exercise))}</small></label><input id="tempo" type="range" min={Math.min(bpm,tempoInputRange(current.exercise).min)} max={Math.max(bpm,tempoInputRange(current.exercise).max)} value={bpm} disabled={examActive||playback.status==='starting'||(playback.mode==='score'&&playback.status==='playing')} onChange={e=>{const next=Number(e.target.value);void playback.changeTempo(current.exercise,bpm,next);setBpm(next);}}/><output htmlFor="tempo">{bpm}</output></div>
        {mode==='practice'&&<div className="metronome-control"><div><strong>{t('metronome')}</strong><small>{t('downbeat')}</small></div><button className="switch" role="switch" aria-label={t('metronome')} aria-checked={playback.metronome} disabled={playback.status==='starting'} onClick={()=>playback.toggleMetronome(current.exercise,bpm)}><span/></button></div>}</section>
      {mode==='practice'&&<PracticeTools key={current.number} measures={current.exercise.measures.length} busy={busy} looping={playback.isLooping()} focus={current.settings.rhythmFocus??'balanced'} onLoop={(first,last)=>{void playback.playLoop(current.exercise,bpm,first,last);}} onFocus={focusStudy} onSavePreset={()=>collection.save({settings:current.settings,bpm},'presets')}/>}
      {mode==='practice'?<><p className="timbre-caption">{t('sound')}: {instrumentLabel(current.settings.instrument,locale)} · {t(hasSamples(current.settings.instrument)?'recorded':'synthetic')}</p><div className="playback-caption"><span className={'playback-status '+(playback.status==='playing'?'active':'')} role="status"><i aria-hidden="true"/>{playback.isLooping()&&playback.status==='playing'?t('loopActive'):status}</span></div></>:<AssessmentPanel exercise={testExercise!} bpm={bpm} onNext={start} onActive={setExamActive} onResult={recordResult} onPracticeWeakness={practiceWeakness}/>}
      <section className="score-card" aria-labelledby="score-heading"><div className="score-top"><div><span className="score-kicker">{w('視譜練習','SIGHT-READING STUDY','初見演奏の練習')} / {String(current.number).padStart(2,'0')}</span><h2 id="score-heading">{instrumentLabel(current.settings.instrument,locale)}</h2><p>{current.settings.mixedMeters?t('mixed'):current.exercise.timeSignature} <span>·</span> {current.exercise.measures.length} {t('length')}</p></div><div className="score-info"><strong>{tempoMark(current.exercise,bpm)}</strong><span>{staffLabel}</span><span>{midiToNoteLabel(current.settings.rangeMinMidi)} — {midiToNoteLabel(current.settings.rangeMaxMidi)}</span></div></div><div className="score-scroll" tabIndex={0} role="region" aria-label={t('score')}><ScoreDisplay key={current.number} exercise={mode==='test'?testExercise!:current.exercise} bpm={bpm} assessment={assessment} playback={mode==='practice'?{status:playback.status,mode:playback.mode,getPosition:playback.getPosition,onSeek:seconds=>{void playback.seek(current.exercise,bpm,seconds);}}:undefined}/></div><div className="score-bottom"><span>{t(({Beginner:'beginner',Intermediate:'intermediate',Advanced:'advanced'} as const)[current.settings.difficulty])}</span><span>{t('transpose')}: {current.exercise.transposition??0}</span></div></section>{mode==='practice'&&<section className="practice-checkout"><div className="checkout-icon" aria-hidden="true">✦</div><div><strong>{completed?w('這次練習，已經收進成長紀錄。','A little progress, recorded.','今回の練習を記録しました。'):w('給這段練習，一個小小的肯定。','Give your practice a little recognition.','練習した自分に、小さなごほうび。')}</strong><p>{completed?w('同一份譜可繼續練習，不會重複計點。','Keep revisiting this study; rewards are counted once.','この譜例は何度でも練習できます。ポイントは1回分です。'):w('前景練習滿 60 秒後，自行確認完成。每日前 3 次獲得星點。','After 60 seconds in the foreground, confirm your practice. Earn stars for the first 3 each day.','画面を開いて60秒練習後、完了を記録。毎日最初の3回でスター獲得。')}</p></div><button className="secondary-button" disabled={completed||practiceSeconds<60||busy} onClick={()=>{if(sessionId && practiceSeconds>=60 && !busy && !completed)growth.complete(sessionId);}}>{completed?'✓ '+w('已完成','Completed','完了'):practiceSeconds<60?practiceSeconds+' / 60 '+w('秒','sec','秒'):w('完成練習','Complete practice','練習を完了')}</button></section>}<p className="practice-footnote">{t('tempoHelp')}</p></main>}
    {dialog==='layout'&&<LayoutSettings {...layoutSize} onClose={()=>setDialog(null)}/>}
    {dialog==='library'&&<LibraryDialog library={collection.library} onOpen={openStudy} onRemove={collection.remove} onClose={()=>setDialog(null)}/>}
    {growth.storageWarning&&<p className="storage-note" role="status">{w('此瀏覽器無法保存成長紀錄，關閉後可能遺失。','This browser cannot save progress; it may be lost when closed.','このブラウザでは記録を保存できません。')}</p>}{dialog==='theme'&&<ThemeSettings {...appearance} onClose={()=>setDialog(null)}/>} {dialog==='rewards'&&<RewardsDialog progress={growth.state} onRedeem={growth.redeem} onResetPet={growth.resetPet} onGrantPreviewPoints={growth.grantPreviewPoints} onClose={()=>setDialog(null)}/>} {dialog==='plans'&&<PlansDialog onClose={()=>setDialog(null)}/>}<footer><a href="/samples/CREDITS.txt" target="_blank" rel="noreferrer">{t('soundCredits')}</a><span>Sight Reading / {w('音樂練習室','PRACTICE STUDIO','練習スタジオ')}</span><span>{t('intro')}</span></footer></div>;
}
