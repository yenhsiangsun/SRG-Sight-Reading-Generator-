import { useId, useState } from 'react';
import {StaffRangePicker} from './StaffRangePicker';
import { useI18n } from '../i18n/context';
import { words } from '../progress/words';
import { instrumentLabel } from '../i18n/musicLabels';
import type { MessageKey } from '../i18n/messages';
import { INSTRUMENT_LIST } from '../music/instruments';
import { useCompactScreen } from '../hooks/useCompactScreen';
import { CLEFS, TIME_SIGNATURES, RANGE_OPTIONS, midiToNoteLabel } from '../exerciseConfig';
import type { ExerciseSettings } from '../hooks/useExercise';

type Change = <K extends keyof ExerciseSettings>(key: K, value: ExerciseSettings[K]) => void;

const families: Record<string, MessageKey> = {
  鍵盤: 'keyboard',
  弦樂: 'strings',
  木管: 'woodwinds',
  銅管: 'brass',
  其他: 'other',
  國樂・吹管: 'cnWind',
  國樂・彈撥: 'cnPlucked',
  國樂・拉弦: 'cnBowed',
  國樂・打擊: 'cnPercussion',
};

function Field<T extends string | number>({
  label,
  value,
  options,
  onChange,
  format,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  format?: (v: T) => string;
}) {
  const id = useId();
  return (
    <div className="control-group">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        value={value}
        onChange={(e) => {
          const v = options.find(item => String(item) === e.target.value);
          if (v !== undefined) onChange(v);
        }}
      >
        {options.map(v => (
          <option key={v} value={v}>
            {format ? format(v) : v}
          </option>
        ))}
      </select>
    </div>
  );
}

function Toggle({
  title,
  help,
  checked,
  onChange,
  disabled = false,
}: {
  title: string;
  help: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="option-row">
      <div>
        <label htmlFor={id}>{title}</label>
        <p>{help}</p>
      </div>
      <button
        id={id}
        type="button"
        className="switch"
        role="switch"
        aria-label={title}
        aria-checked={checked}
        disabled={disabled}
        onClick={onChange}
      >
        <span />
      </button>
    </div>
  );
}

