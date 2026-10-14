import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

const {createCompanionDesignStore, normalizeCompanionDesign, COMPANION_DESIGN_KEY} = loadModule('src/progress/companionDesign.ts');
const {createProgress, normalizeProgress, redeemReward, unequipPet, REWARDS} = loadModule('src/progress/progress.ts');
const {companionDesignCopy} = loadModule('src/progress/companionDesignCopy.ts');

test('forest-only preference migrates old art choices independently of reward points', () => {
  const values = new Map([[COMPANION_DESIGN_KEY, 'classic']]);
  const storage = {getItem: key => values.get(key), setItem: (key, value) => values.set(key, value)};
  const store = createCompanionDesignStore(() => storage);
  let updates = 0;
  const unsubscribe = store.subscribe(() => updates++);
  assert.equal(store.getSnapshot(), 'storybook', 'public companions use the selected forest artwork');
  assert.equal(values.get(COMPANION_DESIGN_KEY), 'storybook', 'classic preference is migrated on read');
  store.set('storybook');
  assert.equal(updates, 0);
  assert.equal(store.getSnapshot(), 'storybook');
  assert.equal(values.get(COMPANION_DESIGN_KEY), 'storybook');
  assert.equal(createCompanionDesignStore(() => storage).getSnapshot(), 'storybook');
  store.set('storybook');
  assert.equal(updates, 0, 'reselecting the current art must not notify indefinitely');
  values.set(COMPANION_DESIGN_KEY, 'classic');
  store.refresh();
  assert.equal(store.getSnapshot(), 'storybook', 'a stale tab cannot reveal the hidden original art');
  assert.equal(values.get(COMPANION_DESIGN_KEY), 'storybook');
  assert.equal(updates, 0);
  unsubscribe();
  store.set('storybook');
  assert.equal(updates, 0);
  assert.deepEqual([...values.keys()], [COMPANION_DESIGN_KEY], 'cosmetic style never modifies earned reward storage');
});

test('blocked storage and corrupt preferences still display forest art', () => {
  const store = createCompanionDesignStore(() => { throw new Error('blocked'); });
  assert.equal(store.getSnapshot(), 'storybook');
  assert.doesNotThrow(() => store.set('storybook'));
  assert.equal(store.getSnapshot(), 'storybook');
  assert.doesNotThrow(() => store.set('classic'));
  assert.equal(store.getSnapshot(), 'storybook');
  for (const invalid of [null, undefined, {}, 'unknown', 'SOFT', 'soft', 'classic']) assert.equal(normalizeCompanionDesign(invalid), 'storybook');
});

test('forest storybook choice survives reload and hidden classic cannot be selected through preference state', () => {
  const values = new Map();
  const storage = {getItem: key => values.get(key), setItem: (key, value) => values.set(key, value)};
  const store = createCompanionDesignStore(() => storage);
  store.set('storybook');
  const reloaded = createCompanionDesignStore(() => storage);
  assert.equal(reloaded.getSnapshot(), 'storybook');
  reloaded.set('classic');
  store.refresh();
  assert.equal(store.getSnapshot(), 'storybook');
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

test('retired soft preference restores forest art without affecting rewards', () => {
  const store = createCompanionDesignStore(() => ({getItem: () => 'soft', setItem() {}}));
  assert.equal(store.getSnapshot(), 'storybook');
});

test('growth controls and all seven new companions have localized names in every language', () => {
  const {companionGrowthCopy} = loadModule('src/progress/companionGrowthCopy.ts');
  const {companionName} = loadModule('src/progress/companionNames.ts');
  const ids = ['pet-mainecoon','pet-calico','pet-orange','pet-bluecat','pet-husky','pet-shiba','pet-poodle'];
  for (const locale of ['zh-TW', 'en', 'ja', 'es', 'de', 'fr', 'ko', 'pt-BR', 'ru', 'it', 'zh-CN', 'th']) {
    const copy = companionGrowthCopy(locale);
    for (const [key, value] of Object.entries(copy)) {
      assert.ok(value.length > 0, `${locale}/${key}`);
      if (locale !== 'en' && !(locale === 'de' && key === 'baby')) assert.notEqual(value, companionGrowthCopy('en')[key], `${locale}/${key} must not fall back to English`);
    }
    const names = ids.map(id => companionName(id, locale));
    assert.equal(new Set(names).size, ids.length);
    if (locale !== 'en') ids.forEach((id, index) => assert.notEqual(names[index], companionName(id, 'en')));
  }
});
