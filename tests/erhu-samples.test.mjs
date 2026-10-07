import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadModule} from './helpers.mjs';

const manifest = JSON.parse(fs.readFileSync('src/audio/sampleManifest.json','utf8'));
const {getRecordedSoundProfile, usesRecordedSubstitute} = loadModule('src/audio/playbackProfiles.ts');
const {INSTRUMENTS} = loadModule('src/music/instruments.ts');
const {createPlaybackEvents} = loadModule('src/audio/PlaybackController.ts');
const {createTimbrePreview} = loadModule('src/audio/timbres.ts');
const {samplesForNotes} = loadModule('src/audio/loadRecordedSamples.ts');

test('rejected Erhu banks are inactive and the temporary violin recording is labelled as a substitute', () => {
  assert.equal(manifest.Erhu, undefined);
  assert.equal(getRecordedSoundProfile('Erhu'), 'Violin');
  assert.equal(usesRecordedSubstitute('Erhu'), true);
  assert.equal([INSTRUMENTS.Erhu.min, INSTRUMENTS.Erhu.max, INSTRUMENTS.Erhu.transpose].join(','), '62,86,0');
  const bank = manifest.Violin;
  assert.ok(bank);
  assert.doesNotMatch(JSON.stringify(bank), /erhu|bisa|aliexpress/i);
  for (const [root, file] of Object.entries(samplesForNotes(bank.urls, ['D4','A4','D5','A5','D6']))) {
    assert.ok(fs.statSync(`public/samples/${bank.folder}/${file}`).size > 1000, root);
  }
});

test('substituting an Erhu recording cannot change exercise identity or written and sounding pitches', () => {
  const preview = createTimbrePreview('Erhu');
  assert.equal(preview.soundProfile, 'Erhu');
  assert.equal(preview.transposition, 0);
  const {events} = createPlaybackEvents(preview, 100);
  assert.equal(events[0].note.toUpperCase(), 'D4');
  assert.ok(events.every(event => event.duration > 0));
});
