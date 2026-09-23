import {useId, useMemo, useState} from 'react';
import {useI18n} from '../i18n/context';
import type {ExerciseData} from '../music';
import type {PetCompanion} from '../progress/progress';
import {companionName} from '../progress/companionNames';
import {tipsForScore, type CompanionTip} from '../progress/companionTips';
import {CompanionPortrait} from './CompanionPortrait';
import './NoteCompanion.css';
import './PracticeCompanion.css';

export default function PracticeCompanion({exercise, pet, playing, metronomeOnly, examActive, completed}: {
  exercise: ExerciseData;
  pet: PetCompanion | null;
  playing: boolean;
  metronomeOnly: boolean;
  examActive: boolean;
  completed: boolean;
}) {
  const {locale, t} = useI18n();
  const contentId = useId();
  const [collapsed, setCollapsed] = useState(false);
  const [selection, setSelection] = useState({exercise, index: 0});
  const tips = useMemo(() => tipsForScore(exercise), [exercise]);
  // New scores start with a relevant cue; changing language or pets retains the current cue.
  const index = selection.exercise === exercise ? selection.index : 0;
  const focused = playing || examActive;
  const tip: CompanionTip = examActive ? 'tipExam' : playing ? (metronomeOnly ? 'tipClick' : 'tipPlaying') : completed && index === 0 ? 'tipComplete' : tips[index % tips.length];
  const name = companionName(pet, locale);
  const next = () => setSelection({exercise, index: index + 1});

  return <aside className={`practice-companion${collapsed ? ' is-collapsed' : ''}`} aria-label={name}>
    <button type="button" className="practice-companion__portrait" onClick={() => {
      if (collapsed) setCollapsed(false);
      else if (!focused) next();
    }} aria-label={`${name} · ${t(collapsed ? 'companionShow' : 'companionNext')}`} disabled={focused && !collapsed}>
      <CompanionPortrait pet={pet} closeUp animated={!focused}/>
    </button>
    <div className="practice-companion__body">
      <div className="practice-companion__heading"><strong>{name}</strong><button type="button" className="practice-companion__toggle" aria-expanded={!collapsed} aria-controls={contentId} onClick={() => setCollapsed(!collapsed)} aria-label={t(collapsed ? 'companionShow' : 'companionHide')} title={t(collapsed ? 'companionShow' : 'companionHide')}>{collapsed ? '+' : '−'}</button></div>
      <div id={contentId} hidden={collapsed}>
        <p className="practice-companion__message" aria-live={focused ? 'off' : 'polite'} aria-atomic="true">{t(tip)}</p>
        {!focused && <button type="button" className="practice-companion__next" onClick={next}>{t('companionNext')} <span aria-hidden="true">↗</span></button>}
      </div>
    </div>
  </aside>;
}
