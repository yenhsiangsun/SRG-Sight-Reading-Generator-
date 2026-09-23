import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {loadModule} from './helpers.mjs';

const {messages, localeOrder, translate} = loadModule('src/i18n/messages.ts');
const {additionalMessages} = loadModule('src/i18n/additionalMessages.ts');
const {additionalDetails} = loadModule('src/i18n/additionalDetails.ts');
const {textCatalog, localizeEnglish} = loadModule('src/i18n/localizeText.ts');
const {namedCatalogs} = loadModule('src/i18n/namedCatalogs.ts');
const {resolveLocale} = loadModule('src/i18n/localePreference.ts');
const {words} = loadModule('src/progress/words.ts');
const {instrumentTranslations} = loadModule('src/i18n/instrumentTranslations.ts');
const {instrumentLabel, scaleLabel} = loadModule('src/i18n/musicLabels.ts');
const {INSTRUMENT_LIST, INSTRUMENTS} = loadModule('src/music/instruments.ts');
const {SCALES} = loadModule('src/music/scales.ts');
const {REWARDS} = loadModule('src/progress/progress.ts');

test('every selectable language has explicit translations for every settings, playback and assessment message', () => {
  for (const [key, values] of Object.entries(messages)) {
    for (let index = 0; index < localeOrder.length; index++) {
      const explicit = namedCatalogs[localeOrder[index]]?.messages[key] ?? values[index] ?? additionalMessages[key]?.[index - 3] ?? additionalDetails[key]?.[index - 3];
      assert.ok(typeof explicit === 'string' && explicit.trim(), `${localeOrder[index]}: missing ${key}`);
      assert.equal(translate(localeOrder[index], key), explicit);
    }
  }
  for (const table of [additionalMessages, additionalDetails, textCatalog]) {
    for (const [key, row] of Object.entries(table)) {
      assert.equal(row.length, 7, key);
      assert.ok(row.every(value => typeof value === 'string' && value.trim()), key);
    }
  }
});

function files(dir) {
  return fs.readdirSync(dir, {withFileTypes:true}).flatMap(entry =>
    entry.isDirectory() ? files(`${dir}/${entry.name}`) : /\.tsx?$/.test(entry.name) ? [`${dir}/${entry.name}`] : []);
}

