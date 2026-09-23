import {useState} from 'react';
import {useI18n} from '../i18n/context';
import type {ScorePdfOptions} from '../export/exportScorePdf';
import './ScorePdfExport.css';

export default function ScorePdfExport({disabled, ...options}: ScorePdfOptions & {disabled: boolean}) {
  const {t} = useI18n();
  const [busy, setBusy] = useState(false), [error, setError] = useState(false);
  const download = async () => {
    if (busy || disabled) return;
    setBusy(true); setError(false);
    try {
      const {downloadScorePdf} = await import('../export/exportScorePdf');
      await downloadScorePdf(options);
    } catch {setError(true);}
    finally {setBusy(false);}
  };
  return <div className="pdf-export">
    <button className="secondary-button" disabled={disabled || busy} aria-busy={busy} onClick={() => void download()}>
      <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m-4-4 4 4 4-4M5 15v5h14v-5"/></svg>
      {t(busy ? 'exportingPdf' : 'exportPdf')}
    </button>
    {error && <span className="pdf-export-error" role="alert">{t('pdfError')}</span>}
  </div>;
}
