import {estimateCalibration,loadCalibration,saveCalibration} from '../assessment/calibration';
import {useEffect,useRef,useState} from 'react';
import {useI18n} from '../i18n/context';
import type {ExerciseData} from '../music';
import {MicrophoneSession,type ExamStage} from '../assessment/MicrophoneSession';
import {assess,type AssessmentResult} from '../assessment/scoring';
import {createPlaybackEvents} from '../audio/PlaybackController';
import {suggestedPractice} from '../practice/feedback';
import {hasPolyphony} from '../music/notePitches';
export default function AssessmentPanel({exercise,bpm,onNext,onActive,onResult,onPracticeWeakness}:{exercise:ExerciseData;bpm:number;onNext:()=>void;onActive:(active:boolean)=>void;onResult?:(result:AssessmentResult|null)=>void;onPracticeWeakness?:(result:AssessmentResult)=>void}){
  const {t}=useI18n();const [reading,setReading]=useState(30),[questionCount,setQuestionCount]=useState(10),[calibration,setCalibration]=useState(loadCalibration);
  const [stage,setStage]=useState<ExamStage>('idle'),[remaining,setRemaining]=useState(0),[error,setError]=useState<'micError'|'interrupted'|null>(null);
  const [results,setResults]=useState<AssessmentResult[]>([]),[current,setCurrent]=useState<AssessmentResult|null>(null);
  const latency=calibration?.offsetMs??0;
  const [calibrating,setCalibrating]=useState(false),[calibrationMessage,setCalibrationMessage]=useState<'calibrationSaved'|'calibrationFailed'|'calibrationTemporary'|null>(null);
  const session=useRef(new MicrophoneSession());
  const [seenExercise,setSeenExercise]=useState(exercise);
  if(seenExercise!==exercise){setSeenExercise(exercise);setStage('idle');setCurrent(null);}
  const active=['permission','reading','countin','performing'].includes(stage);
  const done=results.length>=questionCount;
  const expected=createPlaybackEvents(exercise,bpm);
  useEffect(()=>{onResult?.(current);},[current,onResult]);
  const unsupported=hasPolyphony(exercise)||expected.events.some(n=>{const match=n.note.match(/^([a-g])([#b]*)(-?\d+)$/i);if(!match)return true;const pc=({c:0,d:2,e:4,f:5,g:7,a:9,b:11}[match[1].toLowerCase()]!)+[...match[2]].reduce((v,a)=>v+(a==='#'?1:-1),0);const midi=(+match[3]+1)*12+pc;return midi<36||midi>90;});
  useEffect(()=>{onActive(active);return()=>onActive(false);},[active,onActive]);
  useEffect(()=>{const running=session.current;running.stop();return()=>running.stop();},[exercise]);
  useEffect(()=>{const visibility=()=>{if(document.hidden&&active){session.current.stop();setError('interrupted');setStage('idle');}};document.addEventListener('visibilitychange',visibility);return()=>document.removeEventListener('visibilitychange',visibility);},[active]);
  const calibrate=async()=>{
    setError(null);setCalibrationMessage(null);setCalibrating(true);
    try{await session.current.start(3,60,4.5,(next,n)=>{setStage(next);setRemaining(n);if(next==='idle'){setCalibrating(false);setError('interrupted');}},frames=>{
      const measured=estimateCalibration(frames);setCalibrating(false);setStage('idle');
      if(measured){setCalibration(measured);setCalibrationMessage(saveCalibration(measured)?'calibrationSaved':'calibrationTemporary');}
      else setCalibrationMessage('calibrationFailed');
    });}catch{setCalibrating(false);setStage('idle');setError('micError');}
  };
  const start=async()=>{
    setError(null);setCurrent(null);
    try{await session.current.start(reading,bpm,expected.duration+Math.max(0,latency)/1000,(next,n)=>{setStage(next);setRemaining(n);if(next==='idle')setError('interrupted');},frames=>{
      const result=assess(exercise,bpm,frames,latency);setCurrent(result);setStage('result');
      if(result.reliable)setResults(previous=>[...previous,result]);
    });document.getElementById('exam-title')?.scrollIntoView({block:'start',behavior:'smooth'});}catch{setError('micError');setStage('idle');}
  };
  const summary=done?{pitch:Math.round(results.reduce((s,r)=>s+r.pitch,0)/results.length),rhythm:Math.round(results.reduce((s,r)=>s+r.rhythm,0)/results.length),completion:Math.round(results.reduce((s,r)=>s+r.completion,0)/results.length)}:current;
  return <section className={"assessment-panel "+(active?"is-active":"")} aria-labelledby="exam-title"><div className="exam-heading"><h2 id="exam-title">{t('test')}</h2><span>{Math.min(results.length+1,questionCount)} / {questionCount}</span></div><p>{t('examHelp')}</p><p className="exam-limit">{t('examLimit')}</p><div className="exam-settings"><label>{t('readingTime')}<select value={reading} disabled={active||results.length>0} onChange={e=>setReading(+e.target.value)}><option value={30}>30 {t('seconds')}</option><option value={60}>60 {t('seconds')}</option></select></label><label>{t('questions')}<select value={questionCount} disabled={active||results.length>0} onChange={e=>setQuestionCount(+e.target.value)}><option value={1}>{t('oneQuestion')}</option><option value={10}>{t('tenQuestions')}</option></select></label></div><div className="calibration-card"><h3>{t('calibrationTitle')}</h3><p>{t('calibrationHelp')}</p><p className="calibration-pattern" aria-label={t('calibrationPattern')}>4/4 · ♩ = 60　♫　♫　♫　♫</p><p>{calibration?t('calibrationValue')+': '+latency+' ms':t('calibrationRequired')}</p><button className="secondary-button" disabled={active||results.length>0} onClick={()=>{void calibrate();}}>{t(calibration?'recalibrate':'calibrate')}</button>{calibrationMessage&&<p role="status">{t(calibrationMessage)}</p>}<p className="field-note">{t('calibrationCaution')}</p></div>
    {active?<div className="exam-live" role="status"><strong>{calibrating?t('calibrationTitle')+' · ':''}{t(stage as 'permission'|'reading'|'countin'|'performing')}</strong><output>{stage==='permission'?'…':remaining}</output><button className="secondary-button" onClick={()=>{session.current.stop();setCalibrating(false);setStage('idle');}}>{t('cancelExam')}</button></div>:<div className="exam-actions">{done?<button className="primary-button" onClick={()=>{setResults([]);setCurrent(null);setStage('idle');onNext();}}>{t('restartExam')}</button>:current?.reliable?<button className="primary-button" onClick={onNext}>{t('nextQuestion')}</button>:<button className="primary-button" disabled={!calibration||unsupported||expected.events.length===0} onClick={()=>{void start();}}>{t('startExam')}</button>}</div>}
    {error&&<p className="error-message" role="alert">{t(error)}</p>}{current&&!current.reliable&&<p className="error-message" role="alert">{t('noSignal')}</p>}
    {summary&&current?.reliable&&<div className="exam-result"><h3>{t(done?'summary':'result')}</h3><div className="exam-scores">{(['pitch','rhythm','completion'] as const).map(key=><div key={key}><span>{t(key==='pitch'?'pitchScore':key==='rhythm'?'rhythmScore':'completion')}</span><strong>{summary[key]}<small>%</small></strong></div>)}</div><p>{t(summary.completion<70?'completionAdvice':summary.pitch+10<summary.rhythm?'pitchAdvice':summary.rhythm+10<summary.pitch?'rhythmAdvice':'balancedAdvice')}</p><details><summary>{t('noteDetails')}</summary><div className="result-table"><table><thead><tr><th>#</th><th>{t('expected')}</th><th>{t('pitchScore')}</th><th>{t('onset')}</th></tr></thead><tbody>{current.notes.map(n=><tr key={n.index}><td>{n.index+1}</td><td>{n.expected}</td><td>{n.heard?(n.pitch?'✓':Math.round(n.cents??0)+' ¢'):t('notHeard')}</td><td>{n.offsetMs??'—'}</td></tr>)}</tbody></table></div></details></div>}
    {current&&suggestedPractice(exercise,bpm,current)&&onPracticeWeakness&&<button className="secondary-button weakness-action" onClick={()=>onPracticeWeakness(current)}>{t('practiceWeakness')} →</button>}
  </section>;
}
