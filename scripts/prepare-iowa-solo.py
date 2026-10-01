"""Download Iowa MIS solo strings and convert them to calibrated PCM16 samples.

Requires Python 3.12 (aifc) and numpy. Writes new banks plus provenance; it does
not change the app manifest. Sources: https://theremin.music.uiowa.edu/MIS.html
The source site explicitly permits use in any project without restrictions.
"""
import aifc
import hashlib
import json
import re
import urllib.parse
import urllib.request
import wave
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.tmp-source-western'
CACHE.mkdir(exist_ok=True)
LICENSE_URL = 'https://theremin.music.uiowa.edu/MIS.html'
FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']


def decode(path):
    with aifc.open(str(path), 'rb') as source:
        rate, channels, width = source.getframerate(), source.getnchannels(), source.getsampwidth()
        raw = source.readframes(source.getnframes())
        if width == 3:
            b = np.frombuffer(raw, dtype=np.uint8).reshape(-1, 3).astype(np.int32)
            values = b[:, 0] * 65536 + b[:, 1] * 256 + b[:, 2]
            values = np.where(values >= 8388608, values - 16777216, values) / 8388608
        elif width == 2:
            values = np.frombuffer(raw, dtype='>i2').astype(np.float64) / 32768
        else:
            raise ValueError(f'Unsupported AIFF sample width: {width}')
    x = values.reshape(-1, channels)
    if channels == 1:
        x = np.repeat(x, 2, axis=1)
    if rate != 44100:
        positions = np.arange(0, len(x) - 1, rate / 44100)
        x = np.stack([np.interp(positions, np.arange(len(x)), c) for c in x.T], axis=1)
    return x


def measured_pitch(x, target):
    mono = x.mean(axis=1)
    frequencies = []
    for start in [.3, .5, .7, .9]:
        frame = mono[int(start * 44100):int((start + .15) * 44100)]
        if len(frame) < 300 or np.sqrt(np.mean(frame ** 2)) < .00005:
            continue
        frame = frame - np.mean(frame)
        ac = np.fft.irfft(np.abs(np.fft.rfft(frame, 32768)) ** 2)
        lo, hi = int(44100 / (target * 1.06)), int(44100 / (target * .94))
        lag = int(np.argmax(ac[lo:hi + 1])) + lo
        shift = .5 * (ac[lag - 1] - ac[lag + 1]) / (ac[lag - 1] - 2 * ac[lag] + ac[lag + 1])
        frequencies.append(44100 / (lag + shift))
    if not frequencies:
        raise ValueError('No sustained pitch')
    return float(np.median(frequencies))


def extend_sustain(audio):
    """Find matching wave phase before joining; avoid periodic crossfade dips."""
    rate, overlap = 44100, 2205
    mono = audio.mean(axis=1)
    first, last = int(.4 * rate), int(.9 * rate)
    search = mono[first:last + overlap]
    squared = np.r_[0, np.cumsum(search ** 2)]
    energies = squared[overlap:] - squared[:-overlap]
    fft_size = 1 << (len(search) + overlap - 2).bit_length()
    spectrum = np.fft.rfft(search, fft_size)
    best = None
    for end in range(int(1.3 * rate), min(int(1.75 * rate), len(audio) - 4410), 2205):
        reference = mono[end - overlap:end]
        products = np.fft.irfft(spectrum * np.fft.rfft(reference[::-1], fft_size), fft_size)[overlap - 1:len(search)]
        scores = products / np.maximum(1e-12, np.sqrt(energies * np.sum(reference ** 2)))
        index = int(np.argmax(scores))
        if best is None or scores[index] > best[0]:
            best = (float(scores[index]), first + index, end)
    if best is None or best[0] < .5:
        raise ValueError('No adequately correlated sustain join')
    correlation, start, end = best
    segment = audio[start:end]
    result = audio[:end].copy()
    ramp = (.5 - .5 * np.cos(np.linspace(0, np.pi, overlap)))[:, None]
    # Correlated sources require less than an equal-power boost; compensate
    # only for the energy lost to this specific join's measured correlation.
    compensation = np.sqrt((1 - ramp) ** 2 + ramp ** 2 + 2 * correlation * ramp * (1 - ramp))
    while len(result) < rate * 12:
        result[-overlap:] = (result[-overlap:] * (1 - ramp) + segment[:overlap] * ramp) / compensation
        result = np.concatenate([result, segment[overlap:]])
    return result[:rate * 12], dict(startSeconds=start/rate, endSeconds=end/rate, crossfadeSeconds=overlap/rate, correlation=correlation)


