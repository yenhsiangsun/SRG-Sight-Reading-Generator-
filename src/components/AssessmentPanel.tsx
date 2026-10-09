import {estimateCalibration,loadCalibration,saveCalibration,type OutputRoute} from '../assessment/calibration';
import {useEffect,useRef,useState} from 'react';
import {useI18n} from '../i18n/context';
import type {ExerciseData} from '../music';
import {MicrophoneSession,type ExamStage} from '../assessment/MicrophoneSession';
import {assess,type AssessmentResult} from '../assessment/scoring';
import {createPlaybackEvents} from '../audio/PlaybackController';
import {suggestedPractice} from '../practice/feedback';
import {hasPolyphony} from '../music/notePitches';
import CalibrationProgress from './CalibrationProgress';
import CalibrationScore from './CalibrationScore';
import {selectCalibrationPitch} from '../assessment/calibrationPitch';
export default function AssessmentPanel({exercise,bpm,onNext,onActive,onResult,onPracticeWeakness}:{exercise:ExerciseData;bpm:number;onNext:()=>void;onActive:(active:boolean)=>void;onResult?:(result:AssessmentResult|null)=>void;onPracticeWeakness?:(result:AssessmentResult)=>void}){
  const {t}=useI18n();const [reading,setReading]=useState(30),[questionCount,setQuestionCount]=useState(10),[calibration,setCalibration]=useState(()=>loadCalibration());
  const [stage,setStage]=useState<ExamStage>('idle'),[remaining,setRemaining]=useState(0),[error,setError]=useState<'micError'|'interrupted'|'routeChanged'|'calibrationAudioError'|null>(null);
  const [results,setResults]=useState<AssessmentResult[]>([]),[current,setCurrent]=useState<AssessmentResult|null>(null);
  const latency=calibration?.offsetMs??0;
  const [outputRoute,setOutputRoute]=useState<OutputRoute>(()=>calibration?.outputRoute??'speakers');
  const routeKey=useRef('');
  const [calibrating,setCalibrating]=useState(false),[calibrationMessage,setCalibrationMessage]=useState<'calibrationSaved'|'calibrationFailed'|'calibrationTemporary'|null>(null);
  const [calibrationProgress,setCalibrationProgress]=useState<{stage:ExamStage;elapsed:number}>({stage:'idle',elapsed:0});
  const session=useRef(new MicrophoneSession());
  const [seenExercise,setSeenExercise]=useState(exercise);
  if(seenExercise!==exercise){setSeenExercise(exercise);setStage('idle');setCurrent(null);setCalibrating(false);}
  const active=['permission','reading','countin','performing'].includes(stage);
  const done=results.length>=questionCount;
  const expected=createPlaybackEvents(exercise,bpm);
  const calibrationPitch=selectCalibrationPitch(exercise);
  useEffect(()=>{onResult?.(current);},[current,onResult]);
  const unsupported=hasPolyphony(exercise)||expected.events.some(n=>{const match=n.note.match(/^([a-g])([#b]*)(-?\d+)$/i);if(!match)return true;const pc=({c:0,d:2,e:4,f:5,g:7,a:9,b:11}[match[1].toLowerCase()]!)+[...match[2]].reduce((v,a)=>v+(a==='#'?1:-1),0);const midi=(+match[3]+1)*12+pc;return midi<36||midi>90;});
  useEffect(()=>{onActive(active);return()=>onActive(false);},[active,onActive]);
  useEffect(()=>{const running=session.current;running.stop();return()=>running.stop();},[exercise]);
  useEffect(()=>{const visibility=()=>{if(document.hidden&&active){session.current.stop();setError('interrupted');setStage('idle');setCalibrating(false);}};document.addEventListener('visibilitychange',visibility);return()=>document.removeEventListener('visibilitychange',visibility);},[active]);
  const calibrate=async()=>{
    setError(null);setCalibrationMessage(null);setCalibrating(true);setCalibrationProgress({stage:'permission',elapsed:0});
    try{await session.current.start(3,60,4.5,(next,n)=>{setStage(next);setRemaining(n);if(next==='idle'){setCalibrating(false);setError('interrupted');}},frames=>{
      const measured=estimateCalibration(frames);setCalibrating(false);setStage('idle');
      if(measured){const value={...measured,routeKey:routeKey.current,outputRoute};setCalibration(value);setCalibrationMessage(saveCalibration(value)?'calibrationSaved':'calibrationTemporary');}
      else setCalibrationMessage('calibrationFailed');
    },{outputRoute,onRoute:key=>{routeKey.current=key;},onProgress:(next,elapsed)=>{
      // Continuous progress comes from the same audio clock as the four clicks
      // and captured attacks; a separate animation timer must not set the tempo.
      setCalibrationProgress(previous=>previous.stage===next&&previous.elapsed===elapsed?previous:{stage:next,elapsed});
    }});}catch(cause){setCalibrating(false);setStage('idle');setError(cause instanceof Error&&cause.message==='AUDIO_UNAVAILABLE'?'calibrationAudioError':'micError');}
  };
  const start=async()=>{
    setError(null);setCurrent(null);setCalibrating(false);let activeLatency=latency;
    try{await session.current.start(reading,bpm,expected.duration+.4,(next,n)=>{setStage(next);setRemaining(n);if(next==='idle')setError('interrupted');},frames=>{
      const result=assess(exercise,bpm,frames,activeLatency);setCurrent(result);setStage('result');
      if(result.reliable)setResults(previous=>[...previous,result]);
    },{outputRoute,onRoute:key=>{
      const matched=calibration?.routeKey===key?calibration:loadCalibration(key);
      if(!matched){setCalibration(null);throw new Error('CALIBRATION_REQUIRED');}
      activeLatency=matched.offsetMs;setCalibration(matched);
    }});document.getElementById('exam-title')?.scrollIntoView({block:'start',behavior:'smooth'});}catch(cause){setError(cause instanceof Error&&cause.message==='CALIBRATION_REQUIRED'?'routeChanged':cause instanceof Error&&cause.message==='AUDIO_UNAVAILABLE'?'calibrationAudioError':'micError');setStage('idle');}
  };
  const calibrationElapsed=calibrationProgress.stage===stage?calibrationProgress.elapsed:0;
  const summary=done?{pitch:Math.round(results.reduce((s,r)=>s+r.pitch,0)/results.length),rhythm:Math.round(results.reduce((s,r)=>s+r.rhythm,0)/results.length),completion:Math.round(results.reduce((s,r)=>s+r.completion,0)/results.length),duration:Math.round(results.reduce((s,r)=>s+r.duration,0)/results.length),extraNotes:results.reduce((s,r)=>s+r.extraNotes,0)}:current;
  return <section className={"assessment-panel "+(active?"is-active":"")} aria-labelledby="exam-title"><div className="exam-heading"><h2 id="exam-title">{t('test')}</h2><span>{Math.min(results.length+1,questionCount)} / {questionCount}</span></div><p>{t('examHelp')}</p><p className="exam-limit">{t('examLimit')}</p><div className="exam-settings"><label>{t('readingTime')}<select value={reading} disabled={active||results.length>0} onChange={e=>setReading(+e.target.value)}><option value={30}>30 {t('seconds')}</option><option value={60}>60 {t('seconds')}</option></select></label><label>{t('questions')}<select value={questionCount} disabled={active||results.length>0} onChange={e=>setQuestionCount(+e.target.value)}><option value={1}>{t('oneQuestion')}</option><option value={10}>{t('tenQuestions')}</option></select></label></div><div className="calibration-card"><h3>{t('calibrationTitle')}</h3><p>{t('calibrationHelp')}</p><label>{t('outputRoute')}<select value={outputRoute} disabled={active} onChange={e=>{setOutputRoute(e.target.value as OutputRoute);setCalibration(null);setCalibrationMessage(null);}}>{(['speakers','wired','bluetooth'] as const).map(value=><option key={value} value={value}>{t(({speakers:'outputSpeakers',wired:'outputWired',bluetooth:'outputBluetooth'} as const)[value])}</option>)}</select></label><p className="field-note">{t('routeHelp')}</p><CalibrationScore stage="idle" elapsed={0} clef={calibrationPitch.clef} noteKey={calibrationPitch.noteKey} label={t('calibrationScoreLabel')}/><p className="field-note">{t('calibrationPitchGuide')}</p><p>{calibration?t('calibrationValue')+': '+latency+' ms':t('calibrationRequired')}</p><button className="secondary-button" disabled={active} onClick={()=>{void calibrate();}}>{t(calibration?'recalibrate':'calibrate')}</button>{calibrationMessage&&<p role="status">{t(calibrationMessage)}</p>}<p className="field-note">{t('calibrationCaution')}</p></div>
    {active?calibrating?<div className="exam-live calibration-live">
      <CalibrationProgress stage={stage} remaining={remaining} elapsed={calibrationElapsed} clef={calibrationPitch.clef} noteKey={calibrationPitch.noteKey}/>
      <button className="secondary-button" onClick={()=>{session.current.stop();setCalibrating(false);setStage('idle');}}>{t('cancelExam')}</button>
    </div>:<div className="exam-live" role="status"><strong>{t(stage as 'permission'|'reading'|'countin'|'performing')}</strong><output>{stage==='permission'?'…':remaining}</output><button className="secondary-button" onClick={()=>{session.current.stop();setCalibrating(false);setStage('idle');}}>{t('cancelExam')}</button></div>:<div className="exam-actions">{done?<button className="primary-button" onClick={()=>{setResults([]);setCurrent(null);setStage('idle');onNext();}}>{t('restartExam')}</button>:current?.reliable?<button className="primary-button" onClick={onNext}>{t('nextQuestion')}</button>:<button className="primary-button" disabled={(!calibration&&!loadCalibration())||unsupported||expected.events.length===0} onClick={()=>{void start();}}>{t('startExam')}</button>}</div>}
    {error&&<p className="error-message" role="alert">{t(error)}</p>}{current&&!current.reliable&&<p className="error-message" role="alert">{t(current.clipped?'signalClipped':'noSignal')}</p>}
    {summary&&current?.reliable&&<div className="exam-result"><h3>{t(done?'summary':'result')}</h3><div className="exam-scores">{(['pitch','rhythm','completion'] as const).map(key=><div key={key}><span>{t(key==='pitch'?'pitchScore':key==='rhythm'?'rhythmScore':'completion')}</span><strong>{summary[key]}<small>%</small></strong></div>)}</div>
      <p>{t('durationScore')}: {summary.duration}% · {t('extraNotes')}: {summary.extraNotes}</p>
      <p className="field-note">{t('assessmentTimingHelp')}</p>{current.decayAllowance&&<p className="field-note">{t('assessmentDecayHelp')}</p>}
      {current.restAccuracy!==undefined&&<p>{t('restScore')}: {current.restAccuracy}%</p>}<p>{t(summary.completion<70?'completionAdvice':summary.pitch+10<summary.rhythm?'pitchAdvice':summary.rhythm+10<summary.pitch?'rhythmAdvice':'balancedAdvice')}</p><details><summary>{t('noteDetails')}</summary><div className="result-table"><table><thead><tr><th>#</th><th>{t('expected')}</th><th>{t('pitchScore')}</th><th>{t('onset')}</th><th>{t('durationScore')}</th></tr></thead><tbody>{current.notes.map(n=><tr key={n.index}><td>{n.index+1}</td><td>{n.expected}</td><td>{n.heard?(n.pitch?'✓':Math.round(n.cents??0)+' ¢'):t('notHeard')}</td><td>{n.offsetMs??'—'}</td><td>{n.heard?(n.duration?'✓':'×'):t('notHeard')}</td></tr>)}</tbody></table></div></details></div>}
    {current&&suggestedPractice(exercise,bpm,current)&&onPracticeWeakness&&<button className="secondary-button weakness-action" onClick={()=>onPracticeWeakness(current)}>{t('practiceWeakness')} →</button>}
  </section>;
}
