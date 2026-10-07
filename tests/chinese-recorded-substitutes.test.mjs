import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

const base = 'public/samples/chinese-expansion';
const report = JSON.parse(fs.readFileSync(`${base}/source-report.json`, 'utf8'));
const banks = {
  Harmonica: {
    folder: 'harmonica',
    instrument: 'Hohner Super64 chromatic harmonica',
    roots: [48, 52, 55, 60, 64, 67, 72, 76, 79, 84, 88, 91, 96],
    license: 'CC0-1.0',
    sustained: true,
  },
  'Hammered Dulcimer': {
    folder: 'hammered-dulcimer',
    instrument: 'Hammered dulcimer',
    roots: [62, 64, 66, 67, 69, 72, 74],
    license: 'CC BY 4.0',
    sustained: false,
  },
  Vibraphone: {
    folder: 'vibraphone',
    instrument: 'Vibraphone, hard mallets',
    roots: [57, 60, 67, 74, 81, 88],
    license: 'CC0-1.0',
    sustained: false,
  },
};

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const midi = note => {
  const parts = /^([A-G])(#?)(\d)$/.exec(note);
  assert.ok(parts, `invalid scientific pitch ${note}`);
  return 12 * (Number(parts[3]) + 1)
    + {C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11}[parts[1]]
    + Number(parts[2] === '#');
};

// Read chunks rather than assuming a 44-byte header: ancillary WAV chunks are valid.
function readPcm16(bytes, label) {
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF', label);
  assert.equal(bytes.toString('ascii', 8, 12), 'WAVE', label);
  assert.equal(bytes.readUInt32LE(4) + 8, bytes.length, `${label}: RIFF length`);
  let format;
  let data;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const kind = bytes.toString('ascii', offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    const start = offset + 8;
    assert.ok(start + size <= bytes.length, `${label}: truncated ${kind} chunk`);
    if (kind === 'fmt ') {
      assert.ok(size >= 16, `${label}: PCM format chunk`);
      format = {
        encoding: bytes.readUInt16LE(start),
        channels: bytes.readUInt16LE(start + 2),
        sampleRate: bytes.readUInt32LE(start + 4),
        byteRate: bytes.readUInt32LE(start + 8),
        blockAlign: bytes.readUInt16LE(start + 12),
        bits: bytes.readUInt16LE(start + 14),
      };
    }
    if (kind === 'data') {
      assert.equal(data, undefined, `${label}: duplicate audio data`);
      data = bytes.subarray(start, start + size);
    }
    offset = start + size + (size % 2);
  }
  assert.deepEqual(format, {
    encoding: 1, channels: 1, sampleRate: 44100,
    byteRate: 88200, blockAlign: 2, bits: 16,
  }, `${label}: mono 44.1 kHz PCM16`);
  assert.ok(data?.length > 88200, `${label}: missing or short audio`);
  assert.equal(data.length % 2, 0, `${label}: complete PCM frames`);
  const samples = new Float64Array(data.length / 2);
  for (let i = 0; i < samples.length; i++) samples[i] = data.readInt16LE(i * 2) / 32768;
  return {samples, seconds: samples.length / format.sampleRate};
}

const audio = new Map();
for (const [name, spec] of Object.entries(banks)) {
  assert.ok(report[name], `missing ${name} report`);
  for (const row of report[name].samples) {
    const bytes = fs.readFileSync(`${base}/${spec.folder}/${row.outputFile}`);
    audio.set(row, {bytes, ...readPcm16(bytes, `${name} ${row.note}`)});
  }
}

function rms(samples, startSeconds, endSeconds) {
  const start = Math.floor(startSeconds * 44100);
  const end = Math.min(samples.length, Math.floor(endSeconds * 44100));
  assert.ok(end > start, 'nonempty RMS window');
  let energy = 0;
  for (let i = start; i < end; i++) energy += samples[i] ** 2;
  return Math.sqrt(energy / (end - start));
}

function spectrum(samples, startSeconds) {
  const size = 65536;
  const length = Math.round(.16 * 44100);
  const start = Math.round(startSeconds * 44100);
  assert.ok(start + length <= samples.length, 'complete pitch window');
  const real = new Float64Array(size);
  const imaginary = new Float64Array(size);
  for (let i = 0; i < length; i++) {
    real[i] = samples[start + i] * (.5 - .5 * Math.cos(2 * Math.PI * i / (length - 1)));
  }
  for (let i = 1, j = 0; i < size; i++) {
    let bit = size >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) [real[i], real[j]] = [real[j], real[i]];
  }
  for (let width = 2; width <= size; width *= 2) {
    const angle = -2 * Math.PI / width;
    const stepReal = Math.cos(angle);
    const stepImaginary = Math.sin(angle);
    for (let startBin = 0; startBin < size; startBin += width) {
      let phaseReal = 1;
      let phaseImaginary = 0;
      for (let j = 0; j < width / 2; j++) {
        const first = startBin + j;
        const second = first + width / 2;
        const rotatedReal = real[second] * phaseReal - imaginary[second] * phaseImaginary;
        const rotatedImaginary = real[second] * phaseImaginary + imaginary[second] * phaseReal;
        real[second] = real[first] - rotatedReal;
        imaginary[second] = imaginary[first] - rotatedImaginary;
        real[first] += rotatedReal;
        imaginary[first] += rotatedImaginary;
        const nextPhase = phaseReal * stepReal - phaseImaginary * stepImaginary;
        phaseImaginary = phaseReal * stepImaginary + phaseImaginary * stepReal;
        phaseReal = nextPhase;
      }
    }
  }
  const magnitude = new Float64Array(size / 2 + 1);
  for (let i = 0; i < magnitude.length; i++) magnitude[i] = Math.hypot(real[i], imaginary[i]);
  return magnitude;
}

