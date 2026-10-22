import type {SavedStudy} from './library';
import {translate,type Locale} from '../i18n/messages';
import {instrumentLabel,scaleLabel} from '../i18n/musicLabels';
import {getScale} from '../music/scales';
import {tempoMark} from '../audio/tempo';
import {normalizeMixedClefs} from '../notation/mixedClefs';
import {selectedPracticeFocus,practiceFocusMessage} from './focus';

const levels={Beginner:'beginner',Intermediate:'intermediate',Advanced:'advanced'} as const;
const rhythms={Simple:'simple',Moderate:'moderate',Complex:'complex'} as const;
const normalize=(text:string)=>text.normalize('NFKC').toLowerCase().replaceAll('♯','#').replaceAll('♭','b');

/** Search the identity already shown on each shelf entry, without changing or
 * sorting saved objects. Stable English names also work in a localized shelf. */
export function searchLibrary(studies:SavedStudy[],query:string,locale:Locale):SavedStudy[]{
  const tokens=normalize(query).trim().split(/\s+/).filter(Boolean);
  if(!tokens.length)return studies;
  return studies.filter(study=>{
    const settings=study.settings,tonality=study.exercise?.tonality;
    const scale=tonality?getScale(tonality.scaleId):null;
    const clefs=settings.clef==='mixedStaff'?normalizeMixedClefs(study.exercise?.mixedClefs??settings.mixedClefs):[settings.clef];
    const fields=[settings.instrument,instrumentLabel(settings.instrument,locale),
      tonality?.tonic??'',scale?scaleLabel(scale.id,scale.label,locale):'',scale?.id??'',
      settings.timeSignature,...(settings.mixedMeters?settings.meters:[]),settings.mixedMeters?translate(locale,'mixed'):'',
      translate(locale,levels[settings.difficulty]),settings.difficulty,
      translate(locale,rhythms[settings.rhythmLevel]),settings.rhythmLevel,
      ...clefs.flatMap(clef=>[clef,translate(locale,clef)]),
      ...selectedPracticeFocus(settings).map(focus=>translate(locale,practiceFocusMessage[focus])),
      study.exercise?tempoMark(study.exercise,study.bpm):`${study.bpm} BPM`,String(study.bpm)];
    const text=normalize(fields.join(' '));
    return tokens.every(token=>text.includes(token));
  });
}
