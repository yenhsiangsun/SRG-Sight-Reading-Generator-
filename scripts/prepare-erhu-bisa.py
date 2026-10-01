"""Prepare two attributed BISA erhu recordings for the browser sampler.

Usage: python scripts/prepare-erhu-bisa.py .tmp-erhu-replacement/bisa
Requires numpy. Download the original Regular A4/E5 WAVs using the Download
controls at the source pages below. Original downloads remain unchanged.
This is a two-root sampler, not a chromatic multisample or a legato instrument.
"""
from pathlib import Path
import hashlib
import json
import math
import shutil
import sys
import wave

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'public/samples/erhu-bisa'
RATE = 48000
SECONDS = 24
SOURCES = [('A4', 69, 7), ('E5', 76, 8)]


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def pitch_frames(audio, target, start=.35, end=1.8):
    pitches, confidences = [], []
    for second in np.arange(start, min(end, len(audio) / RATE - .13), .025):
        frame = audio[int(second * RATE):int((second + .12) * RATE)].copy()
        frame -= frame.mean()
        ac = np.fft.irfft(abs(np.fft.rfft(frame, 16384)) ** 2)
        lo, hi = int(RATE / (target * 1.10)), int(RATE / (target / 1.10))
        lag = lo + np.argmax(ac[lo:hi + 1])
        if lag <= lo or lag >= hi or ac[0] < 1e-9:
            continue
        curvature = ac[lag - 1] - 2 * ac[lag] + ac[lag + 1]
        offset = .5 * (ac[lag - 1] - ac[lag + 1]) / curvature
        pitches.append(RATE / (lag + offset))
        confidences.append(ac[lag] / ac[0])
    if len(pitches) < 8:
        raise ValueError('Insufficient periodic audio for pitch measurement')
    cents = 1200 * np.log2(np.asarray(pitches) / target)
    return float(np.median(pitches)), float(np.percentile(cents, 90) -
                                          np.percentile(cents, 10)), float(np.median(confidences))


def extend(audio):
    # Match waveform phase and level in recorded sustain. The entire initial
    # bow attack remains before the first join; no synthetic waveform is added.
    overlap = int(.08 * RATE)
    first, last = int(.55 * RATE), int(1.60 * RATE)
    search = audio[first:last + overlap]
    squares = np.concatenate([[0], np.cumsum(search * search)])
    energies = squares[overlap:] - squares[:-overlap]
    fft_size = 1 << (len(search) + overlap - 2).bit_length()
    search_fft = np.fft.rfft(search, fft_size)
    best = None
    for end in range(int(1.50 * RATE), int(2.15 * RATE), int(.01 * RATE)):
        reference = audio[end - overlap:end]
        reference_energy = float(np.sum(reference * reference))
        products = np.fft.irfft(search_fft * np.fft.rfft(reference[::-1], fft_size), fft_size)
        products = products[overlap - 1:len(search)]
        correlations = products / np.maximum(1e-12, np.sqrt(energies * reference_energy))
        level_db = 10 * np.log10(np.maximum(energies, 1e-12) / max(reference_energy, 1e-12))
        scores = correlations - .10 * abs(level_db)
        scores[np.arange(len(scores)) + first > end - int(.55 * RATE)] = -np.inf
        index = int(np.argmax(scores))
        candidate = (float(scores[index]), first + index, end,
                     float(correlations[index]), float(level_db[index]))
        if best is None or candidate[0] > best[0]:
            best = candidate
    _, start, end, correlation, level_db = best
    if correlation < .75 or abs(level_db) > 3:
        raise ValueError(f'No suitable sustain join: correlation={correlation}, level={level_db} dB')
    segment = audio[start:end]
    result = audio[:end].copy()
    ramp = .5 - .5 * np.cos(np.linspace(0, np.pi, overlap))
    while len(result) < RATE * SECONDS:
        result[-overlap:] = result[-overlap:] * (1 - ramp) + segment[:overlap] * ramp
        result = np.concatenate([result, segment[overlap:]])
    result = result[:RATE * SECONDS]
    result[:int(.002 * RATE)] *= np.linspace(0, 1, int(.002 * RATE))
    result[-int(.18 * RATE):] *= np.linspace(1, 0, int(.18 * RATE))
    return result, {'startSeconds': round(start / RATE, 6),
                    'endSeconds': round(end / RATE, 6), 'crossfadeSeconds': .08,
                    'crossfadeCorrelation': round(correlation, 6),
                    'crossfadeLevelDifferenceDb': round(level_db, 4)}


