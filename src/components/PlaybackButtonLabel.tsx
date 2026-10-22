import {useI18n} from '../i18n/context';
import './PlaybackButtonLabel.css';

type PlaybackLabel = 'play' | 'loadingAudio' | 'resume';
const labels: readonly PlaybackLabel[] = ['play','loadingAudio','resume'];

export default function PlaybackButtonLabel({label}:{label:PlaybackLabel}) {
  const {t}=useI18n();
  return <span className="playback-button-label">{labels.map(key=>
    <span key={key} aria-hidden={key===label?undefined:true}>{t(key)}</span>
  )}</span>;
}
