import {useI18n} from './i18n/context';
import {useState} from 'react';
import {I18nProvider,LanguageSwitcher} from './i18n/I18n';
import {instrumentLabel,scaleLabel} from './i18n/musicLabels';
import {getScale} from './music/scales';
import {hasSamples} from './audio/createPlaybackInstrument';
import {tempoSymbol} from './audio/tempo';
import ScoreDisplay from './components/ScoreDisplay';
import SetupPage from './components/SetupPage';
import AssessmentPanel from './components/AssessmentPanel';
import {useExercise} from './hooks/useExercise';
import {usePlayback} from './hooks/usePlayback';
import {midiToNoteLabel} from './exerciseConfig';
import './App.css';
export default function App(){return <I18nProvider><Studio/></I18nProvider>;}
function Studio(){
  const {locale,t}=useI18n();const practice=useExercise(),playback=usePlayback();
  const [bpm,setBpm]=useState(72),[page,setPage]=useState<'setup'|'practice'>('setup'),[mode,setMode]=useState<'practice'|'test'>('practice'),[examActive,setExamActive]=useState(false);
  const {current}=practice;const busy=playback.status!=='idle'||examActive;
  const start=()=>{playback.stop();if(practice.generateNew(bpm)){setPage('practice');window.scrollTo(0,0);}};
  const settings=()=>{playback.stop();setPage('setup');window.scrollTo(0,0);};
  const status=t(playback.status==='starting'?'loadingAudio':playback.status==='playing'?(playback.mode==='metronome'?'clicking':'playing'):playback.status==='paused'?'paused':'ready');
  const scale=current?getScale(current.settings.scaleId):null;
  return <div className={'app '+(page==='setup'?'setup-app':'practice-app')}><header className="header"><div className="header-content"><button className="brand" onClick={settings}><span className="brand-mark" aria-hidden="true">𝄞</span><span>Sight Reading<span className="brand-subtitle">PRACTICE STUDIO</span></span></button><LanguageSwitcher/></div></header>
    {page==='setup'||!current?<SetupPage settings={practice.settings} change={(key,value)=>{playback.stop();practice.change(key,value);}} onStart={start} error={practice.error||playback.error}/>:
      <main className="practice-main" id="main"><div className="practice-heading"><button className="back-link" onClick={settings}>{t('backSetup')}</button><span className="session-number">SESSION / {String(current.number).padStart(2,'0')}</span></div><div className="practice-title"><div><span className="eyebrow">YOUR PRACTICE ROOM</span><h1>{t('practiceTitle')}</h1></div><button className="secondary-button" disabled={examActive} onClick={start}>{t('newExercise')}</button></div><div className="practice-modes" role="group" aria-label={t('practice')}>{(['practice','test'] as const).map(value=><button key={value} aria-pressed={mode===value} disabled={examActive} onClick={()=>{playback.stop();setMode(value);}}>{t(value)}</button>)}</div>
      {(practice.error||playback.error)&&<p className="error-message" role="alert">{locale==='zh-TW'?(practice.error||playback.error):t('error')}</p>}
      <section className="practice-toolbar" aria-label={t('tempo')}>{mode==='practice'&&<div className="player-controls"><button className="play-main" disabled={playback.status==='starting'||(playback.status==='playing'&&playback.mode==='score')} onClick={()=>{void playback.play(current.exercise,bpm);}}><span aria-hidden="true">▶</span>{t(playback.status==='paused'?'resume':'play')}</button><button className="icon-button" aria-label={t('pause')} disabled={playback.status!=='playing'} onClick={playback.pause}>Ⅱ</button><button className="icon-button" aria-label={t('stop')} disabled={!busy} onClick={playback.stop}>■</button><button className="icon-button" aria-label={t('replay')} disabled={playback.status==='starting'} onClick={()=>{void playback.replay(current.exercise,bpm);}}>↶</button></div>}
        <div className="tempo"><label htmlFor="tempo">{t('tempo')} <small>BPM · {current.settings.mixedMeters?'♩ / ♪':tempoSymbol(current.exercise.timeSignature)}</small></label><input id="tempo" type="range" min="40" max="180" value={bpm} disabled={busy} onChange={e=>setBpm(Number(e.target.value))}/><output htmlFor="tempo">{bpm}</output></div>
        {mode==='practice'&&<div className="metronome-control"><div><strong>{t('metronome')}</strong><small>{t('downbeat')}</small></div><button className="switch" role="switch" aria-label={t('metronome')} aria-checked={playback.metronome} disabled={playback.status==='starting'} onClick={()=>playback.toggleMetronome(current.exercise,bpm)}><span/></button></div>}</section>
      {mode==='practice'?<><p className="timbre-caption">{t('sound')}: {instrumentLabel(current.settings.instrument,locale)} · {t(hasSamples(current.settings.instrument)?'recorded':'synthetic')}</p><div className="playback-caption"><span className={'playback-status '+(playback.status==='playing'?'active':'')} role="status"><i aria-hidden="true"/>{status}</span></div></>:<AssessmentPanel exercise={current.exercise} bpm={bpm} onNext={start} onActive={setExamActive}/>}
      <section className="score-card" aria-labelledby="score-heading"><div className="score-top"><div><span className="score-kicker">SIGHT-READING STUDY / {String(current.number).padStart(2,'0')}</span><h2 id="score-heading">{instrumentLabel(current.settings.instrument,locale)}</h2><p>{current.settings.scaleId==='atonal'?'':current.settings.tonic+' '}{scale?scaleLabel(scale.id,scale.label,locale):''} <span>·</span> {current.settings.mixedMeters?t('mixed'):current.exercise.timeSignature} <span>·</span> {current.exercise.measures.length} {t('length')}</p></div><div className="score-info"><strong>{current.settings.mixedMeters?'♩ = ♪':tempoSymbol(current.exercise.timeSignature)} = {bpm}</strong><span>{t(current.exercise.lowerMeasures?'grand':current.exercise.clef)}</span><span>{midiToNoteLabel(current.settings.rangeMinMidi)} — {midiToNoteLabel(current.settings.rangeMaxMidi)}</span></div></div><div className="score-scroll" tabIndex={0} role="region" aria-label={t('score')}><ScoreDisplay exercise={current.exercise}/></div><div className="score-bottom"><span>{t(({Beginner:'beginner',Intermediate:'intermediate',Advanced:'advanced'} as const)[current.settings.difficulty])}</span><span>{t('transpose')}: {current.exercise.transposition??0}</span></div></section><p className="practice-footnote">{t('tempoHelp')}</p></main>}
    <footer><a href="/samples/CREDITS.txt" target="_blank" rel="noreferrer">{t('soundCredits')}</a><span>SIGHT READING / PRACTICE STUDIO</span><span>{t('intro')}</span></footer></div>;
}