def prepare(job):
    name, midi, url, page, *excerpt = job
    original = CACHE / (hashlib.sha256(url.encode()).hexdigest()[:24] + '.aif')
    if not original.exists():
        with urllib.request.urlopen(url, timeout=60) as response:
            original.write_bytes(response.read())
    x = decode(original)
    if excerpt:
        start, end = excerpt[0]
        x = x[int(start * 44100):int(end * 44100)]
    # Retain 20 ms before the audible bow/tongue attack. Very quiet pre-bow noise
    # otherwise delays viola short notes by hundreds of milliseconds.
    block = 220
    levels = np.sqrt(np.mean(x[:len(x) // block * block].reshape(-1, block, 2) ** 2, axis=(1, 2)))
    active = np.where(levels > max(.0001, float(levels.max()) * .18))[0]
    if len(active) == 0:
        raise ValueError(f'Silent source {url}')
    trim = max(0, int(active[0]) * block - 882)
    x = x[trim:]
    target = 440 * 2 ** ((midi - 69) / 12)
    detected = measured_pitch(x, target)
    cents = 1200 * np.log2(detected / target)
    if abs(cents) > 60:
        raise ValueError(f'Mistuned/incorrect source {name} {midi}: {cents:.1f} cents')
    positions = np.arange(0, len(x) - 1, target / detected)
    x = np.stack([np.interp(positions, np.arange(len(x)), c) for c in x.T], axis=1)
    result, loop = extend_sustain(x)
    rms = float(np.sqrt(np.mean(result[int(.2 * 44100):44100] ** 2)))
    gain = min(.16 / max(rms, .00001), .85 / np.max(np.abs(result)))
    result *= gain
    result[:220] *= np.linspace(0, 1, 220)[:, None]
    result[-6615:] *= np.linspace(1, 0, 6615)[:, None]
    note = f'{SHARPS[midi % 12]}{midi // 12 - 1}'
    strings = name in ['Viola', 'Cello']
    folder = f'{name.lower()}-solo' if strings else name.lower().replace(' ', '-')
    dest = ROOT / 'public/samples' / folder
    dest.mkdir(exist_ok=True)
    file = note.replace('#', 's') + ('.wav' if strings else '-iowa.wav')
    with wave.open(str(dest / file), 'wb') as out:
        out.setparams((2, 2, 44100, 0, 'NONE', 'not compressed'))
        out.writeframes((np.clip(result, -1, 1) * 32767).astype('<i2').tobytes())
    row = dict(instrument=name, midi=midi, note=note, file=f'{folder}/{file}', seconds=len(result)/44100,
               peak=float(np.max(np.abs(result))), rms=float(np.sqrt(np.mean(result ** 2))),
               source=url, sourcePage=page, licenseUrl=LICENSE_URL,
               license='Iowa MIS unrestricted project use', sourceSha256=hashlib.sha256(original.read_bytes()).hexdigest(),
               sha256=hashlib.sha256((dest/file).read_bytes()).hexdigest(),
               originalCents=float(cents), cents=float(1200*np.log2(measured_pitch(result, target)/target)), sustainExtension=loop,
               trimmedLeadingSeconds=trim/44100)
    if excerpt:
        row['excerptSeconds'] = list(excerpt[0])
    print(f'{name} {note}: {row["cents"]:.1f} cents', flush=True)
    return row


if __name__ == '__main__':
    jobs = []
    for name, low in [('Viola', 48), ('Cello', 36)]:
        page = f'https://theremin.music.uiowa.edu/MIS-Pitches-2012/MIS{name}2012.html'
        html = urllib.request.urlopen(page, timeout=30).read().decode('utf8', errors='replace')
        links = re.findall(r'href=["\']([^"\']+\.aif)', html, re.I)
        # Iowa's cello Gb5 source fails the pitch check (~one semitone sharp).
        # Use the neighbouring F5 recording rather than retuning a wrong note.
        roots = [77 if name == 'Cello' and n == 78 else n for n in range(low, low + 46, 3)]
        for midi in roots:
            note = f'{FLATS[midi % 12]}{midi // 12 - 1}'
            string = 'C' if midi < low + 7 else 'G' if midi < low + 14 else 'D' if midi < low + 21 else 'A'
            suffix = f'{name}.arco.ff.sul{string}.{note}.stereo.aif'
            matches = [link for link in links if link.endswith(suffix)]
            if not matches:
                raise ValueError(f'Missing source {suffix}')
            url = urllib.parse.quote(urllib.parse.urljoin(page, matches[0]), safe=':/')
            jobs.append((name, midi, url, page))
    # Sparse gaps in the existing wind banks: use isolated notes from the
    # university's chromatic-scale recordings, never extract a moving melody.
    for name, midi, path, excerpt, page in [
        ('Bassoon', 34, 'Woodwinds/bassoon/Bassoon.mf.Bb1B1.aiff', (0.08, 2.05), 'MISbassoon.html'),
        ('Bassoon', 40, 'Woodwinds/bassoon/Bassoon.mf.C2B2.aiff', (8.88, 11.09), 'MISbassoon.html'),
        ('French Horn', 65, 'Brass/frenchhorn/Horn.mf.C4B4.aiff', (14.74, 17.57), 'MISFrenchhorn.html'),
        ('French Horn', 69, 'Brass/frenchhorn/Horn.mf.C4B4.aiff', (25.19, 27.65), 'MISFrenchhorn.html'),
        ('Trombone', 72, 'Brass/tenortrombone/TenorTrombone.mf.C5.aiff', (0.04, 2.05), 'MIStenortrombone.html'),
    ]:
        url = urllib.parse.quote('https://theremin.music.uiowa.edu/sound files/MIS/' + path, safe=':/')
        jobs.append((name, midi, url, 'https://theremin.music.uiowa.edu/' + page, excerpt))
    with ThreadPoolExecutor(max_workers=4) as pool:
        rows = list(pool.map(prepare, jobs))
    manifest = {}
    for name in ['Viola', 'Cello']:
        data = [row for row in rows if row['instrument'] == name]
        folder = f'{name.lower()}-solo'
        report = dict(source='University of Iowa Musical Instrument Samples', licenseUrl=LICENSE_URL,
                      changes='Leading silence trimmed; pitch-centre corrected; level balanced; stable bow sustain crossfaded to 12 seconds; stereo PCM16 44.1 kHz.', samples=data)
        (ROOT / 'public/samples' / folder / 'provenance.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf8')
        manifest[name] = dict(folder=folder, urls={r['note']:Path(r['file']).name for r in data}, volume=-8)
    existing = json.loads((ROOT / 'src/audio/sampleManifest.json').read_text(encoding='utf8'))
    for name in ['Bassoon', 'French Horn', 'Trombone']:
        data = [row for row in rows if row['instrument'] == name]
        bank = existing[name]
        manifest[name] = dict(bank, urls={**bank['urls'], **{r['note']:Path(r['file']).name for r in data}})
        (ROOT / 'public/samples' / bank['folder'] / 'iowa-provenance.json').write_text(json.dumps(dict(
            licenseUrl=LICENSE_URL, changes='Isolated note excerpts, pitch-centre correction, level adjustment, 12 second crossfaded sustain, PCM16 stereo.', samples=data), indent=2) + '\n', encoding='utf8')
    (CACHE / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf8')
    (CACHE / 'report.json').write_text(json.dumps(rows, indent=2) + '\n', encoding='utf8')
