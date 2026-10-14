import {buildPitchMaterial, describeTonality, getScale, SCALES, TONICS, type Tonic, type Tonality} from './scales';
import type {Difficulty} from '../music';
import {normalizeKeySignatureChoices, type KeySignatureChoice} from './keySignatureChoices';

interface PitchRange {min: number; max: number}
export interface RandomTonality {tonic: Tonic; scaleId: string}
export interface TonalitySelectionOptions {allowAccidentals?: boolean; difficulty?: Difficulty; allowedKeySignatures?: readonly KeySignatureChoice[]}
export type SignatureGroup = 'sharp' | 'flat' | 'natural' | 'open';
// Practice both kinds of key signatures regularly without inventing signatures
// for chromatic, symmetric or traditional-scale adaptations.
export const SIGNATURE_WEIGHTS: Record<SignatureGroup, number> = {sharp: 35, flat: 35, natural: 10, open: 20};
export const QUIET_SIGNATURE_WEIGHTS: Record<SignatureGroup, number> = {sharp: 35, flat: 35, natural: 25, open: 5};
export type TonalityFamily = 'major-minor-modes' | 'pentatonic' | 'colour';
// Give the musical families a share of practice, independent of how many labels
// happen to be in the catalog. This applies to every instrument alike.
export const TONALITY_FAMILY_WEIGHTS: Record<TonalityFamily, number> = {
  'major-minor-modes': 65, pentatonic: 25, colour: 10,
};
const tonalModes = new Set(['major', 'natural-minor', 'harmonic-minor', 'melodic-minor',
  'dorian', 'phrygian', 'lydian', 'mixolydian', 'locrian']);
const modeWeights: Record<string, number> = {
  major: 3, 'natural-minor': 2.5, 'harmonic-minor': 1, 'melodic-minor': 1,
  dorian: 1.5, phrygian: 1, lydian: 1, mixolydian: 1.5, locrian: .5,
};
export function tonalityFamily(scaleId: string): TonalityFamily {
  return tonalModes.has(scaleId) ? 'major-minor-modes'
    : getScale(scaleId).intervals.length === 5 ? 'pentatonic' : 'colour';
}
export function signatureGroup(signature: string | null): SignatureGroup {
  return signature === null ? 'open' : signature === 'C' ? 'natural' : signature === 'F' || signature.includes('b') ? 'flat' : 'sharp';
}

const signatureSize: Record<string, number> = {
  C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, 'F#': 6, 'C#': 7,
  F: 1, Bb: 2, Eb: 3, Ab: 4, Db: 5, Gb: 6, Cb: 7,
};

/** Notes needing a written alteration beyond the signature, not extra chromatic notes. */
export function requiredAccidentalCount(tonality: Tonality): number {
  const signatureNotes = describeTonality((tonality.signature ?? 'C') as Tonic,'major').notes;
  return tonality.notes.filter(note => !signatureNotes.includes(note)).length;
}

function spellingCost(tonality: Tonality, options: TonalitySelectionOptions): number {
  // Keep theoretical spellings in the scale library, but favor readable equivalents here.
  const doubles = tonality.notes.reduce((sum, note) => sum + Math.max(0, note.length - 2), 0);
  const missingParent = getScale(tonality.scaleId).parent && !tonality.signature ? 20 : 0;
  const quiet = options.allowAccidentals === false;
  const limit = quiet ? {beginner:2, intermediate:3, advanced:4}[options.difficulty ?? 'beginner'] : 4;
  const busySignature = Math.max(0, (signatureSize[tonality.signature ?? 'C'] ?? 7) - limit);
  // Open-key scales used to choose flat-heavy transpositions as readily as mostly
  // natural ones. Keep the scale, but choose its least cluttered valid spelling.
  const alterations = quiet ? requiredAccidentalCount(tonality) : 0;
  return doubles * 100 + missingParent * 10 + busySignature * 10 + alterations;
}