test('inline home and shop copy cannot silently omit any additional language', () => {
  for (const path of files('src')) {
    const source = ts.createSourceFile(path, fs.readFileSync(path,'utf8'), ts.ScriptTarget.Latest, true);
    function visit(node) {
      if (ts.isCallExpression(node) && ['w','words'].includes(node.expression.getText(source))) {
        const offset = node.expression.getText(source) === 'words' ? 1 : 0;
        const en = node.arguments[offset + 1];
        if (en && ts.isStringLiteral(en)) {
          assert.ok(textCatalog[en.text], `${path}: untranslated "${en.text}"`);
          for (let index = 3; index < localeOrder.length; index++) {
            const locale = localeOrder[index];
            const explicit = namedCatalogs[locale]?.text[en.text] ?? textCatalog[en.text][index - 3];
            assert.ok(explicit, `${locale}: ${en.text}`);
            assert.equal(words(locale,'中文',en.text,'日本語'), explicit);
          }
        }
        assert.ok(!en || !ts.isTemplateExpression(en), 'Translate a stable template before substituting values.');
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
});

test('instrument and companion names remain localized when the language changes', () => {
  for (const instrument of INSTRUMENT_LIST) {
    assert.equal(instrumentTranslations[instrument.name]?.length, 8, instrument.name);
    for (let index = 2; index < localeOrder.length; index++)
      assert.equal(instrumentLabel(instrument.name, localeOrder[index]), namedCatalogs[localeOrder[index]]?.instruments[instrument.name] ?? instrumentTranslations[instrument.name][index - 2]);
  }
  for (const pet of REWARDS) {
    const name = pet.name.en.replace(/^(?:Pet|Metronome pet): /, '');
    assert.ok(textCatalog[name], name);
    assert.ok(textCatalog[pet.description.en], pet.description.en);
    for (let index = 3; index < localeOrder.length; index++) {
      const catalog = namedCatalogs[localeOrder[index]]?.text;
      assert.equal(localizeEnglish(localeOrder[index], pet.name.en), `${catalog?.Companion ?? textCatalog.Companion[index - 3]} · ${catalog?.[name] ?? textCatalog[name][index - 3]}`);
    }
  }
  assert.notEqual(words('fr','我的練習室','My studio','練習室'), 'My studio');
  assert.equal(words('ja','我的練習室','My studio','練習室'), '練習室');
  assert.equal(words('zh-TW','我的練習室','My studio','練習室'), '我的練習室');
});

test('Thai and Simplified Chinese have complete native-script catalogs without English fallback', () => {
  for (const [locale, script] of [['th', /[\u0e00-\u0e7f]/], ['zh-CN', /[\u3400-\u9fff]/]]) {
    const catalog = namedCatalogs[locale];
    assert.ok(localeOrder.includes(locale));
    assert.deepEqual(Object.keys(catalog.messages).sort(), Object.keys(messages).sort());
    assert.deepEqual(Object.keys(catalog.text).sort(), Object.keys(textCatalog).sort());
    assert.deepEqual(Object.keys(catalog.instruments).sort(), Object.keys(INSTRUMENTS).sort());
    assert.deepEqual(Object.keys(catalog.scales).sort(), Array.from(SCALES, s => s.id).sort());
    for (const [key, value] of Object.entries(catalog.messages)) {
      assert.match(value, script, `${locale}: ${key}`);
      assert.equal(translate(locale, key), value);
    }
    for (const [english, value] of Object.entries(catalog.text)) {
      assert.match(value, script, `${locale}: ${english}`);
      assert.deepEqual(value.match(/\{\w+\}/g) ?? [], english.match(/\{\w+\}/g) ?? [], `${locale}: template ${english}`);
      assert.equal(localizeEnglish(locale, english), value);
    }
    for (const id of Object.keys(INSTRUMENTS)) {
      assert.match(instrumentLabel(id, locale), script, `${locale}: instrument ${id}`);
    }
    for (const scale of SCALES) assert.equal(scaleLabel(scale.id, scale.label, locale), catalog.scales[scale.id]);
  }
  assert.equal(translate('th', 'language'), 'ภาษา');
  assert.equal(translate('zh-CN', 'practice'), '自由练习');
  assert.equal(words('zh-CN', '我的練習室', 'My studio', '練習室'), '我的练习室');
  assert.match(translate('zh-CN', 'tempoHelp'), /♩ = 60.*♪ = 120/);
  assert.match(localizeEnglish('zh-CN', 'Tap the staff or drag vertically to choose the lowest and highest notes. Use ♭/♯ for semitones and ±8 for octaves.'), /♭／♯.*±8/);
  assert.doesNotMatch(JSON.stringify(namedCatalogs['zh-CN']), /[後麽牠]/);
});

test('browser language detection distinguishes Chinese scripts, supports Thai and respects manual choices', () => {
  for (const browser of ['zh-CN', 'zh-SG', 'zh-Hans', 'zh-Hans-TW', 'zh_cn']) assert.equal(resolveLocale(null, [browser]), 'zh-CN');
  for (const browser of ['zh-TW', 'zh-HK', 'zh-MO', 'zh-Hant', 'zh-Hant-CN', 'zh']) assert.equal(resolveLocale(null, [browser]), 'zh-TW');
  for (const browser of ['th', 'th-TH', 'TH-th']) assert.equal(resolveLocale(null, [browser]), 'th');
  for (const locale of localeOrder) assert.equal(resolveLocale(locale, ['th-TH', 'zh-CN']), locale);
  assert.equal(resolveLocale('unsupported', ['unknown', 'th-TH', 'en-US']), 'th');
  assert.equal(resolveLocale(null, ['en-US', 'th-TH']), 'en');
  assert.equal(resolveLocale(null, ['pt-PT']), 'pt-BR');
  assert.equal(resolveLocale(null, ['unknown']), 'en');
  assert.equal(resolveLocale(null, []), 'en');
});
