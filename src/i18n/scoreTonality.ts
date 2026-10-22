import type {Locale} from './messages';
import {scaleLabel} from './musicLabels';
import {SCALES,type Tonality} from '../music/scales';

/** The actual modal centre is independent of its parent key signature.
 * Older scores without this information must not be guessed to be major. */
export function scoreTonalityLabel(tonality:Tonality|undefined,locale:Locale):string|null {
  if(!tonality)return null;
  const scale=SCALES.find(scale=>scale.id===tonality.scaleId);
  if(!scale)return null;
  const mode=scaleLabel(scale.id,scale.label,locale);
  return tonality.tonic&&scale.id!=='atonal'?`${tonality.tonic} · ${mode}`:mode;
}
