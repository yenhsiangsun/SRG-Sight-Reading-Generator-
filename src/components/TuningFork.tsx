import {useEffect, useId, useRef, useState} from 'react';
import {useI18n} from '../i18n/context';
import {loadTuningFrequency, normalizeTuningFrequency, saveTuningFrequency, tuningFrequency, TuningForkController, type TuningStatus} from '../audio/tuningFork';
import {toneTuningAudio} from '../audio/toneTuningFork';
import './TuningFork.css';

function ForkIcon() {
  return <svg width="21" height="25" viewBox="0 0 24 28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M6 3v9a6 6 0 0 0 12 0V3M12 18v7M9 25h6"/><path d="M9 3v9a3 3 0 0 0 6 0V3"/></svg>;
}

export default function TuningFork({disabled}: {disabled: boolean}) {
  const {t} = useI18n();
  // Blocking audio unmounts the active session, canceling pending unlocks too.
  if (disabled) return <button className="tuning-trigger" disabled><ForkIcon/>{t('tuningFork')}</button>;
  return <TuningForkSession/>;
}

function TuningForkSession() {
  const {t, locale} = useI18n();
  const id = useId();
  const [frequency, setFrequency] = useState(loadTuningFrequency);
  const [draft, setDraft] = useState(() => String(frequency));
  const [status, setStatus] = useState<TuningStatus>('idle');
  const [open, setOpen] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const controller = useRef<TuningForkController | null>(null);
  const initialFrequency = useRef(frequency);

  useEffect(() => {
    const session = new TuningForkController(toneTuningAudio, setStatus, initialFrequency.current);
    controller.current = session;
    const hide = () => { if (document.hidden) session.stop(); };
    const leave = () => session.stop();
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('pagehide', leave);
    return () => {
      session.dispose();
      controller.current = null;
      document.removeEventListener('visibilitychange', hide);
      window.removeEventListener('pagehide', leave);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    field.current?.focus();
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) {
        controller.current?.stop();
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);

  function changeFrequency(value: number, updateDraft = true) {
    const next = normalizeTuningFrequency(value);
    setFrequency(next);
    if (updateDraft) setDraft(String(next));
    controller.current?.setFrequency(next);
    setStorageWarning(!saveTuningFrequency(next));
  }
  function close() {
    controller.current?.stop();
    setOpen(false);
    trigger.current?.focus();
  }
  const sounding = status === 'playing' || status === 'starting';
  const formatted = frequency.toLocaleString(locale, {maximumFractionDigits: 1});
  return <div ref={root} className="tuning-fork" onKeyDown={event => {
    if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); close(); }
  }}>
    <button ref={trigger} className={'tuning-trigger' + (sounding ? ' is-sounding' : '')}
      aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined}
      onClick={() => {
        if (open) close();
        else { setOpen(true); void controller.current?.start(); }
      }}><ForkIcon/>{t('tuningFork')}</button>
    {open && <section id={id} className="tuning-panel" role="dialog" aria-labelledby={`${id}-title`}>
      <div className="tuning-heading"><div><span>A4</span><h2 id={`${id}-title`}>{t('tuningFork')}</h2></div>
        <button className="tuning-close" aria-label={t('tuningClose')} onClick={close}>×</button></div>
      <p className="tuning-description">{t('tuningHelp')}</p>
      <label className="tuning-field-label" htmlFor={`${id}-frequency`}>{t('tuningFrequency')}</label>
      <div className="tuning-frequency-field">
        <input ref={field} id={`${id}-frequency`} type="number" inputMode="decimal"
          min={tuningFrequency.min} max={tuningFrequency.max} step={tuningFrequency.step} value={draft}
          onChange={event => {
            setDraft(event.currentTarget.value);
            if (event.currentTarget.validity.valid && event.currentTarget.value !== '') changeFrequency(event.currentTarget.valueAsNumber, false);
          }}
          onBlur={event => {
            const value = event.currentTarget.valueAsNumber;
            if (Number.isFinite(value)) changeFrequency(value);
            else { setDraft(String(frequency)); controller.current?.setFrequency(frequency); }
          }}
          onKeyDown={event => {if(event.key === 'Enter')event.currentTarget.blur();}}/>
        <span>Hz</span>
      </div>
      <input className="tuning-slider" type="range" aria-label={`${t('tuningFrequency')} Hz`}
        min={tuningFrequency.min} max={tuningFrequency.max} step={tuningFrequency.step} value={frequency}
        onChange={event => changeFrequency(event.currentTarget.valueAsNumber)}/>
      <div className="tuning-range"><span>400 Hz</span><span>480 Hz</span></div>
      <div className="tuning-actions">
        <button className="tuning-sound" onClick={() => {if(sounding)controller.current?.stop();else void controller.current?.start();}}>
          <span aria-hidden="true">{sounding ? '■' : '▶'}</span>{t(sounding ? 'tuningStop' : 'tuningPlay')}
        </button>
        <button className="tuning-reset" onClick={() => changeFrequency(tuningFrequency.default)}>{t('tuningReset')}</button>
      </div>
      <p className="tuning-status" role={status === 'error' ? 'alert' : 'status'}>{status === 'error' ? t('tuningError')
        : status === 'starting' ? t('loadingAudio')
        : status === 'playing' ? `${t('tuningPlaying')} · A4 = ${formatted} Hz`
        : t(storageWarning ? 'tuningTemporary' : 'tuningSaved')}</p>
    </section>}
  </div>;
}
