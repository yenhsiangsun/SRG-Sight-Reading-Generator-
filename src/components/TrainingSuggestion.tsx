import {useI18n} from '../i18n/context';
import type {TrainingAdvice} from '../practice/training';
export default function TrainingSuggestion({advice,busy,onApply}:{advice:TrainingAdvice|null;busy:boolean;onApply:()=>void}){
  const {t}=useI18n();
  if(!advice)return null;
  const value=advice.settings.difficulty??advice.settings.rhythmLevel;
  const labels={Beginner:'beginner',Intermediate:'intermediate',Advanced:'advanced',Simple:'simple',Moderate:'moderate',Complex:'complex'} as const;
  return <aside className="training-suggestion"><div><strong>{t('trainingTitle')}</strong><p>{t(advice.direction==='up'?'trainingUp':'trainingDown')} · {t(advice.axis==='pitch'?'pitchDifficulty':advice.axis==='rhythm'?'rhythm':'tempo')} → {value?t(labels[value]):advice.tempo+' BPM'}</p><small>{t('trainingHelp')}</small></div>
    <button className="secondary-button" disabled={busy} onClick={onApply}>{t('trainingApply')}</button></aside>;
}
