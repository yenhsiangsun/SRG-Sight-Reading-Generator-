import {useEffect,useRef,useState} from 'react';
import type {PetCompanion, ProgressState} from '../progress/progress';
import {COMPANION_STAGES, COMPANION_STAGE_COST, getCompanionGrowth, type CompanionStage} from '../progress/companionGrowth';
import {companionGrowthCopy} from '../progress/companionGrowthCopy';
import {useI18n} from '../i18n/context';
import {CompanionPortrait} from './CompanionPortrait';
import './CompanionDesignPicker.css';

/** The old art selector now offers earned stages; hidden art stays in the renderer. */
export function CompanionDesignPicker({pet, progress, onSelectStage, onRedeemStage}: {
  pet: PetCompanion | null;
  progress: ProgressState;
  onSelectStage?: (pet: PetCompanion | null, stage: CompanionStage | null) => void;
  onRedeemStage?: (pet: PetCompanion | null, stage: CompanionStage) => void;
}) {
  const {locale} = useI18n();
  const copy = companionGrowthCopy(locale);
  const growth = getCompanionGrowth(progress, pet);
  const owned = pet === null || progress.cosmetics.includes(pet);
  const label = (template: string, points: number) => template.replace('{points}',Math.max(0,points).toLocaleString(locale));
  const highest = COMPANION_STAGES.indexOf(growth.unlockedStage);
  type Quote={pet:PetCompanion|null;stage:CompanionStage;cost:number};
  const [pending,setPending]=useState<Quote|null>(null);
  const pendingRef=useRef<Quote|null>(null),triggerRef=useRef<HTMLButtonElement>(null),cancelRef=useRef<HTMLButtonElement>(null);
  // The collection keys this picker by pet, cancelling any quote on a preview change.
  useEffect(()=>{if(pending?.pet===pet)cancelRef.current?.focus();},[pending,pet]);
  const quote=pending?.pet===pet?pending:null;
  const canConfirm=!!quote&&owned&&quote.stage===growth.nextStage&&quote.cost===COMPANION_STAGE_COST[quote.stage]&&progress.points>=quote.cost&&!!onRedeemStage;
  const cancel=()=>{pendingRef.current=null;setPending(null);triggerRef.current?.focus();};
  const confirm=()=>{
    if(!canConfirm||!quote||pendingRef.current!==quote)return;
    pendingRef.current=null;setPending(null);onRedeemStage?.(quote.pet,quote.stage);triggerRef.current?.focus();
  };
  return <section className="companion-design-picker" aria-label={copy.heading}>
    <div className="companion-growth-heading"><h3>{copy.heading}</h3>{!owned&&<span>{copy.purchaseFirst}</span>}</div>
    {owned && <button type="button" className="companion-growth-auto" aria-pressed={growth.selectedStage === null} onClick={() => {pendingRef.current=null;setPending(null);onSelectStage?.(pet, null);}}>
      <span aria-hidden="true">{growth.selectedStage === null ? '✓' : '○'}</span>{copy.auto}
    </button>}
    <div className="companion-design-options" role="group" aria-label={copy.heading}>
      {COMPANION_STAGES.map((stage, index) => {
        const unlocked = owned && index <= highest;
        const selected = unlocked && growth.displayStage === stage;
        const next = owned && stage===growth.nextStage;
        const cost = COMPANION_STAGE_COST[stage];
        const canRedeem = next && progress.points>=cost && !!onRedeemStage;
        return <button key={stage} type="button" disabled={!unlocked&&!canRedeem} aria-pressed={selected} onClick={event => {
          if(unlocked){pendingRef.current=null;setPending(null);onSelectStage?.(pet,stage);}
          else if(canRedeem){const request={pet,stage,cost};triggerRef.current=event.currentTarget;pendingRef.current=request;setPending(request);}
        }}>
          <CompanionPortrait pet={pet} design="storybook" stage={stage}/>
          <span>{copy[stage]}<span className="companion-design-check" aria-hidden="true">{selected ? '✓' : unlocked ? '' : '🔒'}</span></span>
          <small>{selected ? copy.selected : unlocked ? copy.unlocked : owned?label(copy.redeem,cost):copy.locked}</small>
          {!unlocked && owned && (!next||progress.points<cost) && <small className="companion-growth-remaining">{!next?copy.previous:label(copy.remaining,cost-progress.points)}</small>}
        </button>;
      })}
    </div>
    {quote&&<div className="companion-redemption-confirmation" role="group" aria-label={copy.confirmTitle}>
      <p>{label(copy.confirmMessage,quote.cost).replace('{stage}',copy[quote.stage])}</p>
      <div><button ref={cancelRef} type="button" onClick={cancel}>{copy.cancel}</button><button className="companion-redemption-confirm" type="button" disabled={!canConfirm} onClick={confirm}>{label(copy.confirmUse,quote.cost)}</button></div>
      {!canConfirm&&<small>{copy.unavailable}</small>}
    </div>}
    <p>{copy.help}{owned && growth.nextStage === null ? ` ${copy.grown}` : ''}</p>
  </section>;
}
