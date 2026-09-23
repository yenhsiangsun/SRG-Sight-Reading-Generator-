import test from 'node:test';
import assert from 'node:assert/strict';
import { loadModule } from './helpers.mjs';

const { createProgress, normalizeProgress, recordPractice, redeemReward, getLevel, dayKey, unequipPet, REWARDS, PET_IDS } = loadModule('src/progress/progress.ts');
const today = new Date(2026, 8, 12, 23, 59, 59);
const tomorrow = new Date(2026, 8, 13, 0, 0, 1);
const plain = value => JSON.parse(JSON.stringify(value));

test('practice rewards distinct completions once and keeps practice available after the daily reward cap', () => {
  const initial = createProgress(today);
  const first = recordPractice(initial, 'score-one', today);
  assert.equal(first.awarded, true);
  assert.equal(first.state.xp, 20);
  assert.equal(first.state.points, 10);
  assert.equal(first.state.today.count, 1);
  assert.equal(initial.today.count, 0, 'the previous state must remain immutable');
  const duplicate = recordPractice(first.state, ' score-one ', today);
  assert.equal(duplicate.awarded, false);
  assert.deepEqual(plain(duplicate.state), plain(first.state));
  let state = first.state;
  for (const id of ['score-two', 'score-three']) state = recordPractice(state, id, today).state;
  const fourth = recordPractice(state, 'score-four', today);
  assert.equal(fourth.awarded, false);
  assert.equal(fourth.state.today.count, 4);
  assert.equal(fourth.state.xp, 60);
  assert.equal(fourth.state.points, 30);
  assert.deepEqual(Array.from(fourth.state.practiceDays), ['2026-09-12']);
  assert.equal(recordPractice(fourth.state, '', today).state.today.count, 4);
});

test('local midnight resets daily rewards without losing history or awarding a repeated score', () => {
  let state = createProgress(today);
  for (let i = 0; i < 3; i++) state = recordPractice(state, `score-${i}`, today).state;
  const restored = normalizeProgress(state, tomorrow);
  assert.equal(dayKey(tomorrow), '2026-09-13');
  assert.equal(restored.today.count, 0);
  assert.equal(restored.xp, 60);
  const duplicate = recordPractice(state, 'score-0', tomorrow);
  assert.equal(duplicate.awarded, false);
  assert.equal(duplicate.state.today.count, 0);
  const next = recordPractice(state, 'next-day-score', tomorrow);
  assert.equal(next.awarded, true);
  assert.equal(next.state.xp, 80);
  assert.equal(next.state.today.count, 1);
  assert.deepEqual(Array.from(next.state.practiceDays), ['2026-09-12', '2026-09-13']);
});

test('persistence rejects invalid counters, calendar dates, unknown versions and unowned pets', () => {
  for (const raw of [null, undefined, [], 'invalid', {}, { version: 2, xp: 1000 }]) {
    assert.deepEqual(plain(normalizeProgress(raw, today)), plain(createProgress(today)));
  }
  const restored = normalizeProgress({
    version: 1, xp: Infinity, points: -20,
    today: { date: '2026-09-12', count: 1.5 },
    practiceDays: ['2026-09-12', '2026-09-12', '2026-02-30', '2026-09-13', null, 'bad'],
    completedSessions: ['one', '', null, 'two', ' one ', 'x'.repeat(129)],
    cosmetics: ['unknown'], activeAccent: 'amber',
    premium: true,
  }, today);
  assert.equal(restored.xp, 0);
  assert.equal(restored.points, 0);
  assert.equal(restored.today.count, 0);
  assert.deepEqual(Array.from(restored.practiceDays), ['2026-09-12']);
  assert.deepEqual(Array.from(restored.completedSessions), ['two', 'one']);
  assert.deepEqual(Array.from(restored.cosmetics), []);
  assert.equal(restored.activePet, null);
  assert.equal('activeAccent' in restored, false);
  assert.equal('premium' in restored, false);
  assert.equal(normalizeProgress({ ...restored, xp: NaN, points: Number.MAX_SAFE_INTEGER + 1 }, today).points, 0);
});

