import {useEffect, useState} from 'react';
import {useI18n} from '../i18n/context';
import type {PetCompanion} from '../progress/progress';
import './NoteCompanion.css';
import {CompanionPortrait} from './CompanionPortrait';
import {words} from '../progress/words';
import type {Locale} from '../i18n/messages';
import {companionName} from '../progress/companionNames';
import {generalTips} from '../progress/companionTips';

export interface NoteCompanionProps {
  level: number;
  points: number;
  todayCount: number;
  dailyGoal: number;
  quiet?: boolean;
  pet?: PetCompanion | null;
  onRewards: () => void;
}

const copy = {
  companion: { zh: '節拍器小精靈', en: 'Metronome companion', ja: 'メトロノーム・コンパニオン' },
  today: { zh: '今日練習', en: 'Today’s practice', ja: '今日の練習' },
  done: { zh: '今天的目標完成了，做得好。', en: 'Today’s goal is complete. Nicely done.', ja: '今日の目標を達成。おつかれさま。' },
  points: { zh: '星點', en: 'Stars', ja: 'スター' },
  rewards: { zh: '探索獎勵', en: 'Explore rewards', ja: 'ごほうびを見る' },
  quiet: { zh: '我在這裡，陪你專心。', en: 'Right here, while you focus.', ja: 'ここで、そっと応援しています。' },
} as const;

type CompanionLocale = 'zh' | 'en' | 'ja';

const localizedText = (locale: Locale, value: Readonly<Record<CompanionLocale, string>>) => words(locale, value.zh, value.en, value.ja);


/** A silent companion; its visual rewards never interrupt the score or audio clock. */
export function NoteCompanion({level, points, todayCount, dailyGoal, quiet = false, pet = null, onRewards}: NoteCompanionProps) {
  const {locale, t} = useI18n();
  const petId = pet;
  const word = (key: keyof typeof copy) => localizedText(locale, copy[key]);
  const petName = companionName(petId, locale);
  const className = `note-companion note-companion--pet-${petId ?? 'original'}${quiet ? ' note-companion--quiet' : ''}`;
  const [interaction, setInteraction] = useState(0);
  const [greeting, setGreeting] = useState(false);
  const goal = Math.max(1, Math.floor(dailyGoal));
  const count = Math.max(0, Math.floor(todayCount));
  const progress = Math.min(count, goal);

  useEffect(() => {
    if (!greeting) return;
    const timer = window.setTimeout(() => setGreeting(false), 750);
    return () => window.clearTimeout(timer);
  }, [greeting, interaction]);

  const greet = () => {
    setInteraction(value => value + 1);
    setGreeting(true);
  };

  return <aside className={className} aria-label={`${petName} · ${word('companion')}`}>
    <div className="note-companion__heading">
      <div><h2>{petName}</h2></div>
      <span className="note-companion__level">Lv. {Math.max(1, Math.floor(level))}</span>
    </div>

    <button type="button" className={`note-companion__pet${greeting ? ' is-greeting' : ''}`} onClick={greet} aria-label={words(locale,'和{name}互動，看看練習小提醒','Tap {name} for a practice tip','{name}をタップして練習のヒントを見る').replace('{name}',petName)}>
      <CompanionPortrait pet={petId} className="note-companion__illustration" animated={!quiet}/>
      {!quiet && <span className="note-companion__touch">{words(locale,'點點我，讓練習多一點靈感','A little tap. A little inspiration.','タッチして、練習のヒントを。')}<span aria-hidden="true">↗</span></span>}
    </button>

    <div className="note-companion__tip" aria-live="polite" aria-atomic="true">
      <span className="note-companion__tip-mark" aria-hidden="true">“</span>
      <p>{quiet ? word('quiet') : t(generalTips[interaction % generalTips.length])}</p>
    </div>
    <div className="note-companion__goal">
      <div><span>{word('today')}</span><strong>{count}<span> / {goal}</span><span className="note-companion__goal-check" aria-hidden="true">{count >= goal ? ' ✓' : ''}</span></strong></div>
      <progress value={progress} max={goal} aria-label={`${word('today')} ${count} / ${goal}`}/>
      {count >= goal && <span className="note-companion__done">{word('done')}</span>}
    </div>
    <div className="note-companion__footer">
      <div className="note-companion__points"><span className="note-companion__coin" aria-hidden="true">♪</span><span><strong>{Math.max(0, Math.floor(points)).toLocaleString(locale)}</strong><small>{word('points')}</small></span></div>
      <button className="note-companion__rewards" type="button" onClick={onRewards}>{word('rewards')}<span aria-hidden="true">↗</span></button>
    </div>
  </aside>;
}