function measuredCents(samples, note, startSeconds, label) {
  const magnitude = spectrum(samples, startSeconds);
  const expected = 440 * 2 ** ((midi(note) - 69) / 12);
  const frequencyPerBin = 44100 / 65536;
  const lower = Math.ceil(expected / 2 ** (1 / 12) / frequencyPerBin);
  const upper = Math.floor(expected * 2 ** (1 / 12) / frequencyPerBin);
  let peak = lower;
  let strongest = 0;
  for (let bin = 1; bin < magnitude.length; bin++) strongest = Math.max(strongest, magnitude[bin]);
  for (let bin = lower + 1; bin <= upper; bin++) {
    if (magnitude[bin] > magnitude[peak]) peak = bin;
  }
  // Metal bars can have a stronger upper partial. Require a measurable fundamental
  // near the declared root instead of accidentally assigning the overtone's pitch.
  assert.ok(magnitude[peak] / strongest > .03, `${label}: detectable root fundamental`);
  assert.ok(peak > lower && peak < upper, `${label}: fundamental inside search interval`);
  const left = Math.log(Math.max(magnitude[peak - 1], Number.MIN_VALUE));
  const centre = Math.log(Math.max(magnitude[peak], Number.MIN_VALUE));
  const right = Math.log(Math.max(magnitude[peak + 1], Number.MIN_VALUE));
  const interpolation = .5 * (left - right) / (left - 2 * centre + right);
  const frequency = (peak + interpolation) * frequencyPerBin;
  return 1200 * Math.log2(frequency / expected);
}

