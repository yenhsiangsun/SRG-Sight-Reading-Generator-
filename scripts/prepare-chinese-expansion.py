"""Prepare recorded proxies from reviewed, freely redistributable originals.

Reads .tmp-world-recording-search/sources.json and downloaded source files.
Requires numpy and the existing western-tools.local/miniaudio decoder.
These banks are explicitly harmonica, hammered dulcimer and vibraphone, not
recordings of Sheng, Yangqin or Yunluo. Writes only public/samples/chinese-expansion/ and a candidate
manifest in the temporary research directory; it does not change app routing.
"""
import hashlib
import json
import math
import re
import sys
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'western-tools.local'))
import miniaudio

RATE = 44100
SOURCE = ROOT / '.tmp-world-recording-search'
DEST = ROOT / 'public/samples/chinese-expansion'
NAMES = ['C', 'Cs', 'D', 'Ds', 'E', 'F', 'Fs', 'G', 'Gs', 'A', 'As', 'B']
# Scientific pitches independently checked against the source spectra. F.wav
# and low C.wav have strong unrelated resonance, and C#.wav has ambiguous
# octave labeling. Do not include those files merely to increase root count.
DULCIMER_ROOTS = {342918: 62, 342917: 64, 342915: 66, 342920: 67,
                  342914: 69, 342919: 72, 342921: 74}


