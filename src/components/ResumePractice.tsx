import type {LastPractice} from '../practice/resume';
import {resumeBar} from '../practice/resume';
import {useI18n} from '../i18n/context';
import {resumeCopy} from '../i18n/resumeCopy';
import {instrumentLabel} from '../i18n/musicLabels';
import {tempoMark} from '../audio/tempo';
import './ResumePractice.css';

export default function ResumePractice({last, onResume}: {last: LastPractice; onResume: () => void}) {
  const {locale} = useI18n();
  const copy = resumeCopy(locale);
  return <section className="resume-practice" aria-label={copy.title}>
    <div><h2>{copy.title}</h2><p>{instrumentLabel(last.study.settings.instrument, locale)} · {tempoMark(last.study.exercise!, last.study.bpm)}</p><small>{copy.position.replace('{bar}', String(resumeBar(last)))}</small></div>
    <button className="primary-button" onClick={onResume}>{copy.title} <span aria-hidden="true">→</span></button>
  </section>;
}
