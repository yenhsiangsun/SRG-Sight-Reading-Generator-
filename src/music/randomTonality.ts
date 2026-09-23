import {buildPitchMaterial, describeTonality, getScale, SCALES, TONICS, type Tonic, type Tonality} from './scales';
import type {Difficulty} from '../music';

interface PitchRange {min: number; max: number}
export interface RandomTonality {tonic: Tonic; scaleId: string}
export interface TonalitySelectionOptions {allowAccidentals?: boolean; difficulty?: Difficulty}
export type SignatureGroup = 'sharp' | 'flat' | 'natural' | 'open';
// Practice both kinds of key signatures regularly without inventing signatures
// for chromatic, symmetric or traditional-scale adaptations.
export const SIGNATURE_WEIGHTS: Record<SignatureGroup, number> = {sharp: 35, flat: 35, natural: 10, open: 20};
export const QUIET_SIGNATURE_WEIGHTS: Record<SignatureGroup, number> = {sharp: 35, flat: 35, natural: 25, open: 5};
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

  return SCALES.map(scale => {
    const candidates = (scale.id === 'atonal' ? ['C'] as const : TONICS)
      .map(tonic => ({tonic, tonality: describeTonality(tonic, scale.id)}))
      .filter(candidate => ranges.every(range => buildPitchMaterial(candidate.tonality, range).pitches.length > 0));
    const cost = Math.min(...candidates.map(candidate => spellingCost(candidate.tonality,options)));
    return {scaleId: scale.id, candidates: candidates.filter(candidate => spellingCost(candidate.tonality,options) === cost)
      .map(candidate => ({tonic: candidate.tonic, group: signatureGroup(candidate.tonality.signature), alterations:requiredAccidentalCount(candidate.tonality)}))};
  }).filter(scale => scale.candidates.length > 0);
}

/** Pick a signature group, then a scale and tonic; one tonality serves the whole score. */
export function selectRandomTonality(ranges: readonly PitchRange[], random: () => number = Math.random, options: TonalitySelectionOptions = {}): RandomTonality {
  const choices = getTonalityChoices(ranges,options);
  const quiet = options.allowAccidentals === false;
  const weights = quiet ? QUIET_SIGNATURE_WEIGHTS : SIGNATURE_WEIGHTS;
  const groups = (Object.keys(weights) as SignatureGroup[]).map(group => ({
    group, weight: weights[group], scales: choices.map(scale => {
      const candidates = scale.candidates.filter(candidate => candidate.group === group);
      const alterations = Math.min(...candidates.map(candidate => candidate.alterations));
      return {scaleId:scale.scaleId, tonics:candidates.map(candidate => candidate.tonic),
        weight:quiet ? 1 / (1 + alterations * alterations) : 1};
    }).filter(scale => scale.tonics.length > 0),
  })).filter(group => group.scales.length > 0);
  // Renormalize over available groups for narrow/custom ranges. Within each group,
  // choose the scale before the tonic so sparse scales are not crowded out.
  const total = groups.reduce((sum, group) => sum + group.weight, 0);
  let position = Math.min(1 - Number.EPSILON, Math.max(0, random())) * total;
  const selectedGroup = groups.find(group => (position -= group.weight) < 0) ?? groups[groups.length - 1];
  const pick = <T,>(items: readonly T[]): T => items[Math.min(items.length - 1, Math.max(0, Math.floor(random() * items.length)))];
  const scaleWeight = selectedGroup.scales.reduce((sum,scale) => sum + scale.weight,0);
  let scalePosition = Math.min(1-Number.EPSILON,Math.max(0,random())) * scaleWeight;
  const selected = selectedGroup.scales.find(scale => (scalePosition -= scale.weight) < 0) ?? selectedGroup.scales.at(-1)!;
  return {scaleId: selected.scaleId, tonic: pick(selected.tonics)};
}
