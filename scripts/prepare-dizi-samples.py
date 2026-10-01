"""Prepare the CC0 Hypnotriod C-dizi anchors after authorized source download.

Reads .tmp-source-winds/dizi-sources.json and its downloaded public HQ MP3
previews. Requires numpy and the existing western-tools.local/miniaudio decoder.
Writes only public/samples/dizi-recorded and .tmp-source-winds/manifest.json.
The source octave labels are one octave above scientific notation; the numeric
MIDI field is independently checked against the waveform before use.
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
SOURCE = ROOT / '.tmp-source-winds'
DEST = ROOT / 'public/samples/dizi-recorded'
# The source pack also supplies ten pre-pitched semitones. Keep its fifteen
# diatonic anchors; the sampler selects the nearest anchor for other pitches.
ANCHORS = {67, 69, 71, 72, 74, 76, 78, 79, 81, 83, 84, 86, 88, 90, 91}
NAMES = ['C', 'Cs', 'D', 'Ds', 'E', 'F', 'Fs', 'G', 'Gs', 'A', 'As', 'B']


def pitch_cents(x, midi):
    expected = 440 * 2 ** ((midi - 69) / 12)
    readings = []
    for start in (0.5, 1.0, 2.0, 3.0):
        segment = x[int(start * RATE):int((start + 0.2) * RATE)]
        assert len(segment) >= 4410
        nfft = 65536
        spectrum = abs(np.fft.rfft(segment * np.hanning(len(segment)), nfft))
        frequencies = np.fft.rfftfreq(nfft, 1 / RATE)
        region = np.where((frequencies > expected * 0.9) & (frequencies < expected * 1.1))[0]
        peak = region[np.argmax(spectrum[region])]
        v = np.log(spectrum[peak - 1:peak + 2] + 1e-15)
        offset = 0.5 * (v[0] - v[2]) / (v[0] - 2 * v[1] + v[2])
        hz = (peak + offset) * RATE / nfft
        readings.append(1200 * math.log2(hz / expected))
    return float(np.median(readings)), [float(v) for v in readings]


def resample_bandlimited(x, output_length):
    """Fourier resampling; zero-ended source avoids the periodic-edge seam."""
    original_length = len(x)
    spectrum = np.fft.rfft(x)
    result = np.zeros(output_length // 2 + 1, dtype=complex)
    common_length = min(original_length, output_length)
    result[:common_length // 2 + 1] = spectrum[:common_length // 2 + 1]
    if common_length % 2 == 0:
        if output_length < original_length:
            result[common_length // 2] *= 2
        elif original_length < output_length:
            result[common_length // 2] *= 0.5
    return np.fft.irfft(result, n=output_length) * (output_length / original_length)


def main():
    sources = json.loads((SOURCE / 'dizi-sources.json').read_text(encoding='utf-8'))
    DEST.mkdir(exist_ok=True, parents=True)
    rows = []
    urls = {}
    for source in sources:
        midi = int(re.search(r'C_(\d+)_', source['title'])[1])
        if midi not in ANCHORS:
            continue
        assert source['license'].rstrip('/') in (
            'http://creativecommons.org/publicdomain/zero/1.0',
            'https://creativecommons.org/publicdomain/zero/1.0',
        )
        path = ROOT / source['path']
        assert hashlib.sha256(path.read_bytes()).hexdigest() == source['sha256']
        decoded = miniaudio.decode_file(str(path), output_format=miniaudio.SampleFormat.FLOAT32,
                                       nchannels=1, sample_rate=RATE)
        x = np.array(decoded.samples, dtype=float)
        assert np.isfinite(x).all() and len(x) > 6 * RATE
        cents, readings = pitch_cents(x, midi)
        assert abs(cents) < 30 and max(readings) - min(readings) < 30
        # Short edge fades retain the recorded attack and sustained breath.
        x[:round(RATE * 0.005)] *= np.linspace(0, 1, round(RATE * 0.005))
        x[-round(RATE * 0.03):] *= np.linspace(1, 0, round(RATE * 0.03))
        ratio = 2 ** (-cents / 1200)
        x = resample_bandlimited(x, round(len(x) / ratio))
        level = float(np.sqrt(np.mean(x[:RATE] ** 2)))
        gain = min(0.25 / level, 0.9 / float(np.max(abs(x))))
        x *= gain
        filename = f'{NAMES[midi % 12]}{midi // 12 - 1}.wav'
        note = f'{NAMES[midi % 12].replace("s", "#")}{midi // 12 - 1}'
        output = DEST / filename
        pcm = np.round(np.clip(x, -1, 1) * 32767).astype('<i2')
        with wave.open(str(output), 'wb') as target:
            target.setparams((1, 2, RATE, 0, 'NONE', 'not compressed'))
            target.writeframes(pcm.tobytes())
        # Verify the final quantized waveform, not only source measurements.
        final_cents, final_readings = pitch_cents(pcm.astype(float) / 32767, midi)
        assert abs(final_cents) < 1.5 and np.max(abs(pcm.astype(int))) < 32767
        urls[note] = filename
        rows.append({
            'midi': midi, 'note': note, 'file': filename,
            'freesoundId': source['id'], 'sourceTitle': source['title'],
            'sourcePage': source['sourcePage'], 'download': source['download'],
            'sourceSha256': source['sha256'],
            'sha256': hashlib.sha256(output.read_bytes()).hexdigest(),
            'seconds': round(len(pcm) / RATE, 4), 'peak': round(float(np.max(abs(x))), 5),
            'initialSecondRms': round(float(np.sqrt(np.mean(x[:RATE] ** 2))), 5),
            'sourcePitchCents': round(cents, 3),
            'pitchCorrectionCents': round(-cents, 3),
            'finalPitchCents': round(final_cents, 3),
            'finalPitchWindowCents': [round(v, 3) for v in final_readings],
            'gainDb': round(20 * math.log10(gain), 3),
        })
    rows.sort(key=lambda row: row['midi'])
    assert len(rows) == 15
    urls = {row['note']: row['file'] for row in rows}
    provenance = {
        'instrument': 'C dizi (bamboo flute with membrane)',
        'author': 'Hypnotriod', 'license': 'CC0-1.0',
        'licenseUrl': 'https://creativecommons.org/publicdomain/zero/1.0/',
        'pack': 'https://freesound.org/people/Hypnotriod/packs/21613/',
        'sourceFormat': 'Public HQ MP3 previews of the uploader\'s isolated WAV notes; not the original WAV downloads',
        'recordedRange': 'G4-G6 (MIDI 67-91)',
        'coverage': '15 diatonic anchors. Unrecorded pitches use nearest-anchor playback repitching.',
        'limitations': [
            'This is one C-dizi bank, not independent Bangdi/Qudi recordings for each instrument or key.',
            'The membrane tone is unsuitable to present as an authentic membrane-free Xindi recording.',
            'Highest Bangdi registers exceed the G6 source range and require substantial repitching.',
            'Samples end naturally after approximately 7-10 seconds; no looped sustain is introduced.',
        ],
        'changes': [
            'Omit ten creator-pitched chromatic semitones, retaining fifteen diatonic anchors.',
            'Use the waveform-verified numeric MIDI pitches; source note names are one octave higher than scientific notation.',
            'Decode to mono 44100 Hz PCM16; apply 5 ms onset and 30 ms final fades.',
            'Correct measured pitch center with bandlimited resampling; preserve natural pitch variation.',
            'Balance initial-second RMS with peak headroom; playback volume is -12 dB.',
        ],
        'samples': rows,
    }
    (DEST / 'provenance.json').write_text(json.dumps(provenance, indent=2) + '\n', encoding='utf-8')
    bank = {'folder': 'dizi-recorded', 'urls': urls, 'volume': -12}
    candidates = {name: bank for name in ('Bangdi G', 'Bangdi F', 'Bangdi A', 'Bangdi C',
                                        'Qudi C', 'Qudi Bb', 'Qudi D', 'Qudi E')}
    (SOURCE / 'manifest.json').write_text(json.dumps(candidates, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'anchors': len(rows), 'bytes': sum((DEST / r['file']).stat().st_size for r in rows),
                      'maxAbsFinalCents': max(abs(r['finalPitchCents']) for r in rows),
                      'secondsRange': [min(r['seconds'] for r in rows), max(r['seconds'] for r in rows)]}))


if __name__ == '__main__':
    main()
