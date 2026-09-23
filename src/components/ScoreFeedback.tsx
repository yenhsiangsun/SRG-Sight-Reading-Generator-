import {useI18n} from '../i18n/context';
import {feedbackNotes} from '../practice/feedback';
import type {ExerciseData} from '../music';
import type {AssessmentResult} from '../assessment/scoring';
import type {ScoreLayout} from '../notation/scoreGeometry';

export default function ScoreFeedback({exercise,bpm,result,layout}:{exercise:ExerciseData;bpm:number;result:AssessmentResult;layout:ScoreLayout}) {
  const {t}=useI18n();const notes=feedbackNotes(exercise,bpm,result);
  if(!notes.length)return null;
  return <><div className="score-feedback-overlay" aria-hidden="true" style={{width:layout.width,height:layout.height}}>{notes.map((event,index)=>{
    const point=layout.notes?.find(n=>n.measure===event.measure&&n.staff===event.staff&&Math.abs(n.units-event.units)<1e-6);
    return point?<span className={'score-feedback-marker is-'+event.kind} key={event.result.index} style={{left:point.x,top:point.y}}>{index+1}</span>:null;
  })}</div><details className="score-feedback-list"><summary>{t('scoreFeedback')} · {notes.length}</summary><p>{t('feedbackHelp')}</p><ol>{notes.map(event=><li key={event.result.index}>{event.measure+1} · {event.result.expected} — {t(event.kind==='unclear'?'notHeard':event.kind==='pitch'?'feedbackPitch':'feedbackRhythm')}{event.result.heard&&!event.result.pitch&&!event.result.rhythm?' / '+t('feedbackRhythm'):''}</li>)}</ol></details></>;
}