const median = numbers => {
  const sorted = [...numbers].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

test('recorded substitutes have complete root inventories, matching provenance and physical files', () => {
  assert.deepEqual(Object.keys(report).sort(), Object.keys(banks).sort());
  for (const [name, spec] of Object.entries(banks)) {
    const bank = report[name];
    const folder = `${base}/${spec.folder}`;
    assert.equal(bank.identifier, name);
    assert.equal(bank.kind, 'real-recorded-proxy');
    assert.equal(bank.actualInstrument, spec.instrument);
    assert.match(bank.authenticity, /Recorded substitute only/);
    assert.ok(bank.processing.length && bank.limitations.length, `${name}: processing and limits`);
    assert.deepEqual(bank.samples.map(row => row.midi), spec.roots, `${name}: reviewed roots`);
    assert.deepEqual(JSON.parse(fs.readFileSync(`${folder}/provenance.json`, 'utf8')), bank);
    assert.deepEqual(fs.readdirSync(folder).filter(file => file.endsWith('.wav')).sort(),
      bank.samples.map(row => row.outputFile).sort(), `${name}: no missing or orphaned WAVs`);
    for (const row of bank.samples) {
      assert.equal(midi(row.note), row.midi, `${name}: scientific root ${row.note}`);
      assert.equal(row.kind, spec.folder);
      assert.equal(row.outputFile, `${row.note.replace('#', 's')}-recorded-v1.wav`);
      assert.equal(row.file, path.basename(row.file));
      assert.equal(row.outputChannels, 1);
      assert.match(row.sourceSha256, /^[a-f0-9]{64}$/);
      assert.match(row.outputSha256, /^[a-f0-9]{64}$/);
      assert.equal(sha256(audio.get(row).bytes), row.outputSha256, `${name} ${row.note}: output hash`);
      assert.ok(Math.abs(audio.get(row).seconds - row.outputDurationSeconds) < 1 / 44100);
      assert.ok(Number.isFinite(row.sourceTuningCents));
      assert.equal(row.sourceWindowCents.length, 4);
      assert.ok(row.sourceWindowCents.every(Number.isFinite));
      assert.ok(Number.isFinite(row.correctedMedianCents) && Math.abs(row.correctedMedianCents) < 2);
      assert.ok([0, 1].includes(row.selectedOriginalChannel));
    }
  }
});

test('every source has an embeddable license and primary-source attribution', () => {
  for (const [name, spec] of Object.entries(banks)) {
    for (const row of report[name].samples) {
      assert.equal(row.license, spec.license);
      assert.ok(row.title && row.author);
      if (spec.license === 'CC0-1.0') {
        assert.equal(row.author, 'Versilian Studios LLC');
        assert.match(row.source, /^https:\/\/github\.com\/sgossner\/VCSL\/blob\/[a-f0-9]{40}\//);
        const revision = /\/blob\/([a-f0-9]{40})\//.exec(row.source)[1];
        assert.equal(row.licenseUrl, `https://github.com/sgossner/VCSL/blob/${revision}/LICENSE`);
        assert.equal(row.download, row.source.replace('github.com/sgossner/VCSL/blob/', 'raw.githubusercontent.com/sgossner/VCSL/'));
        assert.match(fs.readFileSync(`${base}/${spec.folder}/LICENSE-CC0.txt`, 'utf8'), /CC0 1\.0 Universal/);
      } else {
        assert.equal(row.author, 'iternetcone');
        assert.equal(row.licenseUrl, 'https://creativecommons.org/licenses/by/4.0/');
        const source = /^https:\/\/freesound\.org\/people\/iternetcone\/sounds\/(\d+)\/$/.exec(row.source);
        assert.ok(source, `${name}: creator source page`);
        assert.equal(row.download, `https://cdn.freesound.org/previews/342/${source[1]}_5132876-hq.mp3`);
        const attribution = fs.readFileSync(`${base}/${spec.folder}/ATTRIBUTION.txt`, 'utf8');
        assert.match(attribution, /iternetcone/);
        assert.match(attribution, /CC BY 4\.0/);
        assert.match(attribution, /Changes:/);
        assert.match(attribution, /MP3 preview decoded/);
      }
    }
  }
});

// The download cache is intentionally untracked. Verify originals whenever it is
// present locally; a clean checkout still verifies retained source hashes/URLs.
test('cached original recordings match all 26 retained raw-source hashes', {
  skip: !fs.existsSync('.tmp-world-recording-search'),
}, () => {
  for (const bank of Object.values(report)) for (const row of bank.samples) {
    const original = `.tmp-world-recording-search/${row.file}`;
    assert.ok(fs.existsSync(original), `missing original ${row.file}`);
    assert.equal(sha256(fs.readFileSync(original)), row.sourceSha256, `${row.note}: raw-source hash`);
  }
});

test('actual PCM levels retain useful attacks, unclipped peaks and instrument-appropriate tails', () => {
  for (const [name, spec] of Object.entries(banks)) for (const row of report[name].samples) {
    const label = `${name} ${row.note}`;
    const {samples, seconds} = audio.get(row);
    let peak = 0;
    for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
    assert.ok(peak > .19 && peak <= .7001, `${label}: balanced peak without clipping`);
    assert.ok(Math.abs(peak - row.outputPeak) <= 2 / 32768, `${label}: reported peak matches PCM`);
    // Resampling a faded endpoint can leave one PCM16 quantization unit.
    assert.ok(Math.abs(samples[0]) <= 1 / 32768, `${label}: faded start`);
    assert.equal(samples.at(-1), 0, `${label}: faded end`);
    const attackRms = rms(samples, .05, .3);
    assert.ok(attackRms > .09 && attackRms <= .131, `${label}: audible, balanced attack RMS ${attackRms}`);
    if (spec.sustained) {
      assert.equal(seconds, 16, `${label}: full recorded sustain`);
      assert.ok(rms(samples, 14, 15) > .05, `${label}: sustained late audio`);
      assert.match(report[name].processing.join(' '), /recorded middle sustain.*crossfades/);
    } else {
      assert.ok(Math.abs(seconds - row.originalDurationSeconds) < .04, `${label}: original natural decay duration`);
      const tailRms = rms(samples, seconds * .8, seconds * .95);
      assert.ok(tailRms / attackRms < .1, `${label}: natural decay rather than repeated sustain`);
      assert.match(report[name].processing.join(' '), /natural decay.*no sustain loop/i);
    }
  }
});

test('independently measured audio fundamentals agree with scientific root pitches', () => {
  for (const [name, spec] of Object.entries(banks)) for (const row of report[name].samples) {
    const label = `${name} ${row.note}`;
    const {samples} = audio.get(row);
    const times = spec.sustained ? [.35, .9, 1.65, 2.1] : [.03, .085, .14, .195];
    const cents = times.map(time => measuredCents(samples, row.note, time, label));
    // Breath pitch naturally moves; the struck roots have a much tighter centre.
    assert.ok(Math.abs(median(cents)) < (spec.sustained ? 4 : 2), `${label}: measured median ${median(cents)} cents`);
    assert.ok(cents.every(value => Number.isFinite(value) && Math.abs(value) < (spec.sustained ? 15 : 3)),
      `${label}: stable physical roots ${cents.join(', ')} cents`);
    if (spec.sustained) for (const time of [14, 14.5]) {
      const lateCents = measuredCents(samples, row.note, time, label);
      assert.ok(Math.abs(lateCents) < 15, `${label}: late sustain ${lateCents} cents`);
    }
  }
});
