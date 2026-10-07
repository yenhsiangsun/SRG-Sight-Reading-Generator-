import {INSTRUMENTS, type Instrument} from '../music/instruments';

export const INSTRUMENT_PREFERENCE_KEY = 'sight-reading-instrument-v1';

export function loadPreferredInstrument(): Instrument {
  try {
    const saved = localStorage.getItem(INSTRUMENT_PREFERENCE_KEY);
    if (saved && Object.hasOwn(INSTRUMENTS, saved)) return saved as Instrument;
  } catch { /* Storage may be unavailable; the first-use default still works. */ }
  return 'Piano';
}

export function rememberInstrument(instrument: Instrument): void {
  try { localStorage.setItem(INSTRUMENT_PREFERENCE_KEY, instrument); }
  catch { /* Keep the current selection usable even when persistence is blocked. */ }
}
