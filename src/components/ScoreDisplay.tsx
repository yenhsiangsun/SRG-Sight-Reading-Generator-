import {useEffect,useRef,useState} from 'react';
import type {ExerciseData} from '../music';
import {useI18n} from '../i18n/context';
import {drawGrandScore} from '../notation/drawGrandScore';
import {drawSingleScore} from '../notation/drawSingleScore';
import type {ScoreLayout} from '../notation/scoreGeometry';
import ScorePlayhead,{type ScorePlayback} from './ScorePlayhead';
import './ScorePlayhead.css';
import ScoreFeedback from './ScoreFeedback';
import type {AssessmentResult} from '../assessment/scoring';
import {words} from '../progress/words';

export default function ScoreDisplay({exercise,bpm=exercise.tempo,playback,assessment}: {
  exercise:ExerciseData;bpm?:number;playback?:ScorePlayback;assessment?:AssessmentResult|null;
}) {
  const {locale,t}=useI18n();
  const containerRef=useRef<HTMLDivElement>(null);
  const [error,setError]=useState('');
  const [layout,setLayout]=useState<ScoreLayout|null>(null);
  const [follow,setFollow]=useState(true);
  const drawScore=exercise.lowerMeasures?drawGrandScore:drawSingleScore;

  useEffect(()=>{
    const container=containerRef.current;
    if(!container)return;
    let previousWidth=-1;
    const draw=()=>{
      try {
        container.replaceChildren();
        const width=Math.max(container.clientWidth,300);
        previousWidth=container.clientWidth;
        const next=drawScore(container,exercise,width);
        container.querySelector('svg')?.setAttribute('aria-label',`${exercise.measures.length} ${t('length')} ${t(exercise.lowerMeasures?'grand':'score')}`);
        setLayout(next);
        setError('');
      }catch(cause){
        container.replaceChildren();
        setLayout(null);
        setError(cause instanceof Error?cause.message:'譜面無法完成排版，請重新產生。');
      }
    };
    draw();
    const observer=new ResizeObserver(()=>{if(container.clientWidth!==previousWidth)draw();});
    observer.observe(container);
    return()=>observer.disconnect();
  },[exercise,locale,t,drawScore]);

  return <>
    {[...exercise.measures,...(exercise.lowerMeasures??[])].some(measure=>measure.events.some(note=>note.dynamic||note.articulation)) && <details className="performance-mark-help">
      <summary>{words(locale,'演奏記號說明','Expression guide','演奏記号の説明')}</summary>
      <p>{words(locale,'p 弱、mp 中弱、mf 中強、f 強；力度持續到下一個力度記號。音符上的圓點表示斷奏（短促），短橫線表示保持音（奏足音長），> 表示重音。','p = soft, mp = moderately soft, mf = moderately loud, f = loud; dynamics continue until the next marking. A dot means staccato (short), a dash means tenuto (full length), and > means accent.','p は弱く、mp はやや弱く、mf はやや強く、f は強く。次の記号まで有効です。点はスタッカート（短く）、横線はテヌート（音価を十分に）、> はアクセントです。')}</p>
    </details>}
    {error&&<p className="error-message" role="alert">{locale==='zh-TW'?error:t('error')}</p>}
    {playback&&!error&&<div className="score-playback-guide"><p>{t('cursorHelp')}</p><label className="score-follow-toggle"><input type="checkbox" checked={follow} onChange={e=>setFollow(e.target.checked)}/>{t('followPlayback')}</label></div>}
    <div className="score-stage"><div ref={containerRef} className="score-container"/>
      {playback&&layout&&<ScorePlayhead exercise={exercise} bpm={bpm} layout={layout} playback={playback} follow={follow}/>}
      {assessment&&layout&&<ScoreFeedback exercise={exercise} bpm={bpm} result={assessment} layout={layout}/>}
    </div>
  </>;
}
