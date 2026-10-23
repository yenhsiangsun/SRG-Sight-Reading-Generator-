import {normalizeCompanionGrowth, type CompanionGrowthState} from './companionGrowth';
export {getCompanionGrowth, type CompanionStage} from './companionGrowth';

export const PET_IDS = ['pet-celeste', 'pet-musicfox', 'pet-lily', 'pet-moonrabbit', 'pet-nocturne', 'pet-bamboo', 'pet-penguin', "pet-dragon", "pet-snowbird", "pet-kiwi", "pet-blackbear", "pet-otter", "pet-kangaroo", "pet-lion", 'pet-ragdoll', 'pet-mainecoon', 'pet-calico', 'pet-orange', 'pet-bluecat', 'pet-husky', 'pet-shiba', 'pet-poodle'] as const;
export type PetCompanion = typeof PET_IDS[number];
export type RewardId = PetCompanion;

export function isPetCompanion(value: unknown): value is PetCompanion {
  return PET_IDS.some(id => id === value);
}

export interface RewardDefinition {
  id: RewardId;
  type: 'pet';
  name: Record<'zh' | 'en' | 'ja', string>;
  cost: number;
  description: Record<'zh' | 'en' | 'ja', string>;
}

export const REWARDS: RewardDefinition[] = [
  {id: 'pet-mainecoon', type: 'pet', name: {zh: '小精靈：緬因貓', en: 'Pet: Maine Coon', ja: 'ペット：メインクーン'}, cost: 85, description: {zh: '蓬鬆耳尖的溫柔大貓，陪你慢慢長大。', en: 'A gentle tuft-eared cat that grows with your practice.', ja: 'ふわふわの耳を持つ優しい猫。一緒に成長するよ。'}},
  {id: 'pet-calico', type: 'pet', name: {zh: '小精靈：三花貓', en: 'Pet: Calico Cat', ja: 'ペット：三毛猫'}, cost: 70, description: {zh: '暖白、橘與黑的三色小夥伴。', en: 'A warm white, orange and black companion.', ja: '白・オレンジ・黒の三色の小さな仲間。'}},
  {id: 'pet-orange', type: 'pet', name: {zh: '小精靈：橘貓', en: 'Pet: Orange Tabby', ja: 'ペット：茶トラ猫'}, cost: 65, description: {zh: '像午後陽光一樣溫暖的橘色小貓。', en: 'An orange cat as warm as afternoon sunshine.', ja: '午後の日差しのように温かな茶トラ猫。'}},
  {id: 'pet-bluecat', type: 'pet', name: {zh: '小精靈：藍貓', en: 'Pet: Blue Cat', ja: 'ペット：ブルーキャット'}, cost: 70, description: {zh: '柔和灰藍色的小貓，安靜陪你數拍。', en: 'A soft blue-gray cat that quietly counts beats with you.', ja: '青灰色の猫が静かに拍を数えてくれるよ。'}},
  {id: 'pet-husky', type: 'pet', name: {zh: '小精靈：哈士奇', en: 'Pet: Husky', ja: 'ペット：ハスキー'}, cost: 80, description: {zh: '精神滿滿的雪地小夥伴。', en: 'A lively snowy companion for every practice.', ja: '元気いっぱいの雪国の仲間。'}},
  {id: 'pet-shiba', type: 'pet', name: {zh: '小精靈：柴犬', en: 'Pet: Shiba Inu', ja: 'ペット：柴犬'}, cost: 75, description: {zh: '捲捲尾巴的柴犬，帶著笑容陪你練習。', en: 'A smiling Shiba with a curled tail.', ja: 'くるんとした尻尾の柴犬が笑顔で応援するよ。'}},
  {id: 'pet-poodle', type: 'pet', name: {zh: '小精靈：貴賓犬', en: 'Pet: Poodle', ja: 'ペット：プードル'}, cost: 75, description: {zh: '捲毛小狗，用輕快的步伐陪你前進。', en: 'A curly-coated dog with a spring in its step.', ja: 'くるくる毛の犬が軽やかに寄り添うよ。'}},
  {id: 'pet-ragdoll', type: 'pet', name: {zh: '小精靈：雲朵布偶貓', en: 'Pet: Cloud Ragdoll', ja: 'ペット：ふわ雲ラグドール'}, cost: 75, description: {zh: '每次練習都會陪伴你', en: 'A companion that joins each practice session', ja: '毎回の練習に一緒に寄り添う'}},
  {"id":"pet-dragon","type":"pet","name":{"zh":"小精靈：暮光幼龍","en":"Pet: Twilight Dragon","ja":"ペット：夕暮れのちびドラゴン"},"cost":95,"description":{"zh":"每次練習都會陪伴你","en":"A companion that joins each practice session","ja":"毎回の練習に一緒に寄り添う"}},
  {"id":"pet-snowbird","type":"pet","name":{"zh":"小精靈：北海道雪糰","en":"Pet: Hokkaido Snowbird","ja":"ペット：シマエナガ"},"cost":75,"description":{"zh":"每次練習都會陪伴你","en":"A companion that joins each practice session","ja":"毎回の練習に一緒に寄り添う"}},
  {"id":"pet-kiwi","type":"pet","name":{"zh":"小精靈：紐西蘭奇異鳥","en":"Pet: New Zealand Kiwi","ja":"ペット：ニュージーランドのキーウィ"},"cost":80,"description":{"zh":"每次練習都會陪伴你","en":"A companion that joins each practice session","ja":"毎回の練習に一緒に寄り添う"}},
  {"id":"pet-blackbear","type":"pet","name":{"zh":"小精靈：台灣黑熊","en":"Pet: Taiwan Black Bear","ja":"ペット：台湾ツキノワグマ"},"cost":90,"description":{"zh":"每次練習都會陪伴你","en":"A companion that joins each practice session","ja":"毎回の練習に一緒に寄り添う"}},
  {"id":"pet-otter","type":"pet","name":{"zh":"小精靈：河畔水獺","en":"Pet: River Otter","ja":"ペット：川辺のカワウソ"},"cost":75,"description":{"zh":"每次練習都會陪伴你","en":"A companion that joins each practice session","ja":"毎回の練習に一緒に寄り添う"}},
  {"id":"pet-kangaroo","type":"pet","name":{"zh":"小精靈：澳洲袋鼠","en":"Pet: Australian Kangaroo","ja":"ペット：オーストラリアのカンガルー"},"cost":85,"description":{"zh":"每次練習都會陪伴你","en":"A companion that joins each practice session","ja":"毎回の練習に一緒に寄り添う"}},
  {"id":"pet-lion","type":"pet","name":{"zh":"小精靈：暖陽獅子","en":"Pet: Sunshine Lion","ja":"ペット：ひだまりライオン"},"cost":90,"description":{"zh":"每次練習都會陪伴你","en":"A companion that joins each practice session","ja":"毎回の練習に一緒に寄り添う"}},
  { id: 'pet-celeste', type: 'pet', name: { zh: '小精靈：雲雀', en: 'Metronome pet: Lark', ja: 'メトロノーム:ひばり' }, cost: 40, description: { zh: '每次練習都會陪伴你', en: 'A companion that joins each practice session', ja: '毎回の練習に一緒に寄り添う' } },
  { id: 'pet-musicfox', type: 'pet', name: { zh: '小精靈：音狐', en: 'Pet: Music fox', ja: 'ペット：音狐' }, cost: 55, description: { zh: '連續作答時會幫你加速專注', en: 'Helps you stay focused during longer runs', ja: '長い練習でも集中を保てる' } },
  { id: 'pet-lily', type: 'pet', name: { zh: '小精靈：狸子', en: 'Pet: Raccoon', ja: 'ペット：タヌキ' }, cost: 45, description: { zh: '擊節奏時給你微笑鼓勵', en: 'Rewards rhythm work with small cheer prompts', ja: 'リズムで頑張るたびにささやかな称賛' } },
  { id: 'pet-moonrabbit', type: 'pet', name: { zh: '小精靈：月兔', en: 'Pet: Moon Bunny', ja: 'ペット：月うさぎ' }, cost: 50, description: { zh: '奶油白長耳兔，陪你輕輕數拍。', en: 'A cream-colored bunny with long rose-lined ears.', ja: 'クリーム色の長い耳で、そっと拍を数えるうさぎ。' } },
  {"id":"pet-nocturne","type":"pet","name":{"zh":"小精靈：銀紋美短貓","en":"Pet: American Shorthair","ja":"ペット：アメリカンショートヘア"},"cost":65,"description":{"zh":"每次練習都會陪伴你","en":"A companion that joins each practice session","ja":"毎回の練習に一緒に寄り添う"}},
  { id: 'pet-bamboo', type: 'pet', name: { zh: '小精靈：竹音熊貓', en: 'Pet: Bamboo Panda', ja: 'ペット：竹音パンダ' }, cost: 70, description: { zh: '圓滾滾的熊貓，竹綠色節拍器與你一起呼吸。', en: 'A round panda with a bamboo-green metronome.', ja: '竹色のメトロノームを持つ、まんまるパンダ。' } },
  {"id":"pet-penguin","type":"pet","name":{"zh":"小精靈：藍拍企鵝","en":"Pet: Little Blue Penguin","ja":"ペット：コガタペンギン"},"cost":80,"description":{"zh":"每次練習都會陪伴你","en":"A companion that joins each practice session","ja":"毎回の練習に一緒に寄り添う"}},
];

