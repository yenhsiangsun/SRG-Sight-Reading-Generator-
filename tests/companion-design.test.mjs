import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

const {createCompanionDesignStore, normalizeCompanionDesign, COMPANION_DESIGN_KEY} = loadModule('src/progress/companionDesign.ts');
const {createProgress, normalizeProgress, redeemReward, unequipPet, REWARDS} = loadModule('src/progress/progress.ts');
const {companionDesignCopy} = loadModule('src/progress/companionDesignCopy.ts');

test('companion design switches every subscriber immediately and persists independently of reward points', () => {
  const values = new Map();
  const storage = {getItem: key => values.get(key), setItem: (key, value) => values.set(key, value)};
  const store = createCompanionDesignStore(() => storage);
  let updates = 0;
  const unsubscribe = store.subscribe(() => updates++);
  assert.equal(store.getSnapshot(), 'classic', 'existing companions must retain their original appearance');
  store.set('storybook');
  assert.equal(updates, 1);
  assert.equal(store.getSnapshot(), 'storybook');
  assert.equal(values.get(COMPANION_DESIGN_KEY), 'storybook');
  assert.equal(createCompanionDesignStore(() => storage).getSnapshot(), 'storybook');
  store.set('storybook');
  assert.equal(updates, 1, 'reselecting the current art must not notify indefinitely');
  values.set(COMPANION_DESIGN_KEY, 'classic');
  store.refresh();
  assert.equal(store.getSnapshot(), 'classic', 'a preference changed in another tab can restore the original');
  assert.equal(updates, 2);
  unsubscribe();
  store.set('storybook');
  assert.equal(updates, 2);
  assert.deepEqual([...values.keys()], [COMPANION_DESIGN_KEY], 'cosmetic style never modifies earned reward storage');
});

test('blocked storage still permits switching art this session and corrupt preferences restore classic', () => {
  const store = createCompanionDesignStore(() => { throw new Error('blocked'); });
  assert.equal(store.getSnapshot(), 'classic');
  assert.doesNotThrow(() => store.set('storybook'));
  assert.equal(store.getSnapshot(), 'storybook');
  assert.doesNotThrow(() => store.set('classic'));
  for (const invalid of [null, undefined, {}, 'unknown', 'SOFT', 'soft']) assert.equal(normalizeCompanionDesign(invalid), 'classic');
});

test('forest storybook choice survives reload and can always switch back to classic', () => {
  const values = new Map();
  const storage = {getItem: key => values.get(key), setItem: (key, value) => values.set(key, value)};
  const store = createCompanionDesignStore(() => storage);
  store.set('storybook');
  const reloaded = createCompanionDesignStore(() => storage);
  assert.equal(reloaded.getSnapshot(), 'storybook');
  reloaded.set('classic');
  store.refresh();
  assert.equal(store.getSnapshot(), 'classic');
});

test('ragdoll redemption survives reload, charges once, and always allows returning to free Mimo', () => {
  const now = new Date(2026, 8, 26);
  const reward = REWARDS.find(item => item.id === 'pet-ragdoll');
  assert.ok(reward && reward.cost > 0);
  const initial = {...createProgress(now), points: reward.cost + 10};
  const purchase = redeemReward(initial, 'pet-ragdoll', now);
  assert.equal(purchase.redeemed, true);
  assert.equal(purchase.state.points, 10);
  const restored = normalizeProgress(JSON.parse(JSON.stringify(purchase.state)), now);
  assert.equal(restored.activePet, 'pet-ragdoll');
  assert.ok(restored.cosmetics.includes('pet-ragdoll'));
  const original = unequipPet(restored, now);
  assert.equal(original.activePet, null);
  assert.equal(redeemReward(original, 'pet-ragdoll', now).state.points, 10);
});

test('new style selection and ragdoll naming have all supported language translations', () => {
  for (const locale of ['zh-TW', 'en', 'ja', 'es', 'de', 'fr', 'ko', 'pt-BR', 'ru', 'it', 'zh-CN', 'th']) {
    const copy = companionDesignCopy(locale);
    for (const [key, value] of Object.entries(copy)) assert.ok(typeof value === 'string' && value.length > 0, `${locale}/${key}`);
    assert.notEqual(copy.storybook, copy.classic);
    if (locale !== 'en') assert.notEqual(copy.ragdoll, companionDesignCopy('en').ragdoll);
  }
});

test('retired soft preference restores classic without affecting rewards', () => {
  const store = createCompanionDesignStore(() => ({getItem: () => 'soft', setItem() {}}));
  assert.equal(store.getSnapshot(), 'classic');
});