/** Readable options that supply notes to every requested staff range. */
export function getTonalityChoices(ranges: readonly PitchRange[], options: TonalitySelectionOptions = {}) {
  if (!ranges.length || ranges.some(range => !Number.isInteger(range.min) || !Number.isInteger(range.max) || range.min < 0 || range.max > 127 || range.min > range.max)) {
    throw new Error('請選擇有效的音域，最低音不能高於最高音。');
  }

  const allowed = normalizeKeySignatureChoices(options.allowedKeySignatures);
  return SCALES.map(scale => {
    const candidates = (scale.id === 'atonal' ? ['C'] as const : TONICS)
      .map(tonic => ({tonic, tonality: describeTonality(tonic, scale.id)}))
      .filter(candidate => !allowed || (allowed.includes((candidate.tonality.signature ?? 'open') as KeySignatureChoice)
        // A missing theoretical parent signature is not an open-key scale.
        && (candidate.tonality.signature !== null || !getScale(scale.id).parent)))
      .filter(candidate => ranges.every(range => buildPitchMaterial(candidate.tonality, range).pitches.length > 0));
    const cost = Math.min(...candidates.map(candidate => spellingCost(candidate.tonality,options)));
    return {scaleId: scale.id, candidates: candidates.filter(candidate => {
      // Explicit choices are equally eligible even when the default difficulty
      // heuristic would prefer a simpler signature. Optimize spelling within it.
      const minimum = allowed ? Math.min(...candidates.filter(other => other.tonality.signature === candidate.tonality.signature)
        .map(other => spellingCost(other.tonality,options))) : cost;
      return spellingCost(candidate.tonality,options) === minimum;
    }).map(candidate => ({tonic: candidate.tonic, signature: candidate.tonality.signature,
      group: signatureGroup(candidate.tonality.signature), alterations:requiredAccidentalCount(candidate.tonality)}))};
  }).filter(scale => scale.candidates.length > 0);
}

/** Normalized, eligible choices; useful for auditing the actual practice mix. */
export function getTonalityDistribution(ranges: readonly PitchRange[], options: TonalitySelectionOptions = {}): (RandomTonality & {weight: number})[] {
  const choices = getTonalityChoices(ranges,options);
  const quiet = options.allowAccidentals === false;
  const allowed = normalizeKeySignatureChoices(options.allowedKeySignatures);
  const signatures = allowed ? allowed.filter(signature => choices.some(scale =>
    scale.candidates.some(candidate => (candidate.signature ?? 'open') === signature))) : [undefined];
  if (!signatures.length) throw new Error('所選調號在目前音域沒有可用音高，請擴大音域或選擇其他調號。');
  const result: (RandomTonality & {weight: number})[] = [];
  const signatureWeights = quiet ? QUIET_SIGNATURE_WEIGHTS : SIGNATURE_WEIGHTS;
  for (const signature of signatures) {
    // Explicit key selections remain equally likely, even when one supports
    // fewer modes. Family shares are then normalized over what is playable.
    const eligible = choices.map(scale => ({...scale, candidates: scale.candidates.filter(candidate =>
      signature === undefined || (candidate.signature ?? 'open') === signature)})).filter(scale => scale.candidates.length);
    const families = (Object.entries(TONALITY_FAMILY_WEIGHTS) as [TonalityFamily, number][])
      .map(([family, weight]) => ({weight, scales: eligible.filter(scale => tonalityFamily(scale.scaleId) === family)}))
      .filter(family => family.scales.length);
    const familyTotal = families.reduce((sum, family) => sum + family.weight, 0);
    for (const family of families) {
      const shapes = new Map<string, typeof eligible>();
      for (const scale of family.scales) {
        const shape = getScale(scale.scaleId).intervals.join(',');
        shapes.set(shape, [...shapes.get(shape) ?? [], scale]);
      }
      // Shang/Egyptian/Slendro, and Zhi/Yo, share one sounding pattern each.
      // Extra names or spelling systems must not make that pattern more common.
      const patterns = [...shapes.values()].map(scales => {
        const alterations = Math.min(...scales.flatMap(scale => scale.candidates.map(candidate => candidate.alterations)));
        const weight = Math.max(...scales.map(scale => modeWeights[scale.scaleId] ?? 1))
          * (quiet ? 1 / (1 + alterations * alterations) : 1);
        return {scales, weight};
      });
      const patternTotal = patterns.reduce((sum, pattern) => sum + pattern.weight, 0);
      for (const pattern of patterns) {
        const groups = (Object.entries(signatureWeights) as [SignatureGroup, number][]).map(([group, weight]) => ({weight,
          scales: pattern.scales.map(scale => ({...scale, candidates: scale.candidates.filter(candidate => candidate.group === group)}))
            .filter(scale => scale.candidates.length),
        })).filter(group => group.scales.length);
        const groupTotal = groups.reduce((sum, group) => sum + group.weight, 0);
        for (const group of groups) for (const scale of group.scales) for (const candidate of scale.candidates) {
          result.push({scaleId: scale.scaleId, tonic: candidate.tonic,
            weight: 1 / signatures.length * family.weight / familyTotal * pattern.weight / patternTotal
              * group.weight / groupTotal / group.scales.length / scale.candidates.length});
        }
      }
    }
  }
  return result;
}

/** One balanced tonality serves the complete score and every requested staff. */
export function selectRandomTonality(ranges: readonly PitchRange[], random: () => number = Math.random, options: TonalitySelectionOptions = {}): RandomTonality {
  const choices = getTonalityDistribution(ranges, options);
  let position = Math.min(1 - Number.EPSILON, Math.max(0, random()));
  const selected = choices.find(choice => (position -= choice.weight) < 0) ?? choices.at(-1)!;
  return {scaleId: selected.scaleId, tonic: selected.tonic};
}
