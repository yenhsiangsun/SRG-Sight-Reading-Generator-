import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadModule} from './helpers.mjs';

const {INSTRUMENTS} = loadModule('src/music/instruments.ts');
const {getRecordedSoundProfile, usesRecordedSubstitute} = loadModule('src/audio/playbackProfiles.ts');
const manifest = JSON.parse(fs.readFileSync('src/audio/sampleManifest.json', 'utf8'));
const {audioSourceLabel, recordedSubstituteLabel} = loadModule('src/i18n/audioLabels.ts');
const {localeOrder} = loadModule('src/i18n/messages.ts');
const {instrumentLabel} = loadModule('src/i18n/musicLabels.ts');

test('every instrument now has a recorded source without changing score properties', () => {
  for (const [name, profile] of Object.entries(INSTRUMENTS)) {
    const source = getRecordedSoundProfile(name);
    assert.ok(manifest[source]?.urls, `${name}: missing ${source}`);
    assert.ok(Number.isFinite(profile.transpose), name);
    for (const file of Object.values(manifest[source].urls)) {
      assert.ok(fs.statSync(`public/samples/${manifest[source].folder}/${file}`).size > 1000, `${name}: ${file}`);
    }
    if (!profile.family.startsWith('國樂')) assert.equal(source, name, name);
  }
});

test('substitute captions describe the actual recorded instrument in all twelve languages', () => {
  for (const locale of localeOrder) {
    for (const source of ['Harmonica', 'Hammered Dulcimer', 'Vibraphone']) {
      assert.ok(audioSourceLabel(source, locale).trim(), `${locale}: ${source}`);
    }
    assert.equal(audioSourceLabel(getRecordedSoundProfile('Erhu'), locale), instrumentLabel('Violin', locale));
    assert.ok(recordedSubstituteLabel(locale).trim(), locale);
  }
  assert.match(audioSourceLabel('Hammered Dulcimer', 'zh-CN'), /扬琴/);
  assert.match(audioSourceLabel('Harmonica', 'th'), /[ก-๙]/);
  assert.equal(audioSourceLabel('unknown recording', 'zh-TW'), 'unknown recording');
});

test('reed, bowed and plucked substitutes are explicit while dizi variants share a genuine dizi bank', () => {
  for (const [name, source] of [
    ['Erhu','Violin'], ['Gaohu','Violin'], ['Zhonghu','Viola'],
    ['Sheng','Harmonica'], ['Alto Sheng','Harmonica'], ['Tenor Sheng','Harmonica'], ['Bass Sheng','Harmonica'],
    ['Soprano Suona','Oboe'], ['Bass Suona','Bassoon'], ['Alto Guan','Clarinet'],
    ['Zhongruan','Guitar'], ['Pipa','Guitar'], ['Yangqin','Hammered Dulcimer'],
  ]) {
    assert.equal(getRecordedSoundProfile(name), source, name);
    assert.equal(usesRecordedSubstitute(name), true, name);
  }
  for (const name of ['Bangdi G','Qudi C','Qudi D']) {
    assert.equal(getRecordedSoundProfile(name), 'Qudi C');
    assert.equal(usesRecordedSubstitute(name), false);
  }
});