export default function SetupPage({
  settings,
  change,
  onStart,
  error,
}: {
  settings: ExerciseSettings;
  change: Change;
  onStart: () => void;
  error: string;
}) {
  const { locale, t } = useI18n();
  const w = (zh: string, en: string, ja: string) => words(locale, zh, en, ja);
  const compact = useCompactScreen();
  const [step, setStep] = useState(0);
  const [family, setFamily] = useState('all');
  const [search, setSearch] = useState('');

  const chosen = INSTRUMENT_LIST.find(item => item.name === settings.instrument)!;
  const visible = INSTRUMENT_LIST.filter(
    item =>
      (family === 'all' || item.family === family) &&
      `${item.zh} ${item.name} ${instrumentLabel(item.name, locale)}`.toLowerCase().includes(search.toLowerCase()),
  );
  const titles = [t('chooseInstrument'), t('chooseRange'), t('chooseChallenge')];
  const mixedInvalid = settings.mixedMeters && settings.meters.length < 2;
  const levels = { Beginner: 'beginner', Intermediate: 'intermediate', Advanced: 'advanced' } as const;

  return (
    <main className="setup-layout" id="main">
      <aside className="setup-intro">
        <span className="eyebrow">{w('音樂練習室', 'PRACTICE STUDIO', '音楽練習室')}</span>
        <h1>{t('intro')}</h1>
        <p>{t('setupHelp')}</p>
        <nav className="steps" aria-label={t('setup')}>
          {(['instruments', 'rangeStaff', 'challenge'] as const).map((key, index) => (
            <button
              key={key}
              className={step === index ? 'current' : step > index ? 'complete' : ''}
              onClick={() => setStep(index)}
              aria-current={step === index ? 'step' : undefined}
            >
              <span>{step > index ? '✓' : `0${index + 1}`}</span>
              {t(key)}
            </button>
          ))}
        </nav>
        <div className="setup-summary">
          <span className="eyebrow">{w('本次練習', 'SESSION', '今回の練習')}</span>
          <strong>{instrumentLabel(settings.instrument, locale)}</strong>
          <p>
            {midiToNoteLabel(settings.rangeMinMidi)} — {midiToNoteLabel(settings.rangeMaxMidi)} / {t(levels[settings.difficulty])}
          </p>
        </div>
      </aside>
      <section className="setup-panel" aria-labelledby="setup-title">
        <div className="panel-heading">
          <span className="step-caption">{w('步驟', 'STEP', 'ステップ')} 0{step + 1} / 03</span>
          <h2 id="setup-title">{titles[step]}</h2>
        </div>
        <div className="setup-content">
          {step === 0 && (
            <>
              <div className="family-tabs" role="group" aria-label={t('instruments')}>
                {['all', ...new Set(INSTRUMENT_LIST.map(item => item.family))].map(value => (
                  <button key={value} aria-pressed={family === value} onClick={() => setFamily(value)}>
                    {t(value === 'all' ? 'all' : families[value])}
                  </button>
                ))}
              </div>
              <div className="instrument-search">
                <label htmlFor="instrument-search">{t('search')}</label>
                <input
                  type="search"
                  id="instrument-search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="instrument-grid">
                {visible.map(item => (
                  <button
                    key={item.name}
                    className={`instrument-card ${settings.instrument === item.name ? 'selected' : ''}`}
                    aria-pressed={settings.instrument === item.name}
                    onClick={() => change('instrument', item.name)}
                  >
                    <span className="instrument-family">
                      {t(families[item.family])}
                      <span className="selection-dot">{settings.instrument === item.name ? '✓' : ''}</span>
                    </span>
                    <strong>{instrumentLabel(item.name, locale)}</strong>
                    <span className="instrument-range">
                      {midiToNoteLabel(item.min)}–{midiToNoteLabel(item.max)}
                    </span>
                  </button>
                ))}
              </div>
              {!visible.length && <p role="status">{t('noResults')}</p>}
              <p className="field-note">{t('instrumentHelp')}</p>
            </>
          )}
          {step === 1 && (
            <>
              <fieldset className="choice-field">
                <legend>{t('rangeStaff')}</legend>
                <div className="clef-grid">
                  {CLEFS.map(clef => (
                    <button
                      key={clef}
                      className={`clef-card ${settings.clef === clef ? 'selected' : ''}`}
                      aria-pressed={settings.clef === clef}
                      onClick={() => change('clef', clef)}
                    >
                      <span className="clef-symbol" aria-hidden="true">
                        {clef === 'mixedStaff' ? '𝄞 ↔ 𝄢' : clef === 'grand' ? '𝄞 𝄢' : clef === 'treble' ? '𝄞' : clef === 'bass' ? '𝄢' : '𝄡'}
                      </span>
                      <strong>{t(clef)}</strong>
                      {clef === 'mixedStaff' && <small>{t('mixedStaffDetail')}</small>}
                    </button>
                  ))}
                </div>
              </fieldset>
              {settings.clef === 'grand' && <p className="field-note">{t(settings.instrument === 'Piano' || settings.instrument === 'Yangqin' ? 'grandHelp' : 'grandMonoHelp')}</p>}
              {settings.clef === 'mixedStaff' && <p className="field-note">{t('mixedStaffHelp')}</p>}
              <StaffRangePicker settings={settings} onMin={value=>change('rangeMinMidi',value)} onMax={value=>change('rangeMaxMidi',value)}/>
              <details><summary>{w('用音名精確調整','Adjust by note name','音名で細かく調整')}</summary>
              <div className="two-fields">
                <Field
                  label={t('minimum')}
                  value={settings.rangeMinMidi}
                  options={RANGE_OPTIONS.filter(midi => midi < settings.rangeMaxMidi)}
                  format={midiToNoteLabel}
                  onChange={(v) => change('rangeMinMidi', v)}
                />
                <Field
                  label={t('maximum')}
                  value={settings.rangeMaxMidi}
                  options={RANGE_OPTIONS.filter(midi => midi > settings.rangeMinMidi)}
                  format={midiToNoteLabel}
                  onChange={(v) => change('rangeMaxMidi', v)}
                />
              </div>
              </details>
              <div className="instrument-reference">
                <strong>{instrumentLabel(settings.instrument, locale)}</strong>
                <p>
                  {t('reference')}: {midiToNoteLabel(chosen.min)}–{midiToNoteLabel(chosen.max)}
                  {chosen.transpose !== 0 && (
                    <>
                      {' '}
                      · {t('sounding')}: {midiToNoteLabel(chosen.min + chosen.transpose)}–{midiToNoteLabel(chosen.max + chosen.transpose)}
                    </>
                  )}
                </p>
                <p>{locale === 'zh-TW' ? chosen.note : t(settings.instrument === 'Voice' ? 'voiceHelp' : 'modelHelp')}</p>
                <p>
                  {t('transpose')}: {chosen.transpose}
                </p>
                {chosen.source && (
                  <a href={chosen.source} target="_blank" rel="noreferrer">
                    {t('source')}
                  </a>
                )}
                <div className="range-actions">
                  <button
                    className="quiet-button"
                    onClick={() => {
                      change('rangeMinMidi', chosen.min);
                      change('rangeMaxMidi', chosen.max);
                    }}
                  >
                    {t('applyRange')}
                  </button>
                  {settings.instrument === 'Piano' && (
                    <button
                      className="quiet-button"
                      onClick={() => {
                        change('rangeMinMidi', 48);
                        change('rangeMaxMidi', 84);
                      }}
                    >
                      {t('pianoRange')}
                    </button>
                  )}
                </div>
                {(settings.rangeMinMidi < chosen.min || settings.rangeMaxMidi > chosen.max) && (
                  <p className="validation-note">{t('outside')}</p>
                )}
              </div>
              <Field
                label={t('length')}
                value={compact ? Math.min(settings.measureCount, 8) : settings.measureCount}
                options={compact ? [4, 8] : [4, 8, 12, 16]}
                onChange={(v) => change('measureCount', v)}
              />
              <p className="field-note">{t('phoneHelp')}</p>
            </>
          )}
          {step === 2 && (
            <>
              <fieldset className="choice-field">
                <legend>{t('pitchDifficulty')}</legend>
                <div className="difficulty-grid">
                  {(['Beginner', 'Intermediate', 'Advanced'] as const).map((difficulty, index) => (
                    <button
                      key={difficulty}
                      className={`difficulty-card ${settings.difficulty === difficulty ? 'selected' : ''}`}
                      aria-pressed={settings.difficulty === difficulty}
                      onClick={() => change('difficulty', difficulty)}
                    >
                      <span className="level-number">0{index + 1}</span>
                      <strong>{t(levels[difficulty])}</strong>
                      <small>{t(({Beginner:'beginnerPitch',Intermediate:'intermediatePitch',Advanced:'advancedPitch'} as const)[difficulty])}</small>
                    </button>
                  ))}
                </div>
              </fieldset>
              <p className="field-note">{t('pitchDifficultyHelp')}</p>
              <div className="two-fields">
                <Field
                  label={t('rhythm')}
                  value={settings.rhythmLevel}
                  options={['Simple', 'Moderate', 'Complex'] as const}
                  format={(v) => t(({ Simple: 'simple', Moderate: 'moderate', Complex: 'complex' } as const)[v])}
                  onChange={(v) => change('rhythmLevel', v)}
                />
                <Field
                  label={t('meter')}
                  value={settings.timeSignature}
                  options={TIME_SIGNATURES}
                  onChange={(v) => change('timeSignature', v)}
                />
              </div>
              <p className="field-note">{t('rhythmDifficultyHelp')}</p>
              <div className="advanced-options">
                <Toggle
                  title={words(locale,'演奏記號練習','Expression practice','演奏記号の練習')}
                  help={words(locale,'加入力度、斷奏、保持音與重音；播放會反映記號。','Add dynamics, staccato, tenuto and accents to the score and playback.','強弱・スタッカート・テヌート・アクセントを楽譜と再生に反映します。')}
                  checked={settings.performanceMarks ?? true}
                  onChange={() => change('performanceMarks', !(settings.performanceMarks ?? true))}
                />
                <Toggle
                  title={t('chromatic')}
                  help={t('chromaticDifficultyHelp')}
                  checked={settings.allowAccidentals}
                  onChange={() => change('allowAccidentals', !settings.allowAccidentals)}
                />
                <Toggle
                  title={t('mixed')}
                  help={t('mixedHelp')}
                  checked={settings.mixedMeters}
                  onChange={() => change('mixedMeters', !settings.mixedMeters)}
                />
              </div>
              {settings.mixedMeters && (
                <fieldset className="choice-field meter-field">
                  <legend>{t('meter')}</legend>
                  <div className="meter-options">
                    {TIME_SIGNATURES.map(meter => (
                      <button
                        key={meter}
                        aria-pressed={settings.meters.includes(meter)}
                        onClick={() =>
                          change(
                            'meters',
                            settings.meters.includes(meter)
                              ? settings.meters.filter(v => v !== meter)
                              : [...settings.meters, meter],
                          )
                        }
                      >
                        {meter}
                      </button>
                    ))}
                  </div>
                  {mixedInvalid && <p role="status" className="validation-note">{t('mixedHelp')}</p>}
                </fieldset>
              )}
            </>
          )}

          {error && <p role="alert" className="error-message">{locale === 'zh-TW' ? error : t('error')}</p>}


        </div>
        <div className="setup-actions">
          <button className="quiet-button" disabled={step === 0} onClick={() => setStep(step - 1)}>
            {t('previous')}
          </button>
          {step < 2 ? (
            <button className="primary-button" onClick={() => setStep(step + 1)}>
              {t('next')}
            </button>
          ) : (
            <button className="primary-button" disabled={mixedInvalid} onClick={onStart}>
              {t('start')}
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
