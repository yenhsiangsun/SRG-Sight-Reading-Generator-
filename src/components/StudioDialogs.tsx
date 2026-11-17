import {useEffect,useRef,useState,type ReactNode} from 'react';
import {useI18n} from '../i18n/context';
import type {ProgressState} from '../progress/progress';
import {REWARDS,getLevel,type RewardId} from '../progress/progress';
import {CompanionPortrait} from './CompanionPortrait';
import {words} from '../progress/words';
import {CompanionDesignPicker} from './CompanionDesignPicker';
import {companionName} from '../progress/companionNames';
import {getCompanionGrowth, type CompanionStage} from '../progress/companionGrowth';
import './CompanionJournal.css';
export function StudioDialog({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}){
  const ref=useRef<HTMLDialogElement>(null);const {locale}=useI18n();
  useEffect(()=>{
    const d=ref.current;
    const opener=document.activeElement;
    d?.showModal();
    return()=>{
      const focused=document.activeElement;
      const needsFocusReturn=focused===document.body||!!(focused&&d?.contains(focused));
      d?.close();
      // React removes the dialog before passive cleanup; native focus return
      // alone can leave keyboard users on body. A new page heading, however,
      // already owns focus when opening a saved study navigates out of the modal.
      if(needsFocusReturn&&opener instanceof HTMLElement&&opener.isConnected&&!document.querySelector('dialog[open]'))
        opener.focus({preventScroll:true});
    };
  },[]);
  return <dialog ref={ref} className="studio-dialog" aria-labelledby="studio-dialog-title" onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget){const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)onClose();}}}><header><h2 id="studio-dialog-title">{title}</h2><button aria-label={words(locale,'關閉','Close','閉じる')} onClick={onClose}>×</button></header>{children}</dialog>;
}
export function RewardsDialog({progress,onRedeem,onResetPet,onClose,onGrantPreviewPoints,onSelectStage,onRedeemStage}:{progress:ProgressState;onRedeem:(id:RewardId)=>void;onResetPet:()=>void;onClose:()=>void;onGrantPreviewPoints?:()=>void;onSelectStage?:(pet:ProgressState['activePet'],stage:CompanionStage|null)=>void;onRedeemStage?:(pet:ProgressState['activePet'],stage:CompanionStage)=>void}){
  const {locale}=useI18n();const w=(zh:string,en:string,ja:string)=>words(locale,zh,en,ja);const level=getLevel(progress.xp);
  const previewTools=import.meta.env.DEV&&onGrantPreviewPoints?<p className="reward-help"><button className="secondary-button" onClick={onGrantPreviewPoints}>{w('補滿 10,000 測試星點','Top up to 10,000 test stars','テスト用スターを10,000まで補充')}</button></p>:null;
  const [preview,setPreview]=useState<ProgressState['activePet']>(progress.activePet);
  const previewRef=useRef<HTMLElement>(null);
  const showPreview=(pet:ProgressState['activePet'])=>{setPreview(pet);previewRef.current?.scrollIntoView({block:'nearest'});};
  const previewReward=REWARDS.find(reward=>reward.id===preview);
  const previewOwned=preview===null||progress.cosmetics.includes(preview);
  const previewActive=progress.activePet===preview;
  const previewStage=previewOwned?getCompanionGrowth(progress,preview).displayStage:'baby';
  const rewardCards=REWARDS.map(reward=>{
    const owned=progress.cosmetics.includes(reward.id),active=progress.activePet===reward.id;
    const cost=reward.cost===0?w('免費','Free','無料'):`${reward.cost} ${w('星點','stars','スター')}`;
    const name=companionName(reward.id,locale);
    return <button type="button" className="companion-journal-tile" key={reward.id} aria-pressed={preview===reward.id}
      aria-label={`${w('預覽造型','Preview','プレビュー')}: ${name}`} title={w(reward.description.zh,reward.description.en,reward.description.ja)} onClick={()=>showPreview(reward.id)}>
      <span className="companion-journal-thumbnail" aria-hidden="true"><CompanionPortrait pet={reward.id} stage={owned?getCompanionGrowth(progress,reward.id).displayStage:'baby'}/></span>
      <span className="companion-journal-name">{name}</span><small>{active?w('使用中','Equipped','使用中'):owned?w('已擁有','Owned','所持済み'):cost}</small>
    </button>;
  });
  return <StudioDialog title={w('節拍器小精靈收藏','Metronome pet collection','メトロノーム・コレクション')} onClose={onClose}>
    <section className="companion-journal">
      <span className="companion-journal-kicker" aria-hidden="true">TONECRAFT / COMPANION JOURNAL</span>
      {previewTools}
      <div className="companion-journal-summary"><div><span>{w('等級','LEVEL','レベル')} {level.level}</span><strong>{progress.points} {w('星點','stars','スター')}</strong></div><div><progress className="level-progress" value={level.current} max={level.needed} aria-label={`${w('等級','LEVEL','レベル')} ${level.level} · ${level.current} / ${level.needed} XP`}/><small>{level.current} / {level.needed} XP · {progress.xp} XP</small></div></div>
      <div className="companion-journal-layout">
        <section ref={previewRef} className="companion-journal-detail" aria-label={w('造型預覽','Companion preview','プレビュー')}>
          <div className="companion-journal-meeting"><div className="companion-journal-portrait"><CompanionPortrait pet={preview} stage={previewStage} animated/></div>
            <div className="companion-journal-copy" aria-live="polite" aria-atomic="true"><span className="pet-collection-label">{preview===null?w('永久免費','ALWAYS FREE','ずっと無料'):w('動物節拍器系列','ANIMAL METRONOMES','動物メトロノーム')}</span><h3>{companionName(preview,locale)}</h3><p>{previewReward?w(previewReward.description.zh,previewReward.description.en,previewReward.description.ja):w('最初陪你練習的木質小夥伴，隨時可以回來。','Your first little wooden companion. Always here for you.','いつでも戻れる、最初の小さな木の仲間。')}</p></div>
          </div>
          <button className="secondary-button companion-journal-equip" disabled={previewActive||(!previewOwned&&progress.points<(previewReward?.cost??0))} onClick={()=>preview===null?onResetPet():onRedeem(preview)}>
            {previewActive?w('使用中','Equipped','使用中'):previewOwned?w('套用這個造型','Equip companion','この姿を使う'):`${w('兌換','Unlock','交換')} ${previewReward?.cost} ${w('星點','stars','スター')}`}
          </button>
          <CompanionDesignPicker key={preview??'original'} pet={preview} progress={progress} onSelectStage={onSelectStage} onRedeemStage={onRedeemStage}/>
        </section>
        <section className="companion-journal-index" aria-label={w('造型預覽','Companion preview','プレビュー')}>
          <div className="companion-journal-index-heading"><span>{w('預覽造型','Preview','プレビュー')}</span><small>{String(REWARDS.length+1).padStart(2,'0')}</small></div>
          <div className="companion-journal-gallery">
            <button type="button" className="companion-journal-tile" aria-pressed={preview===null} aria-label={`${w('預覽造型','Preview','プレビュー')}: ${companionName(null,locale)}`} onClick={()=>showPreview(null)}>
              <span className="companion-journal-thumbnail" aria-hidden="true"><CompanionPortrait stage={getCompanionGrowth(progress,null).displayStage}/></span><span className="companion-journal-name">{companionName(null,locale)}</span><small>{progress.activePet===null?w('使用中','Equipped','使用中'):w('永久免費','ALWAYS FREE','ずっと無料')}</small>
            </button>
            {rewardCards}
          </div>
        </section>
      </div>
      <footer className="companion-journal-notes"><p className="reward-help">{w('每份譜專注練習至少 60 秒後，可自行確認完成。每天前 3 次各 10 星點與 20 XP；同一份譜不重複領取。這是練習紀錄，不代表演奏正確率。','After at least 60 seconds with a study, confirm your practice. The first 3 completions daily earn 10 stars and 20 XP each, once per study. This records practice, not performance accuracy.','各譜例で60秒以上練習後、完了を記録できます。毎日最初の3回に10スター・20 XP。同じ譜例は1回まで。演奏の正確さを示すものではありません。')}</p><p className="prototype-note">{w('星點只靠練習獲得，不販售、不折現。紀錄目前保存在此瀏覽器。','Stars are earned, never sold or redeemable for cash. Progress is stored in this browser.','スターは練習で獲得し、販売・換金はできません。記録はこのブラウザに保存されます。')}</p></footer>
    </section>
  </StudioDialog>;
}