/** Local practice rewards only: these points never represent purchased credit. */
export interface ProgressState {
  version: 1;
  xp: number;
  points: number;
  practiceDays: string[];
  completedSessions: string[];
  today: { date: string; count: number };
  cosmetics: RewardId[];
  /** null is the permanently free original Mimo; reward pets keep their own IDs. */
  activePet: PetCompanion | null;
  /** Redeemed growth forms, independent for each companion. */
  companionGrowth: CompanionGrowthState;
}

const SESSION_HISTORY_LIMIT = 512;
const DAY_HISTORY_LIMIT = 365;
const MAX_COUNTER = 1_000_000_000;
const DAILY_REWARDED_PRACTICES = 3;

function counter(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? Math.min(value, MAX_COUNTER)
    : 0;
}

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

/** Uses the user's local calendar, so a UTC date change does not reset rewards. */
export function dayKey(now: Date): string {
  const date = Number.isFinite(now.getTime()) ? now : new Date();
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

function validDay(value: unknown, today: string): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value > today) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return year >= 1970 && date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function sessionKey(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const key = value.trim();
  return key.length > 0 && key.length <= 128 ? key : null;
}

export function createProgress(now: Date = new Date()): ProgressState {
  return {
    version: 1,
    xp: 0,
    points: 0,
    practiceDays: [],
    completedSessions: [],
    today: { date: dayKey(now), count: 0 },
    cosmetics: [],
    activePet: null,
    companionGrowth: {},
  };
}

