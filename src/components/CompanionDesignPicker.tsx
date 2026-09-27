import type {PetCompanion} from '../progress/progress';
import {useCompanionDesign} from '../progress/useCompanionDesign';
import {companionDesignCopy} from '../progress/companionDesignCopy';
import {useI18n} from '../i18n/context';
import {CompanionPortrait} from './CompanionPortrait';
import './CompanionDesignPicker.css';

export function CompanionDesignPicker({pet}: {pet: PetCompanion | null}) {
  const {locale} = useI18n();
  const copy = companionDesignCopy(locale);
  const {design, setDesign} = useCompanionDesign();
  return <section className="companion-design-picker" aria-label={copy.heading}>
    <h3>{copy.heading}</h3>
    <div className="companion-design-options" role="group" aria-label={copy.heading}>
      {(['classic', 'storybook'] as const).map(value => <button key={value} type="button" aria-pressed={design === value} onClick={() => setDesign(value)}>
        <CompanionPortrait pet={pet} design={value}/>
        <span>{copy[value]}<span className="companion-design-check" aria-hidden="true">{design === value ? '✓' : ''}</span></span>
      </button>)}
    </div>
    <p>{copy.help}</p>
  </section>;
}
