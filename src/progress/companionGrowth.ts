import type {PetCompanion, ProgressState} from './progress';

export const COMPANION_STAGES = ['baby', 'young', 'adult'] as const;
export type CompanionStage = typeof COMPANION_STAGES[number];
export const COMPANION_STAGE_COST: Record<CompanionStage, number> = {baby: 0, young: 100, adult: 400};
export const ORIGINAL_COMPANION_KEY = 'original';

export interface CompanionGrowthRecord {
  /** Archived old-version time only; new practice never increments it. */
  seconds: number;
  /** Highest redeemed form, including forms preserved from old time-based saves. */
  unlockedStage: CompanionStage;
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

function stageAllowed(stage: unknown, unlocked: CompanionStage): stage is CompanionStage {
  return COMPANION_STAGES.some(candidate => candidate === stage)
    && COMPANION_STAGES.indexOf(stage as CompanionStage) <= COMPANION_STAGES.indexOf(unlocked);
}

function growthRecord(raw: unknown): CompanionGrowthRecord {
  const record = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string,unknown> : {};
  const seconds = practiceSeconds(record.seconds);
  // Old unlocked forms stay free. Archived time is never incremented again,
  // and wallet stars never unlock a form until an explicit redemption.
  const legacyStage = seconds >= 10800 ? 'adult' : seconds >= 1800 ? 'young' : 'baby';
  const unlockedStage = COMPANION_STAGES[Math.max(COMPANION_STAGES.indexOf(legacyStage),COMPANION_STAGES.indexOf(record.unlockedStage as CompanionStage))];
  return {seconds,unlockedStage,selectedStage:stageAllowed(record.selectedStage,unlockedStage)?record.selectedStage:null};
}

/** Each companion retains its own redeemed forms and appearance. */
export function normalizeCompanionGrowth(raw: unknown, owned: readonly PetCompanion[]): CompanionGrowthState {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const saved = raw as Record<string, unknown>;
  const normalized: CompanionGrowthState = {};
  for (const key of [ORIGINAL_COMPANION_KEY, ...owned] as const) {
    const record = saved[key];
    if (!record || typeof record !== 'object' || Array.isArray(record)) continue;
    normalized[key] = growthRecord(record);
  }
  return normalized;
}

export function getCompanionGrowth(state: ProgressState, pet: PetCompanion | null) {
  const {unlockedStage,selectedStage} = growthRecord(ownedCompanion(state, pet) ? state.companionGrowth?.[companionKey(pet)] : undefined);
  const nextStage:CompanionStage|null = unlockedStage === 'adult' ? null : unlockedStage === 'baby' ? 'young' : 'adult';
  return {
    unlockedStage,
    selectedStage,
    displayStage: selectedStage ?? unlockedStage,
    nextStage,
    nextCost:nextStage===null?null:COMPANION_STAGE_COST[nextStage],
  };
}

/** An explicit purchase, charged once from the same wallet as companion pets. */
export function redeemCompanionStage(state: ProgressState, pet: PetCompanion | null, stage: CompanionStage): ProgressState {
  if (!ownedCompanion(state, pet)) return state;
  const available = getCompanionGrowth(state,pet);
  if(stage!==available.nextStage)return state;
  const cost = COMPANION_STAGE_COST[stage];
  if(!Number.isSafeInteger(state.points)||state.points<cost)return state;
  const current = growthRecord(state.companionGrowth?.[companionKey(pet)]);
  return {
    ...state,
    points:state.points-cost,
    companionGrowth: {...state.companionGrowth, [companionKey(pet)]: {...current,unlockedStage:stage,selectedStage:stage}},
  };
}

export function selectCompanionStage(state: ProgressState, pet: PetCompanion | null, stage: CompanionStage | null): ProgressState {
  if (!ownedCompanion(state, pet)) return state;
  const current = getCompanionGrowth(state, pet);
  if (stage !== null && !stageAllowed(stage, current.unlockedStage)) return state;
  if (stage === current.selectedStage) return state;
  return {
    ...state,
    companionGrowth: {...state.companionGrowth, [companionKey(pet)]: {...growthRecord(state.companionGrowth?.[companionKey(pet)]),selectedStage:stage}},
  };
}
