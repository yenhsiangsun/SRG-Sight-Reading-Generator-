"""Prepare the CC0 AliExpress Erhu recordings for the browser sampler.

Requires numpy and miniaudio. Usage:
  python scripts/prepare-erhu-multisample.py .tmp-source-bowed
Downloads only the pinned CC0 source files into the supplied cache. Each output
note has its own recorded anchor; it is not a pitch-shift of another output note.
"""
from pathlib import Path
import concurrent.futures
import hashlib
import json
import math
import sys
import urllib.request
import wave

import numpy as np

CACHE = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('.tmp-source-bowed')
if (CACHE / 'deps').exists():
    sys.path.insert(0, str(CACHE / 'deps'))
import miniaudio

COMMIT = '6615047b2fd06126877483e97b8bb4af9d00b080'
REPO = 'https://github.com/sfzinstruments/aliexpress-erhu'
BASE = f'https://raw.githubusercontent.com/sfzinstruments/aliexpress-erhu/{COMMIT}/'
DEST = Path(__file__).resolve().parents[1] / 'public/samples/erhu-multisample'
RATE = 44100
NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
SOURCE_NAMES = ['c', 'db', 'd', 'eb', 'e', 'f', 'gb', 'g', 'ab', 'a', 'bb', 'b']


def name(midi):
    return f'{NAMES[midi % 12]}{midi // 12 - 1}'


def source_path(midi, rr):
    # The original filenames use a different octave convention. Their acoustic
    # pitch, independently measured below, is one octave below the filename.
    articulation = 'sus' if midi <= 81 else 'st'
    note = f'{SOURCE_NAMES[midi % 12]}{midi // 12}'
    return f'Samples/{articulation}/erhu_{note}_{articulation}_rr{rr}.wav'


def fetch(relative):
    path = CACHE / 'originals' / relative
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        with urllib.request.urlopen(BASE + relative, timeout=60) as response:
            data = response.read()
        path.write_bytes(data)
    return path


def decode(path):
    decoded = miniaudio.decode_file(str(path), output_format=miniaudio.SampleFormat.FLOAT32,
                                   nchannels=2, sample_rate=RATE)
    # These close microphones are often out of phase. Adding L+R cancels the
    # fundamental and changes the tone before normalization can conceal the loss.
    # Keep channels separate and choose one recorded microphone below.
    return np.asarray(decoded.samples, dtype=np.float64).reshape(-1, 2)


def pitch_frames(audio, target):
    values = []
    confidence = []
    for start in np.arange(.3, min(1.8, len(audio) / RATE - .35), .05):
        frame = audio[int(start * RATE):int((start + .12) * RATE)]
        frame = frame - frame.mean()
        ac = np.fft.irfft(abs(np.fft.rfft(frame, 16384)) ** 2)
        lo, hi = int(RATE / (target * 1.065)), int(RATE / (target / 1.065))
        lag = lo + np.argmax(ac[lo:hi + 1])
        if lag <= lo or lag >= hi:
            continue
        curvature = ac[lag - 1] - 2 * ac[lag] + ac[lag + 1]
        offset = .5 * (ac[lag - 1] - ac[lag + 1]) / curvature
        values.append(RATE / (lag + offset))
        confidence.append(ac[lag] / ac[0])
    if len(values) < 8:
        raise ValueError(f'Insufficient stable pitch frames for {target} Hz')
    values = np.asarray(values)
    return float(np.median(values)), float(np.percentile(1200 * np.log2(values / target), 90) -
                                           np.percentile(1200 * np.log2(values / target), 10)), float(np.median(confidence))


def extend(audio):
    # A broad crossfade joins two matched portions of the recorded sustain.
    # This extends note duration; the recorded attack is retained.
    overlap = int(.05 * RATE)
    first, last = int(.45 * RATE), int(.95 * RATE)
    search = audio[first:last + overlap]
    squared = np.concatenate([[0], np.cumsum(search * search)])
    energies = squared[overlap:] - squared[:-overlap]
    fft_size = 1 << (len(search) + overlap - 2).bit_length()
    search_fft = np.fft.rfft(search, fft_size)
    best = None
    for end in range(int(1.5 * RATE), min(int(2.0 * RATE), len(audio) - int(.25 * RATE)), int(.05 * RATE)):
        reference = audio[end - overlap:end]
        products = np.fft.irfft(search_fft * np.fft.rfft(reference[::-1], fft_size), fft_size)
        products = products[overlap - 1:len(search)]
        scores = products / np.maximum(1e-12, np.sqrt(energies * np.sum(reference * reference)))
        index = int(np.argmax(scores))
        start, score = first + index, float(scores[index])
        if best is None or score > best[0]:
            best = (score, start, end)
    start, end = best[1:]
    segment = audio[start:end]
    result = audio[:end].copy()
    ramp = .5 - .5 * np.cos(np.linspace(0, np.pi, overlap))
    while len(result) < RATE * 12:
        result[-overlap:] = result[-overlap:] * (1 - ramp) + segment[:overlap] * ramp
        result = np.concatenate([result, segment[overlap:]])
    result = result[:RATE * 12]
    result[:220] *= np.linspace(0, 1, 220)
    result[-int(.18 * RATE):] *= np.linspace(1, 0, int(.18 * RATE))
    return result, {'startSeconds': start / RATE, 'endSeconds': end / RATE,
                    'crossfadeSeconds': overlap / RATE, 'crossfadeCorrelation': round(best[0], 5)}