def main():
    cache = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / '.tmp-erhu-replacement/bisa'
    DEST.mkdir(parents=True, exist_ok=True)
    entries = []
    for note, midi, page in SOURCES:
        path = cache / f'Erhu_Vibrato_Regular_{note}_BPM100.wav'
        with wave.open(str(path)) as source:
            assert source.getframerate() == RATE and source.getsampwidth() == 2
            channels = source.getnchannels()
            stereo = np.frombuffer(source.readframes(source.getnframes()), dtype='<i2').reshape(-1, channels) / 32768.
        stereo_correlation = float(np.corrcoef(stereo.T)[0, 1])
        if stereo_correlation < .95:
            raise ValueError('Recheck channel choice before downmixing a different source')
        audio = stereo.mean(axis=1)
        dc = float(np.mean(audio))
        audio -= dc
        target = 440 * 2 ** ((midi - 69) / 12)
        measured, spread, confidence = pitch_frames(audio, target)
        ratio = target / measured
        if abs(1200 * math.log2(ratio)) > 100:
            raise ValueError('Pitch correction exceeds one semitone; recheck the source')
        tuned = np.interp(np.arange(0, len(audio) - 1, ratio), np.arange(len(audio)), audio)
        output, loop = extend(tuned)
        # A repeated late sustain can have a slightly different pitch centre
        # from the opening phrase. Balance both measured centres with one small
        # uniform correction; do not flatten the recorded vibrato frame by frame.
        opening_pitch, _, _ = pitch_frames(output, target)
        tail_pitch, _, _ = pitch_frames(output, target, 3, 10)
        # Give the opening slightly more weight because short sight-reading
        # notes often release before the repeated sustain is reached.
        residual_cents = 1200 * (.55 * math.log2(opening_pitch / target) +
                                 .45 * math.log2(tail_pitch / target))
        final_ratio = 2 ** (-residual_cents / 1200)
        output = np.interp(np.arange(len(output)) * final_ratio,
                           np.arange(len(output)), output, right=0)
        ratio *= final_ratio
        loop['finalUniformCorrectionCents'] = round(-residual_cents, 4)
        rms = float(np.sqrt(np.mean(output[int(.35 * RATE):-int(.2 * RATE)] ** 2)))
        gain = min(.14 / rms, .85 / float(np.max(abs(output))))
        output *= gain
        output_name = f'{note}-bisa-v1.wav'
        out_path = DEST / output_name
        with wave.open(str(out_path), 'wb') as destination:
            destination.setparams((1, 2, RATE, 0, 'NONE', 'not compressed'))
            destination.writeframes(np.round(output * 32767).astype('<i2').tobytes())
        original_path = DEST / f'{note}-original.wav'
        shutil.copyfile(path, original_path)
        verified, _, _ = pitch_frames(output, target)
        tuning_error = 1200 * math.log2(verified / target)
        long_pitch, long_spread, _ = pitch_frames(output, target, 3, 10)
        long_error = 1200 * math.log2(long_pitch / target)
        if abs(tuning_error) > 5 or abs(long_error) > 6:
            raise ValueError(f'{note} pitch-center verification failed: opening={tuning_error}, extended={long_error} cents')
        entries.append({'note': note, 'midi': midi,
                        'source': f'https://remix.berklee.edu/bisa-chinese-erhu-oneshots-vibrato/{page}/',
                        'sourceDownload': f'https://remix.berklee.edu/context/bisa-chinese-erhu-oneshots-vibrato/article/{999 + page}/type/native/viewcontent',
                        'sourceFilename': path.name, 'sourceSha256': sha256(path),
                        'sourceSeconds': round(len(audio) / RATE, 6), 'sourceSampleRate': RATE,
                        'sourceChannels': channels, 'sourceStereoCorrelation': round(stereo_correlation, 9),
                        'sourcePitchHz': round(measured, 6), 'targetHz': round(target, 6),
                        'pitchCorrectionCents': round(1200 * math.log2(ratio), 4),
                        'sourcePitchSpreadCentsP90P10': round(spread, 4),
                        'pitchAutocorrelation': round(confidence, 6),
                        'sourceDcOffsetRemoved': round(dc, 9),
                        'gainDb': round(20 * math.log10(gain), 4), 'sustainExtension': loop,
                        'originalAudition': original_path.name,
                        'originalAuditionSha256': sha256(original_path),
                        'originalAuditionProcessing': 'None; byte-identical official download',
                        'output': output_name, 'outputSeconds': SECONDS, 'outputChannels': 1,
                        'outputSampleRate': RATE, 'outputSha256': sha256(out_path),
                        'outputTuningErrorCents': round(tuning_error, 4),
                        'extendedSustainTuningErrorCents': round(1200 * math.log2(long_pitch / target), 4),
                        'extendedSustainPitchSpreadCentsP90P10': round(long_spread, 4),
                        'outputPeak': round(float(np.max(abs(output))), 6),
                        'outputRms': round(float(np.sqrt(np.mean(output ** 2))), 6)})
        print(note, json.dumps(entries[-1]), flush=True)
    report = {'instrument': 'Erhu', 'sourceTitle': 'BISA Chinese Erhu Sample Pack - Regular Vibrato',
              'publisher': 'Berklee Intersectional Soundbox Archive (BISA)',
              'performer': 'Yu Chun Chan', 'recordingEngineer': 'Josefina Ugarte',
              'editor': 'Asher Deverna', 'sourceYear': 2025,
              'source': 'https://remix.berklee.edu/bisa-chinese-erhu/',
              'license': 'CC BY (version not specified on the source collection page)',
              'licenseUrl': 'https://remix.berklee.edu/bisa-chinese-erhu/',
              'licenseStatement': 'These sounds are accessible for all, under a CC BY License.',
              'revision': 1, 'recordedRange': 'A4 and E5', 'recordedAnchors': 2,
              'playableRange': 'D4-D6 by repitching the nearest recorded root',
              'selection': 'Regular takes have narrower measured pitch variation and smoother amplitude onset than the compared Delayed takes. The E5 Delayed take contains about 300 ms of quiet pre-onset audio.',
              'limitations': 'Two recorded roots, one dynamic layer; D4 is A4 shifted down 7 semitones and D6 is E5 shifted up 10 semitones. Pitch-shifting changes timbre and vibrato speed. Repeated recorded sustain is audible on long notes. No recorded legato or articulation switching.',
              'processing': ['Preserve byte-identical original downloads for source audition',
                             'Average nearly identical in-phase stereo channels to mono; remove DC',
                             'Correct the whole-take median pitch centre while retaining vibrato and bow attack',
                             'Extend matched recorded sustain to 24 seconds using 80 ms cosine crossfades',
                             'Balance levels with headroom; 2 ms start and 180 ms final edge fades',
                             'Native 48 kHz PCM16 mono WAV'], 'files': entries}
    (DEST / 'provenance.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print('Prepared two BISA roots:', DEST)


if __name__ == '__main__':
    main()
