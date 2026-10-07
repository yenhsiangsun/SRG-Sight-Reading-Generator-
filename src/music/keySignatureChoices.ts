import {TONICS, type Tonic} from './scales';

/** A signature names its conventional major-key spelling, not the study's mode. */
export type KeySignatureChoice = Tonic | 'open';
export const SHARP_SIGNATURES = ['G','D','A','E','B','F#','C#'] as const;
export const FLAT_SIGNATURES = ['F','Bb','Eb','Ab','Db','Gb','Cb'] as const;
export const KEY_SIGNATURE_CHOICES: readonly KeySignatureChoice[] = ['C',...SHARP_SIGNATURES,...FLAT_SIGNATURES,'open'];

export function validKeySignatureChoices(value: unknown): value is KeySignatureChoice[] | undefined {
  return value === undefined || (Array.isArray(value) && value.length <= KEY_SIGNATURE_CHOICES.length
    && value.every(choice => choice === 'open' || TONICS.includes(choice as Tonic)));
}

/** Legacy, empty and all-selected preferences retain the unrestricted generator. */
export function normalizeKeySignatureChoices(value?: readonly KeySignatureChoice[]): KeySignatureChoice[] | undefined {
  if (!value) return undefined;
  const choices = KEY_SIGNATURE_CHOICES.filter(choice => value.includes(choice));
  return choices.length && choices.length < KEY_SIGNATURE_CHOICES.length ? choices : undefined;
}
