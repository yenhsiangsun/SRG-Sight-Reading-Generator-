"""Extract isolated CC0 Guzheng plucks from Pufermufin's Freesound recording.

Usage: python scripts/prepare-guzheng-recordings.py <396868 HQ MP3>
Requires numpy and miniaudio (the latter may be in western-tools.local).
Writes a new Guzheng bank and an integration draft, never edits the live manifest.
The freely shared HQ preview URL is recorded in the source page's share metadata.
"""
import hashlib
import json
import math
from pathlib import Path
import sys
import wave

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'western-tools.local'))
import miniaudio

SOURCE_PAGE = 'https://freesound.org/people/Pufermufin/sounds/396868/'
SOURCE_AUDIO = 'https://cdn.freesound.org/previews/396/396868_6977826-hq.mp3'
RATE = 44100
# A normal pluck follows a bend demonstration for several strings. These
# selections use the unbent plucks, ending before the next attack or handling noise.
NOTES = [
    (38, 129.092, 2.75), (41, 117.209, 2.75), (43, 110.454, 2.72),
    (45, 104.009, 2.73), (48, 96.236, 2.55), (50, 89.432, 2.47),
    (53, 80.891, 2.60), (55, 74.496, 2.65), (57, 59.210, 4.40),
    (60, 43.985, 2.96), (62, 38.198, 2.62), (65, 29.967, 2.68),
    (67, 24.270, 2.26), (72, 17.246, 1.58), (74, 11.958, 2.67),
]


def measured_frequency(mono, expected):
    pitches = []
    for offset in [.12, .2, .3, .4, .5]:
        y = mono[int(offset * RATE):int((offset + .15) * RATE)]
        y = y - np.mean(y)
        ac = np.fft.irfft(abs(np.fft.rfft(y, 32768)) ** 2)
        lo, hi = int(RATE / (expected * 1.04)), int(RATE / (expected * .96))
        k = int(np.argmax(ac[lo:hi])) + lo
        denominator = ac[k - 1] - 2 * ac[k] + ac[k + 1]
        assert abs(denominator) > 1e-12
        offset = .5 * (ac[k - 1] - ac[k + 1]) / denominator
        pitches.append(RATE / (k + offset))
    return float(np.median(pitches)), [1200 * math.log2(hz / expected) for hz in pitches]


def main():
    source = Path(sys.argv[1])
    source_bytes = source.read_bytes()
    decoded = miniaudio.decode(source_bytes, output_format=miniaudio.SampleFormat.FLOAT32,
                              nchannels=2, sample_rate=RATE)
    audio = np.array(decoded.samples).reshape(-1, 2)
    assert 1473 < len(audio) / RATE < 1475, 'Download must be complete before creating distributable assets'
    destination = ROOT / 'public/samples/guzheng-recorded'
    destination.mkdir(parents=True, exist_ok=True)
    urls, records = {}, []
    for midi, start, duration in NOTES:
        sound = audio[int(start * RATE):int((start + duration) * RATE)].copy()
        sound -= np.mean(sound, axis=0)
        target = 440 * 2 ** ((midi - 69) / 12)
        measured, cents = measured_frequency(sound.mean(axis=1), target)
        shift = 1200 * math.log2(measured / target)
        assert abs(shift) < 45, (midi, shift)
        assert max(cents) - min(cents) < 30, (midi, cents)
        positions = np.arange(0, len(sound) - 1, target / measured)
        tuned = np.stack([np.interp(positions, np.arange(len(sound)), channel)
                          for channel in sound.T], axis=1)
        fade_in, fade_out = 31, int(.06 * RATE)
        tuned[:fade_in] *= np.linspace(0, 1, fade_in)[:, None]
        tuned[-fade_out:] *= np.linspace(1, 0, fade_out)[:, None]
        tuned *= .70 / np.max(abs(tuned))
        verified, verified_cents = measured_frequency(tuned.mean(axis=1), target)
        assert abs(1200 * math.log2(verified / target)) < 3, (midi, verified_cents)
        note = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][midi % 12] + str(midi // 12 - 1)
        filename = note.replace('#', 's') + '-pluck.wav'
        output = destination / filename
        with wave.open(str(output), 'wb') as wav:
            wav.setparams((2, 2, RATE, 0, 'NONE', 'not compressed'))
            wav.writeframes((tuned * 32767).astype('<i2').tobytes())
        urls[note] = filename
        records.append({
            'file': filename, 'midi': midi, 'sourceStartSeconds': start,
            'sourceDurationSeconds': duration, 'durationSeconds': round(len(tuned) / RATE, 5),
            'sourcePitchCents': round(shift, 3), 'outputPitchCents': round(1200 * math.log2(verified / target), 3),
            'peak': round(float(np.max(abs(tuned))), 5),
            'rmsFirstSecond': round(float(np.sqrt(np.mean(tuned[:RATE] ** 2))), 5),
            'sha256': hashlib.sha256(output.read_bytes()).hexdigest(),
        })
        print(note, round(shift, 2), 'cents corrected;', round(len(tuned) / RATE, 2), 'seconds')
    provenance = {
        'instrument': 'Guzheng', 'title': 'LOVELY CHINESE GUZHENG PLUCKED.wav',
        'author': 'Pufermufin', 'source': SOURCE_PAGE, 'audioSource': SOURCE_AUDIO,
        'license': 'CC0 1.0', 'licenseUrl': 'https://creativecommons.org/publicdomain/zero/1.0/',
        'sourceSha256': hashlib.sha256(source_bytes).hexdigest(),
        'sourceDownloadFormat': 'Public high-quality MP3 preview of the original recording',
        'sourceRecording': 'Authentic Guzheng recorded using Blue Spark and Bluebird microphones through a Scarlett 6i6, according to the author.',
        'processing': 'Select isolated unbent plucks; remove DC; correct measured tuning by resampling; preserve stereo; peak normalize to 0.70; apply 0.7 ms attack and 60 ms final fades; export PCM16 44100 Hz. No synthetic harmonics or sustain loops.',
        'coverage': '15 recorded roots D2-D5. Tone Sampler shifts the nearest root between notes and up to one octave for the configured D6 upper limit.',
        'samples': records,
    }
    (destination / 'provenance.json').write_text(json.dumps(provenance, indent=2) + '\n', encoding='utf8')
    draft = ROOT / '.tmp-source-plucked/manifest.json'
    draft.parent.mkdir(exist_ok=True)
    draft.write_text(json.dumps({'Guzheng': {'folder': 'guzheng-recorded', 'urls': urls, 'volume': -13}}, indent=2) + '\n')


if __name__ == '__main__':
    main()
