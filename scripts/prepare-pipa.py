"""Extract two stable pitched passages from xserra's CC BY 4.0 Pipa-2.wav.
Usage: python scripts/prepare-pipa.py <original WAV>
Requires numpy. This recital prototype is not an isolated-note sample library.
"""
import hashlib
import json
import sys
import wave
from pathlib import Path
import numpy as np

source = Path(sys.argv[1])
destination = Path(__file__).resolve().parents[1] / 'public/samples/pipa'
destination.mkdir(parents=True, exist_ok=True)
with wave.open(str(source)) as f:
    assert f.getsampwidth() == 2 and f.getnchannels() == 2
    rate = f.getframerate()
    stereo = np.frombuffer(f.readframes(f.getnframes()), '<i2').reshape(-1, 2) / 32768
metadata = {'source': 'https://freesound.org/people/xserra/sounds/162086/',
            'author': 'xserra', 'license': 'CC BY 4.0',
            'sha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'samples': []}
for note, target, start, end in [('A3', 220, 25.8, 26.44), ('B3', 246.9416506, 21.2, 22.16)]:
    clip = stereo[int(start*rate):int(end*rate)].copy()
    mono = clip.mean(axis=1)
    pitches = []
    for t in np.arange(.02, len(mono)/rate-.08, .04):
        y = mono[int(t*rate):int((t+.06)*rate)]
        ac = np.fft.irfft(abs(np.fft.rfft(y, 8192))**2)
        lo, hi = int(rate/(target*1.05)), int(rate/(target*.95))
        k = np.argmax(ac[lo:hi])+lo
        delta = .5*(ac[k-1]-ac[k+1])/(ac[k-1]-2*ac[k]+ac[k+1])
        pitches.append(rate/(k+delta))
    measured = float(np.median(pitches))
    positions = np.arange(0, len(clip)-1, target/measured)
    output = np.stack([np.interp(positions, np.arange(len(clip)), ch) for ch in clip.T], axis=1)
    # No synthetic sustain or looping: preserve the recorded passage and room sound.
    output[:int(.005*rate)] *= np.linspace(0,1,int(.005*rate))[:,None]
    output[-int(.06*rate):] *= np.linspace(1,0,int(.06*rate))[:,None]
    output *= .65 / np.max(abs(output))
    with wave.open(str(destination / f'{note}-recital.wav'), 'wb') as f:
        f.setparams((2,2,rate,0,'NONE','not compressed'))
        f.writeframes((output*32767).astype('<i2').tobytes())
    metadata['samples'].append({'note': note, 'startSeconds': start, 'endSeconds': end,
                                'measuredHz': measured, 'targetHz': target})
    print(note, measured, '->', target)
(destination/'provenance.json').write_text(json.dumps(metadata, indent=2)+'\n', encoding='utf-8')
