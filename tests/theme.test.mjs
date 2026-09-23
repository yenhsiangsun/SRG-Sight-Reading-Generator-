import test from 'node:test';
import assert from 'node:assert/strict';
import { loadModule } from './helpers.mjs';

const modulePath = 'src/theme/theme.ts';
const theme = loadModule(modulePath);
const plain = value => JSON.parse(JSON.stringify(value));

// Independent WCAG sRGB calculation: these assertions measure the resulting
// foreground/background pairs instead of duplicating the color-selection code.
function contrast(a, b) {
  function luminance(hex) {
    const channels = hex.match(/[0-9a-f]{2}/gi).map(value => parseInt(value, 16) / 255)
      .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return channels.reduce((total, channel, index) => total + channel * [0.2126, 0.7152, 0.0722][index], 0);
  }
  const values = [luminance(a), luminance(b)].sort((x, y) => x - y);
  return (values[1] + 0.05) / (values[0] + 0.05);
}

function checkContrast(colors) {
  const css = theme.themeStyleFromState(colors);
  for (const ink of ['--theme-text', '--theme-muted', '--theme-primary-ink']) {
    for (const surface of ['--theme-surface', '--theme-soft', '--theme-accent-soft']) {
      assert.ok(contrast(css[ink], css[surface]) >= 4.5, `${ink} ${css[ink]} on ${surface} ${css[surface]}`);
    }
  }
  for (const [ink, surface] of [
    ['--theme-page-text', '--theme-background'], ['--theme-page-muted', '--theme-background'],
    ['--theme-primary-text', '--theme-primary'], ['--theme-accent-text', '--theme-accent'],
  ]) assert.ok(contrast(css[ink], css[surface]) >= 4.5, `${ink} on ${surface}`);
}

test('theme normalizes short hex and ignores stored foreground colors and unknown properties', () => {
  assert.deepEqual(plain(theme.normalizeTheme({ primary: '#AbC', accent: '#FF00Cc', text: '#ffffff', surprise: 'value' })), {
    ...plain(theme.defaultTheme), primary: '#aabbcc', accent: '#ff00cc',
  });
  for (const malformed of [null, 42, [], 'blue', { primary: 'red', background: 'url(https://example.com)', surface: '#ffff' }]) {
    assert.deepEqual(plain(theme.normalizeTheme(malformed)), plain(theme.defaultTheme));
  }
});

test('all preset and extreme color combinations retain readable controls, labels and panels', () => {
  for (const preset of theme.themePresets) checkContrast(preset.colors);
  for (const surface of ['#000000', '#ffffff', '#757575', '#767676', '#777777', '#ff00ff', '#00ff00', '#0000ff']) {
    for (const primary of ['#ffffff', '#000000', '#ffff00', '#0000ff', '#ff0000']) {
      for (const background of ['#000000', '#ffffff', '#777777']) {
        checkContrast({ primary, accent: '#00ffff', surface, background });
      }
    }
  }
});

test('saved themes survive reload, and reset overwrites an earlier selection', () => {
  const stored = new Map();
  const saved = loadModule(modulePath, 1, undefined, {}, { localStorage: {
    getItem: key => stored.get(key) ?? null,
    setItem: (key, value) => stored.set(key, value),
  } });
  const selected = saved.themePresets.find(preset => preset.id === 'midnight').colors;
  assert.equal(saved.writeThemePreference(selected), true);
  assert.deepEqual(plain(saved.readThemePreference()), { theme: plain(selected), storageWarning: false });
  assert.equal(saved.writeThemePreference(saved.defaultTheme), true);
  assert.deepEqual(plain(saved.readThemePreference().theme), plain(saved.defaultTheme));
  stored.set(saved.THEME_STORAGE_KEY, '{broken json');
  assert.deepEqual(plain(saved.readThemePreference()), { theme: plain(saved.defaultTheme), storageWarning: false });
});

test('unavailable or full storage does not prevent theme customization', () => {
  const blocked = loadModule(modulePath, 1, undefined, {}, { localStorage: {
    getItem() { throw new Error('Storage blocked'); },
    setItem() { throw new Error('Storage quota exceeded'); },
  } });
  assert.equal(blocked.readThemePreference().storageWarning, true);
  assert.equal(blocked.writeThemePreference(blocked.defaultTheme), false);
  assert.deepEqual(plain(blocked.readThemePreference().theme), plain(blocked.defaultTheme));
  checkContrast({ ...theme.defaultTheme, primary: '#ffffff' });
});
