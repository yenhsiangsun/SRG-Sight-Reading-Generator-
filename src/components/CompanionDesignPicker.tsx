import type {PetCompanion, ProgressState} from '../progress/progress';
import {COMPANION_STAGES, COMPANION_STAGE_SECONDS, getCompanionGrowth, type CompanionStage} from '../progress/companionGrowth';
import {companionGrowthCopy} from '../progress/companionGrowthCopy';
import {useI18n} from '../i18n/context';
import {CompanionPortrait} from './CompanionPortrait';
import './CompanionDesignPicker.css';

/** The old art selector now offers earned stages; hidden art stays in the renderer. */
export function CompanionDesignPicker({pet, progress, onSelectStage}: {
  pet: PetCompanion | null;
  progress: ProgressState;
  onSelectStage?: (pet: PetCompanion | null, stage: CompanionStage | null) => void;
}) {
  const {locale} = useI18n();
  const copy = companionGrowthCopy(locale);
  const growth = getCompanionGrowth(progress, pet);
  const owned = pet === null || progress.cosmetics.includes(pet);
  const minutes = (seconds: number, remaining = false) => (remaining ? Math.ceil(Math.max(0, seconds) / 60) : Math.floor(Math.max(0, seconds) / 60)).toLocaleString(locale);
  const label = (template: string, seconds: number, remaining = false) => template.replace('{minutes}', minutes(seconds, remaining));
  const highest = COMPANION_STAGES.indexOf(growth.unlockedStage);
  return <section className="companion-design-picker" aria-label={copy.heading}>
    <div className="companion-growth-heading"><h3>{copy.heading}</h3><span>{owned ? label(copy.practiced, growth.seconds) : copy.purchaseFirst}</span></div>
    {owned && <button type="button" className="companion-growth-auto" aria-pressed={growth.selectedStage === null} onClick={() => onSelectStage?.(pet, null)}>
      <span aria-hidden="true">{growth.selectedStage === null ? '✓' : '○'}</span>{copy.auto}
    </button>}
    <div className="companion-design-options" role="group" aria-label={copy.heading}>
      {COMPANION_STAGES.map((stage, index) => {
        const unlocked = owned && index <= highest;
        const selected = unlocked && growth.displayStage === stage;
        return <button key={stage} type="button" disabled={!unlocked} aria-pressed={selected} onClick={() => onSelectStage?.(pet, stage)}>
          <CompanionPortrait pet={pet} design="storybook" stage={stage}/>
          <span>{copy[stage]}<span className="companion-design-check" aria-hidden="true">{selected ? '✓' : unlocked ? '' : '🔒'}</span></span>
          <small>{selected ? copy.selected : unlocked ? copy.unlocked : copy.locked}</small>
          {!unlocked && owned && <small className="companion-growth-remaining">{label(copy.remaining, COMPANION_STAGE_SECONDS[stage] - growth.seconds, true)}</small>}
        </button>;
      })}
    </div>
    <p>{copy.help}{owned && growth.nextUnlockSeconds === null ? ` ${copy.grown}` : ''}</p>
  </section>;
}
