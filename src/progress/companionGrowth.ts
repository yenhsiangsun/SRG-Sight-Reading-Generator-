import type {PetCompanion, ProgressState} from './progress';

export const COMPANION_STAGES = ['baby', 'young', 'adult'] as const;
export type CompanionStage = typeof COMPANION_STAGES[number];
export const COMPANION_STAGE_SECONDS: Record<CompanionStage, number> = {baby: 0, young: 1800, adult: 10800};
export const ORIGINAL_COMPANION_KEY = 'original';

export interface CompanionGrowthRecord {
  seconds: number;
  /** null follows the oldest unlocked form automatically. */
  selectedStage: CompanionStage | null;
}

export type CompanionGrowthState = Partial<Record<PetCompanion | typeof ORIGINAL_COMPANION_KEY, CompanionGrowthRecord>>;

const MAX_PRACTICE_SECONDS = 1_000_000_000;
const companionKey = (pet: PetCompanion | null) => pet ?? ORIGINAL_COMPANION_KEY;
const ownedCompanion = (state: ProgressState, pet: PetCompanion | null) => pet === null || state.cosmetics.includes(pet);

function practiceSeconds(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.round(Math.min(value, MAX_PRACTICE_SECONDS) * 1000) / 1000
    : 0;
}

function stageAt(seconds: number): CompanionStage {
  return seconds >= COMPANION_STAGE_SECONDS.adult ? 'adult' : seconds >= COMPANION_STAGE_SECONDS.young ? 'young' : 'baby';
}

function stageAllowed(stage: unknown, unlocked: CompanionStage): stage is CompanionStage {
  return COMPANION_STAGES.some(candidate => candidate === stage)
    && COMPANION_STAGES.indexOf(stage as CompanionStage) <= COMPANION_STAGES.indexOf(unlocked);
}

/** Old saves begin at zero; reward XP cannot be converted into invented practice time. */
export function normalizeCompanionGrowth(raw: unknown, owned: readonly PetCompanion[]): CompanionGrowthState {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const saved = raw as Record<string, unknown>;
  const normalized: CompanionGrowthState = {};
  for (const key of [ORIGINAL_COMPANION_KEY, ...owned] as const) {
    const record = saved[key];
    if (!record || typeof record !== 'object' || Array.isArray(record)) continue;
    const values = record as Record<string, unknown>;
    const seconds = practiceSeconds(values.seconds);
    normalized[key] = {seconds, selectedStage: stageAllowed(values.selectedStage, stageAt(seconds)) ? values.selectedStage : null};
  }
  return normalized;
}

export function getCompanionGrowth(state: ProgressState, pet: PetCompanion | null) {
  const record = ownedCompanion(state, pet) ? state.companionGrowth?.[companionKey(pet)] : undefined;
  const seconds = practiceSeconds(record?.seconds);
  const unlockedStage = stageAt(seconds);
  const requestedStage = record?.selectedStage;
  const selectedStage = stageAllowed(requestedStage, unlockedStage) ? requestedStage : null;
  return {
    seconds,
    unlockedStage,
    selectedStage,
    displayStage: selectedStage ?? unlockedStage,
    nextUnlockSeconds: unlockedStage === 'adult' ? null : COMPANION_STAGE_SECONDS[unlockedStage === 'baby' ? 'young' : 'adult'],
  };
}

/** The caller credits the pet equipped during this interval, including an effect's final flush. */
export function recordCompanionPractice(state: ProgressState, pet: PetCompanion | null, seconds: number): ProgressState {
  if (!ownedCompanion(state, pet) || !Number.isFinite(seconds) || seconds <= 0) return state;
  const current = getCompanionGrowth(state, pet);
  const total = practiceSeconds(current.seconds + seconds);
  if (total === current.seconds) return state;
  return {
    ...state,
    companionGrowth: {...state.companionGrowth, [companionKey(pet)]: {seconds: total, selectedStage: current.selectedStage}},
  };
}

export function selectCompanionStage(state: ProgressState, pet: PetCompanion | null, stage: CompanionStage | null): ProgressState {
  if (!ownedCompanion(state, pet)) return state;
  const current = getCompanionGrowth(state, pet);
  if (stage !== null && !stageAllowed(stage, current.unlockedStage)) return state;
  if (stage === current.selectedStage) return state;
  return {
    ...state,
    companionGrowth: {...state.companionGrowth, [companionKey(pet)]: {seconds: current.seconds, selectedStage: stage}},
  };
}