def note_name(midi):
    return NAMES[midi % 12] + str(midi // 12 - 1)


def measure(x, midi, sustained):
    expected = 440 * 2 ** ((midi - 69) / 12)
    readings = []
    starts = [0.4, 0.8, 1.5, 2.3] if sustained else [0.025, 0.075, 0.125, 0.175]
    for start in starts:
        clip = x[int(start * RATE):int((start + 0.16) * RATE)]
        assert len(clip) > RATE * 0.1
        nfft = 131072
        spectrum = abs(np.fft.rfft(clip * np.hanning(len(clip)), nfft))
        frequencies = np.fft.rfftfreq(nfft, 1 / RATE)
        region = np.where((frequencies > expected * 0.965) & (frequencies < expected * 1.035))[0]
        peak = region[np.argmax(spectrum[region])]
        values = np.log(spectrum[peak - 1:peak + 2] + 1e-15)
        offset = 0.5 * (values[0] - values[2]) / (values[0] - 2 * values[1] + values[2])
        hz = (peak + offset) * RATE / nfft
        readings.append(1200 * math.log2(hz / expected))
    return float(np.median(readings)), [float(v) for v in readings]


def resample(x, output_length):
    original_length = len(x)
    spectrum = np.fft.rfft(x, axis=0)
    result = np.zeros((output_length // 2 + 1, x.shape[1]), dtype=complex)
    common_length = min(original_length, output_length)
    result[:common_length // 2 + 1] = spectrum[:common_length // 2 + 1]
    if common_length % 2 == 0:
        if output_length < original_length:
            result[common_length // 2] *= 2
        elif original_length < output_length:
            result[common_length // 2] *= 0.5
    return np.fft.irfft(result, n=output_length, axis=0) * output_length / original_length


def extend_recorded_sustain(x):
    """Repeat recorded middle sustain with linear crossfades, no oscillator."""
    start, end = int(0.8 * RATE), int(2.7 * RATE)
    overlap = int(0.2 * RATE)
    segment = x[start:end]
    out = x[:end].copy()
    crossfade = np.linspace(0, 1, overlap)[:, None]
    while len(out) < 16 * RATE:
        joined = out[-overlap:] * (1 - crossfade) + segment[:overlap] * crossfade
        out = np.concatenate((out[:-overlap], joined, segment[overlap:]))
    return out[:16 * RATE]


def write_wav(path, x):
    assert np.isfinite(x).all() and np.max(abs(x)) < 0.99
    with wave.open(str(path), 'wb') as output:
        output.setparams((x.shape[1], 2, RATE, 0, 'NONE', 'not compressed'))
        output.writeframes((x * 32767).astype('<i2').tobytes())


def main():
    sources = json.loads((SOURCE / 'sources.json').read_text(encoding='utf8'))
    manifests = {}
    reports = {}
    for kind, identifier, folder in [('harmonica', 'Harmonica', 'harmonica'),
                                     ('hammered-dulcimer', 'Hammered Dulcimer', 'hammered-dulcimer'),
                                     ('vibraphone', 'Vibraphone', 'vibraphone')]:
        destination = DEST / folder
        destination.mkdir(parents=True, exist_ok=True)
        rows = []
        urls = {}
        for source in sources:
            if source['kind'] != kind:
                continue
            if kind == 'hammered-dulcimer':
                sound_id = int(re.search(r'/sounds/(\d+)/', source['source'])[1])
                if sound_id not in DULCIMER_ROOTS:
                    continue
                assert source['license'] == 'CC BY 4.0'
                midi = DULCIMER_ROOTS[sound_id]
            elif kind == 'harmonica':
                assert source['license'] == 'CC0-1.0'
                original_note = re.search(r'_([CEG])(\d)\.wav$', source['title'])
                midi = {'C': 0, 'E': 4, 'G': 7}[original_note[1]] + (int(original_note[2]) + 2) * 12
            else:
                assert source['license'] == 'CC0-1.0'
                original_note = re.search(r'_([ACDEG])(\d)_v2_', source['title'])
                midi = {'A': 9, 'C': 0, 'D': 2, 'E': 4, 'G': 7}[original_note[1]] + (int(original_note[2]) + 2) * 12
            audio = miniaudio.decode_file(str(SOURCE / source['file']),
                output_format=miniaudio.SampleFormat.FLOAT32, nchannels=2, sample_rate=RATE)
            x = np.array(audio.samples).reshape(-1, 2).astype(np.float64)
            original_seconds = len(x) / RATE
            # Use the stronger original microphone channel. Do not sum stereo
            # channels: phase cancellation can damage recorded instruments.
            selected_channel = int(np.argmax(np.mean(x ** 2, axis=0)))
            x = x[:, selected_channel:selected_channel + 1]
            onset = int(np.argmax(np.max(abs(x), axis=1) > np.max(abs(x)) * 0.04))
            x = x[max(0, onset - int(0.002 * RATE)):]
            x[:int(0.002 * RATE)] *= np.linspace(0, 1, int(0.002 * RATE))[:, None]
            x[-int(0.02 * RATE):] *= np.linspace(1, 0, int(0.02 * RATE))[:, None]
            channel = int(np.argmax(np.mean(x[:RATE] ** 2, axis=0)))
            tuning, readings = measure(x[:, channel], midi, kind == 'harmonica')
            assert abs(tuning) < 40, (source['file'], tuning)
            x = resample(x, round(len(x) * 2 ** (tuning / 1200)))
            after, _ = measure(x[:, channel], midi, kind == 'harmonica')
            assert abs(after) < 2.0, (source['file'], after)
            if kind == 'harmonica':
                x = extend_recorded_sustain(x)
            x[-int(0.06 * RATE):] *= np.linspace(1, 0, int(0.06 * RATE))[:, None]
            # Balance the initial note without raising room/background noise to
            # match another instrument; leave conservative peak headroom.
            window = x[int(0.05 * RATE):int(0.3 * RATE)]
            rms = float(np.sqrt(np.mean(window ** 2)))
            gain = min(0.13 / max(rms, 1e-9), 0.7 / float(np.max(abs(x))))
            x *= gain
            name = note_name(midi)
            filename = name + '-recorded-v1.wav'
            path = destination / filename
            write_wav(path, x)
            urls[name.replace('s', '#')] = filename
            rows.append(dict(source, note=name.replace('s', '#'), midi=midi,
                originalDurationSeconds=original_seconds, trimmedOnsetSeconds=onset / RATE,
                selectedOriginalChannel=selected_channel,
                sourceTuningCents=tuning, sourceWindowCents=readings,
                correctedMedianCents=after, outputFile=filename,
                outputDurationSeconds=len(x) / RATE, outputChannels=x.shape[1],
                outputPeak=float(np.max(abs(x))), outputSha256=hashlib.sha256(path.read_bytes()).hexdigest()))
            print(identifier, name, round(tuning, 2), '->', round(after, 2), flush=True)
        rows.sort(key=lambda row: row['midi'])
        manifests[identifier] = dict(folder='chinese-expansion/' + folder, urls=urls,
                                     volume=-10 if kind == 'harmonica' else -7)
        report = dict(identifier=identifier, kind='real-recorded-proxy',
            actualInstrument={'harmonica': 'Hohner Super64 chromatic harmonica',
                'hammered-dulcimer': 'Hammered dulcimer', 'vibraphone': 'Vibraphone, hard mallets'}[kind],
            suggestedFor={'harmonica': ['Alto Sheng', 'Tenor Sheng', 'Bass Sheng'],
                'hammered-dulcimer': ['Yangqin'], 'vibraphone': ['Yunluo']}[kind],
            authenticity='Recorded substitute only; not an original Chinese instrument recording.',
            processing=['Decode original WAV or public HQ MP3 preview to 44.1 kHz PCM',
                'Trim leading silence, add short endpoint fades, balance level and correct pitch centre'] +
                (['Repeat recorded middle sustain with 200 ms crossfades to 16 seconds; no synthesized waveform'] if kind == 'harmonica' else ['Preserve recorded natural decay; no sustain loop']),
            limitations=(['Source octave labels are one below scientific pitch notation.',
                'Lowest actual recorded pitch is C3; Bass Sheng C2 is obtained by downward repitching.',
                'Repeated recorded sustain and timbral suitability still need human listening acceptance.'] if kind == 'harmonica' else
                ['Public HQ MP3 previews are lossy; original WAV downloads require Freesound login.',
                'Single velocity, short recorded decays and natural sympathetic string resonance.',
                'Actual roots D4-D5; notes outside that span require repitching.'] if kind == 'hammered-dulcimer' else
                ['Source octave labels are one below scientific pitch notation.',
                'Actual roots A3-E6; Yunluo G3-G6 needs up to two semitones of outer repitching.',
                'A metal-bar vibraphone substitute has a different attack and resonance from a small gong.']),
            samples=rows)
        (destination / 'provenance.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf8')
        reports[identifier] = report
    (DEST / 'source-report.json').write_text(json.dumps(reports, indent=2) + '\n', encoding='utf8')
    (DEST / 'harmonica/LICENSE-CC0.txt').write_bytes((SOURCE / 'VCSL-LICENSE').read_bytes())
    (DEST / 'vibraphone/LICENSE-CC0.txt').write_bytes((SOURCE / 'VCSL-LICENSE').read_bytes())
    (DEST / 'hammered-dulcimer/ATTRIBUTION.txt').write_text(
        'Multi-sampled Hammered Dulcimer by iternetcone (2016), Freesound pack 19445.\n'
        'https://freesound.org/people/iternetcone/packs/19445/\n'
        'CC BY 4.0: https://creativecommons.org/licenses/by/4.0/\n'
        'Changes: MP3 preview decoded, leading silence trimmed, endpoint fades, pitch centre corrected, level balanced.\n'
        'Individual source pages and hashes are listed in provenance.json.\n', encoding='utf8')
    (SOURCE / 'manifest.json').write_text(json.dumps(manifests, indent=2) + '\n', encoding='utf8')


if __name__ == '__main__':
    main()
