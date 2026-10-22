import {useEffect,useRef,useState} from 'react';
import type {ExerciseData} from '../music';
import {useI18n} from '../i18n/context';
import {drawGrandScore} from '../notation/drawGrandScore';
import {drawSingleScore} from '../notation/drawSingleScore';
import {scaleScoreLayout,type ScoreLayout} from '../notation/scoreGeometry';
import ScorePlayhead,{type ScorePlayback} from './ScorePlayhead';
import './ScorePlayhead.css';
import ScoreFeedback from './ScoreFeedback';
import type {AssessmentResult} from '../assessment/scoring';
import {words} from '../progress/words';
import {observeScoreWidth} from '../notation/observeScoreWidth';

export default function ScoreDisplay({exercise,bpm=exercise.tempo,playback,assessment,size=1}: {
  exercise:ExerciseData;bpm?:number;playback?:ScorePlayback;assessment?:AssessmentResult|null;size?:number;
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
    const draw=(clientWidth:number)=>{
      try {
        const width=Math.max(clientWidth/size,300);
        container.replaceChildren();
        const next=drawScore(container,exercise,width);
        const svg=container.querySelector('svg');
        if(svg){
          svg.setAttribute('viewBox',`0 0 ${next.width} ${next.height}`);
          svg.setAttribute('width',String(next.width*size));svg.setAttribute('height',String(next.height*size));
          // VexFlow also writes inline CSS sizes, which take precedence over attributes.
          svg.style.width=`${next.width*size}px`;svg.style.height=`${next.height*size}px`;
        }
        // Cursor/hit targets use the same scaled engraving coordinates.
        container.querySelector('svg')?.setAttribute('aria-label',`${exercise.measures.length} ${t('length')} ${t(exercise.lowerMeasures?'grand':'score')}`);
        setLayout(scaleScoreLayout(next,size));
        setError('');
      }catch(cause){
        container.replaceChildren();
        setLayout(null);
        setError(cause instanceof Error?cause.message:'譜面無法完成排版，請重新產生。');
      }
    };
    return observeScoreWidth(container,draw);
  },[exercise,locale,t,drawScore,size]);

  return <>
    {(exercise.expressionSpans?.length || [...exercise.measures,...(exercise.lowerMeasures??[])].some(measure=>measure.events.some(note=>note.dynamic||note.articulation||note.technique))) ? <details className="performance-mark-help">
      <summary>{words(locale,'演奏記號說明','Expression guide','演奏記号の説明')}</summary>
      <p>{words(locale,'p 弱、mp 中弱、mf 中強、f 強；力度持續到下一個力度記號。音符上的圓點表示斷奏（短促），短橫線表示保持音（奏足音長），> 表示重音。','p = soft, mp = moderately soft, mf = moderately loud, f = loud; dynamics continue until the next marking. A dot means staccato (short), a dash means tenuto (full length), and > means accent.','p は弱く、mp はやや弱く、mf はやや強く、f は強く。次の記号まで有効です。点はスタッカート（短く）、横線はテヌート（音価を十分に）、> はアクセントです。')}</p>
      {!!exercise.expressionSpans?.length&&<p>{words(locale,'弧線內的不同音連貫演奏；開口漸大的線表示漸強，開口漸小表示漸弱，播放也會輕柔地跟隨。','Play different notes under a slur smoothly. An opening wedge means crescendo; a closing wedge means diminuendo. Playback gently follows these markings.','スラー内の異なる音を滑らかにつなぎます。開くくさびはクレッシェンド、閉じるくさびはデクレッシェンドです。再生にも穏やかに反映されます。')}</p>}
      {exercise.soundProfile==='Pipa'&&[...exercise.measures,...(exercise.lowerMeasures??[])].some(bar=>bar.events.some(n=>n.technique))&&<><p>{t('pipaTechniqueGuide')}</p><p>{t('pipaAuditionHelp')}</p></>}
    </details>:null}
    {error&&<p className="error-message" role="alert">{locale==='zh-TW'?error:t('error')}</p>}
    {playback&&!error&&<div className="score-playback-guide"><p>{t('cursorHelp')}</p><label className="score-follow-toggle"><input type="checkbox" checked={follow} onChange={e=>setFollow(e.target.checked)}/>{t('followPlayback')}</label></div>}
    <div className="score-stage"><div ref={containerRef} className="score-container"/>
      {playback&&layout&&<ScorePlayhead exercise={exercise} bpm={bpm} layout={layout} playback={playback} follow={follow}/>}
      {assessment&&layout&&<ScoreFeedback exercise={exercise} bpm={bpm} result={assessment} layout={layout}/>}
    </div>
  </>;
}