test('history is bounded and retains recent records after restoring and adding a completion', () => {
  const date = new Date(2026, 8, 12, 12);
  const days = Array.from({ length: 500 }, (_, i) => {
    const d = new Date(2025, 0, 1 + i, 12);
    return dayKey(d);
  });
  const state = normalizeProgress({
    ...createProgress(date),
    completedSessions: Array.from({ length: 700 }, (_, i) => `score-${i}`),
    practiceDays: days,
  }, date);
  assert.equal(state.completedSessions.length, 512);
  assert.equal(state.completedSessions[0], 'score-188');
  assert.equal(state.completedSessions.at(-1), 'score-699');
  assert.equal(state.practiceDays.length, 365);
  assert.equal(state.practiceDays.at(-1), days.at(-1));
  const next = recordPractice(state, 'new-score', date).state;
  assert.equal(next.completedSessions.length, 512);
  assert.equal(next.completedSessions.at(-1), 'new-score');
  assert.equal(next.practiceDays.length, 365);
  assert.equal(next.practiceDays.at(-1), '2026-09-12');
});

test('cosmetic redemption requires earned points, charges once, and permits free switching', () => {
  const initial = createProgress(today);
  const insufficient = redeemReward({ ...initial, points: 49 }, 'pet-moonrabbit', today);
  assert.equal(insufficient.redeemed, false);
  assert.equal(insufficient.state.points, 49);
  assert.equal(insufficient.state.activePet, null);
  const redeemed = redeemReward({ ...initial, points: 55 }, 'pet-moonrabbit', today);
  assert.equal(redeemed.redeemed, true);
  assert.equal(redeemed.state.points, 5);
  assert.equal(redeemed.state.activePet, 'pet-moonrabbit');
  assert.deepEqual(Array.from(redeemed.state.cosmetics), ['pet-moonrabbit']);
  const again = redeemReward(redeemed.state, 'pet-moonrabbit', today);
  assert.equal(again.redeemed, true);
  assert.equal(again.state.points, 5);
  const original = unequipPet(again.state, today);
  assert.equal(original.activePet, null);
  assert.equal(original.points, 5);
  assert.equal(redeemReward(original, '__proto__', today).redeemed, false);
  assert.equal(redeemReward(original, 'amber', today).redeemed, false);
  assert.equal(redeemReward(original, 'mint', today).redeemed, false);
});

test('level progress remains finite and changes exactly at each 100 XP boundary', () => {
  for (const [xp, level, current] of [[0, 1, 0], [99, 1, 99], [100, 2, 0], [240, 3, 40], [-10, 1, 0], [Infinity, 1, 0], [NaN, 1, 0]]) {
    assert.deepEqual(plain(getLevel(xp)), { level, current, needed: 100 });
  }
});

test('the free original remains available before purchase and after switching or reload', () => {
  const initial = createProgress(today);
  assert.equal(initial.activePet, null);
  assert.equal(unequipPet(initial, today).activePet, null);
  let state = {...initial, points: 1000};
  for (const pet of PET_IDS) {
    const purchased = redeemReward(state, pet, today);
    assert.equal(purchased.redeemed, true);
    assert.equal(purchased.state.activePet, pet);
    const original = unequipPet(purchased.state, today);
    assert.equal(original.activePet, null);
    assert.equal(original.points, purchased.state.points);
    assert.deepEqual(plain(original.cosmetics), plain(purchased.state.cosmetics));
    const reloaded = normalizeProgress(plain(original), today);
    assert.equal(reloaded.activePet, null, 'reload must not replace the original with a paid lark');
    state = redeemReward(reloaded, pet, today).state;
    assert.equal(state.activePet, pet);
    assert.equal(state.points, original.points, 'already owned companions equip without another charge');
  }
});