def main():
    DEST.mkdir(parents=True, exist_ok=True)
    # Both D6 takes have irregular/noisy sustain, even before processing. Let the
    # sampler transpose the independently recorded C#6 by one semitone instead.
    sources = [source_path(midi, rr) for midi in range(62, 86) for rr in (1, 2)]
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
        list(executor.map(fetch, sources))
    license_path = fetch('LICENSE')
    (DEST / 'LICENSE-CC0.txt').write_bytes(license_path.read_bytes())
    entries, urls = [], {}
    for midi in range(62, 86):
        target = 440 * 2 ** ((midi - 69) / 12)
        candidates = []
        for rr in (1, 2):
            relative = source_path(midi, rr)
            path = fetch(relative)
            stereo = decode(path)
            for channel in range(2):
                audio = stereo[:, channel].copy()
                audio -= np.mean(audio)
                measured, spread, correlation = pitch_frames(audio, target)
                # Reject irregular bow/noise sources instead of amplifying them.
                if correlation < .90:
                    continue
                candidates.append((spread + (1 - correlation) * 100, relative, path, audio,
                                   measured, spread, correlation, channel))
        if not candidates:
            raise ValueError(f'No sufficiently periodic recorded channel for {name(midi)}')
        _, relative, path, audio, measured, spread, correlation, channel = min(candidates, key=lambda item: item[0])
        ratio = target / measured
        tuned = np.interp(np.arange(0, len(audio) - 1, ratio), np.arange(len(audio)), audio)
        output, loop = extend(tuned)
        if loop['crossfadeCorrelation'] < .80:
            raise ValueError(f'{name(midi)} sustain join is not sufficiently matched')
        rms = float(np.sqrt(np.mean(output[int(.3 * RATE):-int(.2 * RATE)] ** 2)))
        gain = min(.14 / max(rms, 1e-8), .85 / max(abs(output)))
        output *= gain
        # New URLs also invalidate already decoded browser sample caches.
        output_name = name(midi).replace('#', 's') + '-single-channel-v2.wav'
        out_path = DEST / output_name
        with wave.open(str(out_path), 'wb') as file:
            file.setparams((1, 2, RATE, 0, 'NONE', 'not compressed'))
            file.writeframes(np.round(output * 32767).astype('<i2').tobytes())
        verified, output_spread, _ = pitch_frames(output, target)
        error_cents = 1200 * math.log2(verified / target)
        if abs(error_cents) > 5:
            raise ValueError(f'{name(midi)} tuning verification failed: {error_cents} cents')
        urls[name(midi)] = output_name
        entries.append({'note': name(midi), 'midi': midi, 'source': BASE + relative,
                        'sourceSha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                        'sourceSeconds': round(len(audio) / RATE, 4),
                        'sourceChannel': 'left' if channel == 0 else 'right',
                        'articulation': 'sustain' if midi <= 81 else 'sul tasto',
                        'sourcePitchHz': round(measured, 5), 'targetHz': round(target, 5),
                        'pitchCorrectionCents': round(1200 * math.log2(ratio), 4),
                        'sourcePitchSpreadCentsP90P10': round(spread, 4),
                        'pitchAutocorrelation': round(correlation, 5),
                        'gainDb': round(20 * math.log10(gain), 3), 'sustainExtension': loop,
                        'output': output_name, 'outputSeconds': 12,
                        'outputSha256': hashlib.sha256(out_path.read_bytes()).hexdigest(),
                        'outputTuningErrorCents': round(error_cents, 4),
                        'outputPeak': round(float(max(abs(output))), 6),
                        'outputRms': round(float(np.sqrt(np.mean(output ** 2))), 6)})
        print(name(midi), relative, 'tuning:', round(error_cents, 2), 'cents', flush=True)
    report = {'instrument': 'Erhu', 'sourceTitle': 'AliExpress Erhu',
              'publisher': 'SFZ Instruments / D. Smolken', 'repository': REPO,
              'commit': COMMIT, 'license': 'CC0-1.0',
              'licenseUrl': REPO + '/blob/' + COMMIT + '/LICENSE',
              'licenseDeed': 'https://creativecommons.org/publicdomain/zero/1.0/',
              'revision': 2, 'recordedRange': 'D4-C#6', 'recordedAnchors': 24,
              'excludedNotes': {'D6': 'All recorded channels have irregular/noisy sustain; nearest C#6 is repitched up one semitone at playback.'},
              'limitations': 'One inexpensive erhu, one dynamic layer. Source describes its player as primarily a violinist. Top four roots use sul-tasto recordings. D6 uses C#6 repitched by one semitone. No sampled legato or articulation switching. Natural bow texture remains.',
              'processing': ['A single original microphone channel is retained; never sum antiphase stereo channels',
                             'One recorded take and channel selected per chromatic pitch; DC removed',
                             'Median pitch-centre correction with retained natural pitch movement',
                             'Recorded sustain crossfaded to 12 seconds; edge fades',
                             'Per-note level balancing; 44.1 kHz PCM16 WAV'],
              'files': entries}
    (DEST / 'provenance.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    (CACHE / 'manifest.json').write_text(json.dumps({'Erhu': {'folder': 'erhu-multisample', 'urls': urls,
                                                            'volume': -6}}, indent=2) + '\n', encoding='utf-8')
    print('Prepared', len(entries), 'recorded anchors:', DEST)


if __name__ == '__main__':
    main()
