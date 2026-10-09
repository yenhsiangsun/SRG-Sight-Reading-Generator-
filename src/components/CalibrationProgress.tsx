import type {ExamStage} from '../assessment/MicrophoneSession';
import type {Clef} from '../music';
import {useI18n} from '../i18n/context';
import CalibrationScore from './CalibrationScore';

/** Musical progress follows the microphone session's audio clock. */
export default function CalibrationProgress({stage,remaining,elapsed,clef,noteKey}:{stage:ExamStage;remaining:number;elapsed:number;clef:Clef;noteKey:string}) {
  const {t}=useI18n();
  const step=stage==='countin'?Math.min(4,Math.floor(elapsed)+1):Math.min(8,Math.floor(elapsed/.5)+1);
  const finishing=stage==='performing'&&elapsed>=4;
  const currentNote=stage==='performing'?step:0;
  const status=stage==='permission'?'…':stage==='reading'?`${t('calibrationPreparing')} · ${remaining} ${t('seconds')}`:stage==='countin'?t('calibrationCountInProgress').replace('{current}',String(step)):finishing?t('calibrationFinishing'):t('calibrationNoteProgress').replace('{current}',String(currentNote));
  return <>
    <div className="calibration-live-status" role="status" aria-atomic="true"><strong>{t('calibrationTitle')}</strong><output>{status}</output></div>
    <p className="calibration-note-guide">{t('calibrationStaffGuide')}</p>
    <CalibrationScore stage={stage} elapsed={elapsed} clef={clef} noteKey={noteKey} label={t('calibrationScoreLabel')}/>
  </>;
}
