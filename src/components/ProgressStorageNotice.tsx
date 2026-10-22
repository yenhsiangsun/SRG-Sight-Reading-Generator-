import {useI18n} from '../i18n/context';
import './ProgressStorageNotice.css';

export default function ProgressStorageNotice({warning, conflict = false, inline = false}: {warning: boolean; conflict?: boolean; inline?: boolean}) {
  const {t} = useI18n();
  if (!warning) return null;
  return <p className={`storage-note progress-storage-note${inline ? ' progress-storage-note--inline' : ''}`} data-progress-storage-notice role={inline ? undefined : 'status'} aria-live={inline ? undefined : 'polite'} aria-atomic={inline ? undefined : 'true'}>{t(conflict ? 'practiceRecordsConflict' : 'practiceRecordsTemporary')}</p>;
}