/** Restores only recognized fields and drops invalid or unknown schema versions. */
export function normalizeProgress(raw: unknown, now: Date = new Date()): ProgressState {
  const initial = createProgress(now);
  const saved = object(raw);
  if (!saved || saved.version !== 1) return initial;
  const today = object(saved.today);
  const owned: RewardId[] = [];
  if (Array.isArray(saved.cosmetics)) {
    for (const value of saved.cosmetics) {
      if (isPetCompanion(value) && !owned.includes(value)) owned.push(value);
    }
  }
  const activePet = isPetCompanion(saved.activePet) && owned.includes(saved.activePet)
    ? saved.activePet
    : null;
  const sessions = Array.isArray(saved.completedSessions)
    ? saved.completedSessions.map(sessionKey).filter((key): key is string => key !== null)
    : [];
  // Keep the newest occurrence when repairing duplicate persisted identifiers.
  const completedSessions = [...new Set(sessions.reverse())].reverse().slice(-SESSION_HISTORY_LIMIT);
  const practiceDays = Array.isArray(saved.practiceDays)
    ? [...new Set(saved.practiceDays.filter((day): day is string => validDay(day, initial.today.date)))].sort().slice(-DAY_HISTORY_LIMIT)
    : [];
  return {
    version: 1,
    xp: counter(saved.xp),
    // The retired amber reward cost 60 stars. Removing its ownership marker
    // makes this a one-time refund when the normalized state is saved.
    points: Math.min(MAX_COUNTER, counter(saved.points) + (Array.isArray(saved.cosmetics) && saved.cosmetics.includes('amber') ? 60 : 0)),
    practiceDays,
    completedSessions,
    today: { date: initial.today.date, count: today?.date === initial.today.date ? counter(today.count) : 0 },
    cosmetics: owned,
    activePet,
    companionGrowth: normalizeCompanionGrowth(saved.companionGrowth, owned),
  };
}

/** A level takes 100 XP; `current / needed` is progress within this level. */
export function getLevel(xp: number): { level: number; current: number; needed: number } {
  const total = counter(xp);
  return { level: Math.floor(total / 100) + 1, current: total % 100, needed: 100 };
}

/** Called only after a meaningful practice completion, never on score generation. */
export function recordPractice(state: ProgressState, sessionId: string, now: Date = new Date()): { state: ProgressState; awarded: boolean } {
  const current = normalizeProgress(state, now);
  const key = sessionKey(sessionId);
  if (!key || current.completedSessions.includes(key)) return { state: current, awarded: false };
  const awarded = current.today.count < DAILY_REWARDED_PRACTICES;
  const next: ProgressState = {
      ...current,
      xp: Math.min(MAX_COUNTER, current.xp + (awarded ? 20 : 0)),
      points: Math.min(MAX_COUNTER, current.points + (awarded ? 10 : 0)),
      practiceDays: [...new Set([...current.practiceDays, current.today.date])].sort().slice(-DAY_HISTORY_LIMIT),
      completedSessions: [...current.completedSessions, key].slice(-SESSION_HISTORY_LIMIT),
      today: { ...current.today, count: Math.min(MAX_COUNTER, current.today.count + 1) },
  };
  return {state:next,awarded};
}

/** Redeems a reward and equips it if already owned, or purchases it first. */
export function redeemReward(state: ProgressState, rewardId: RewardId, now: Date = new Date()): { state: ProgressState; redeemed: boolean } {
  const current = normalizeProgress(state, now);
  const reward = REWARDS.find(item => item.id === rewardId);
  if (!reward) return { state: current, redeemed: false };
  if (current.cosmetics.includes(rewardId)) {
    return {
      state: { ...current, activePet: reward.id },
      redeemed: true,
    };
  }
  const cost = reward.cost;
  if (current.points < cost) return { state: current, redeemed: false };
  return {
    state: { ...current, points: current.points - cost, cosmetics: [...current.cosmetics, reward.id], activePet: reward.id },
    redeemed: true,
  };
}

export function unequipPet(state: ProgressState, now: Date = new Date()): ProgressState {
  const current = normalizeProgress(state, now);
  return { ...current, activePet: null };
}