test('retired colors are removed and amber stars are refunded once without losing pets or practice', () => {
  const saved = {...createProgress(today), cosmetics: ['mint','amber','amber','pet-lily'], activeAccent: 'amber', activePet: 'pet-lily', points: 100, xp: 80, completedSessions: ['kept-score']};
  const migrated = normalizeProgress(saved, today);
  assert.equal(migrated.points, 160);
  assert.equal(migrated.xp, 80);
  assert.equal(migrated.activePet, 'pet-lily');
  assert.deepEqual(Array.from(migrated.cosmetics), ['pet-lily']);
  assert.deepEqual(Array.from(migrated.completedSessions), ['kept-score']);
  assert.deepEqual(plain(normalizeProgress(plain(migrated), today)), plain(migrated));
  assert.equal(normalizeProgress({...saved, cosmetics:['mint']}, today).points, 100);
  assert.equal(REWARDS.length, PET_IDS.length);
  assert.ok(REWARDS.every(reward => reward.type === 'pet' && PET_IDS.includes(reward.id)));
});

test('legacy unowned lark defaults restore the original without losing earned rewards', () => {
  const saved = {...createProgress(today), activePet: 'pet-celeste', points: 75, xp: 240};
  const restored = normalizeProgress(saved, today);
  assert.equal(restored.activePet, null);
  assert.equal(restored.points, 75);
  assert.equal(restored.xp, 240);
  const owned = normalizeProgress({...saved, cosmetics: ['mint', 'pet-celeste']}, today);
  assert.equal(owned.activePet, 'pet-celeste');
  assert.equal(normalizeProgress({...saved, activePet: 'pet-musicfox'}, today).activePet, null);
});

test('practice clock isolates each score and excludes paused and hidden-tab time', () => {
  let now = 0, slot = 0, nextTimer = 0;
  const slots = [], effects = [], timers = new Map(), listeners = new Map();
  const react = {
    useState(initial) {
      const index = slot++;
      if (!(index in slots)) slots[index] = { value: typeof initial === 'function' ? initial() : initial };
      return [slots[index].value, update => { slots[index].value = typeof update === 'function' ? update(slots[index].value) : update; }];
    },
    useRef(initial) {
      const index = slot++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useEffect(effect, dependencies) {
      const index = slot++, old = slots[index];
      if (!old || dependencies.some((value, i) => value !== old.dependencies[i])) {
        effects.push(() => { old?.cleanup?.(); slots[index] = { dependencies, cleanup: effect() }; });
      }
    },
  };
  const document = {
    hidden: false,
    addEventListener: (type, listener) => listeners.set(type, listener),
    removeEventListener: type => listeners.delete(type),
  };
  const { usePracticeClock } = loadModule('src/progress/useProgress.ts', 90210, undefined, { react }, {
    document,
    performance: { now: () => now },
    setInterval: callback => { const id = ++nextTimer; timers.set(id, callback); return id; },
    clearInterval: id => timers.delete(id),
  });
  const render = function ClockHarness(session, enabled = true) {
    slot = 0;
    const seconds = usePracticeClock(session, enabled);
    while (effects.length) effects.shift()();
    return seconds;
  };
  const advance = milliseconds => {
    for (let elapsed = 0; elapsed < milliseconds; elapsed += 500) {
      now += 500;
      for (const timer of timers.values()) timer();
    }
  };
  assert.equal(render('score-one'), 0);
  advance(60_000);
  assert.equal(render('score-one'), 60);
  assert.equal(render('score-two'), 0, 'a new score cannot inherit a ready-to-claim 60 seconds');
  advance(1_000);
  assert.equal(render('score-two'), 1);
  render('score-two', false);
  advance(20_000);
  assert.equal(render('score-two', true), 1, 'resuming preserves only earlier practice time');
  document.hidden = true;
  listeners.get('visibilitychange')();
  advance(20_000);
  assert.equal(render('score-two'), 1, 'background time earns no progress');
  document.hidden = false;
  listeners.get('visibilitychange')();
  advance(1_000);
  assert.equal(render('score-two'), 2);
  assert.equal(render(null), 0);
});
