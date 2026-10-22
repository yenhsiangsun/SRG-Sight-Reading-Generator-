import ResumePractice from './ResumePractice';
import type {LastPractice} from '../practice/resume';
import {MEMBERSHIP_ENABLED} from '../featureFlags';
import {useI18n} from '../i18n/context';
import {NoteCompanion} from './NoteCompanion';
import {dayKey,type ProgressState,getLevel} from '../progress/progress';
import {words} from '../progress/words';
import {getCompanionGrowth} from '../progress/companionGrowth';
import {StudioFrontispiece} from './ForestMargin';
import {resumeCopy} from '../i18n/resumeCopy';
import './HomeReturnEntry.css';
import './HomeCompanion.css';
import './HomeOpening.css';

const withoutOpeningPunctuation=(text:string)=>text.replace(/[，。、,.]/gu,'');

type HomeProps={progress:ProgressState;onStart:()=>void;onRewards:()=>void;onPlans:()=>void;lastPractice:LastPractice|null;onResume:()=>void};
export default function StudioHome({progress,onStart,onRewards,onPlans,lastPractice,onResume}:HomeProps){
  const {locale,t}=useI18n();const w=(zh:string,en:string,ja:string)=>words(locale,zh,en,ja);
  const level=getLevel(progress.xp);
  const companionGrowth=getCompanionGrowth(progress,progress.activePet);
  const resumeWords=resumeCopy(locale);
  const days=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-6+i);return {key:dayKey(d),label:new Intl.DateTimeFormat(locale,{weekday:'short'}).format(d)};});
  return <main className="studio-home atelier-home manuscript-home" id="main">
    <div className="manuscript-dateline"><span>TONECRAFT / THE PRACTICE JOURNAL</span><time>{new Intl.DateTimeFormat(locale,{month:'long',day:'numeric',weekday:'long'}).format(new Date())}</time></div>
    <section className="manuscript-opening" aria-labelledby="folio-cover-title">
      <div className="manuscript-opening-copy" data-home-type={locale==='zh-TW'?'book':undefined}>
        <span className="manuscript-opening-kicker">{withoutOpeningPunctuation(w('屬於你的音樂日常','A JOURNAL FOR YOUR MUSICAL LIFE','あなただけの音楽の日々'))}</span>
        <h1 id="folio-cover-title"><span>{withoutOpeningPunctuation(w('音樂，','Music,','音楽を、'))}</span><span>{withoutOpeningPunctuation(w('慢慢成形。','taking shape.','少しずつ。'))}</span></h1>
        <p className="manuscript-opening-prose">{locale==='zh-TW'?<><span>從一段旋律開始</span><span>在練習裡　聽見自己的進步</span></>:t('intro').replace(/[，。、,.]/gu,' ').trim()}</p>
        {lastPractice?<div className="manuscript-return"><ResumePractice last={lastPractice} onResume={onResume}/><button type="button" className="manuscript-new-practice" onClick={onStart}>{resumeWords.newPractice}<span aria-hidden="true">↗</span></button></div>:<>
          <button type="button" className="studio-cta" onClick={onStart}>{w('翻開今日練習','Open today’s practice','今日の練習をひらく')}<span aria-hidden="true">↗</span></button>
        </>}
      </div>
      <div className="manuscript-engraving manuscript-engraving--companion"><NoteCompanion level={level.level} points={progress.points} todayCount={progress.today.count} dailyGoal={3} pet={progress.activePet} stage={companionGrowth.displayStage} homeGrowth={companionGrowth} onRewards={onRewards}/><div className="home-companion-score" aria-hidden="true"><StudioFrontispiece/></div></div>
    </section>
    <div className="manuscript-notebook">
      <section className="manuscript-records" aria-label={w('練習筆記','Practice notes','練習の記録')}>
        <div className="manuscript-section-heading"><span className="folio-eyebrow">{w('練習筆記','Practice notes','練習の記録')}</span><span>{w('最近 7 天','LAST 7 DAYS','過去7日間')}</span></div>
        <div className="manuscript-week">{days.map((day,i)=><div key={day.key} className={progress.practiceDays.includes(day.key)?'is-practiced':i===6?'is-today':''}><span>{day.label}</span><b aria-label={progress.practiceDays.includes(day.key)?w('已練習','Practiced','練習済み'):w('尚未練習','No practice yet','未練習')}>{progress.practiceDays.includes(day.key)?'✓':i===6?<svg className="manuscript-day-note" viewBox="0 0 16 24" aria-hidden="true" focusable="false"><path d="M9 2v16.5c0 1.9-2.1 3.5-4.4 3.5C3 22 2 21.2 2 20s1.8-2.6 3.8-2.6c.6 0 1.2.1 1.7.4V2H9ZM9 3c.9 2.6 5 3.3 5 6.5 0 1.6-.6 2.8-1.8 4 .5-1.1.7-2.2.5-3.2C12.3 8.1 10.3 7.7 9 6.7Z"/></svg>:'·'}</b></div>)}</div>
        <p className="manuscript-progress-copy">{w('今天完成','Today','今日')} <strong>{progress.today.count} / 3</strong><span>{w('每天前 3 次練習可獲得星點','Earn stars for your first 3 practices each day','毎日最初の3回でスターを獲得')}</span></p>
      </section>
    </div>
    {MEMBERSHIP_ENABLED&&<section className="membership-teaser"><h2>{w('讓進步，有更多可能。','More room to grow.','もっと自由に、上達を。')}</h2><button className="studio-text-link" onClick={onPlans}>{w('探索會員方案','Explore membership','プランを見る')}</button></section>}
  </main>;
}
