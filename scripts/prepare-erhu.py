"""Prepare the two BISA regular-vibrato WAVs; requires numpy.
Usage: python scripts/prepare-erhu.py <directory containing the original downloads>
Originals remain unchanged. Output is a small proof-of-concept, not a full multisample library.
"""
import sys
import wave
from pathlib import Path
import numpy as np

destination = Path(__file__).resolve().parents[1] / 'public/samples/erhu'
destination.mkdir(parents=True, exist_ok=True)
for note, target in [('A4', 440.0), ('E5', 659.255114)]:
    source = Path(sys.argv[1]) / f'Erhu_Vibrato_Regular_{note}_BPM100.wav'
    with wave.open(str(source)) as f:
        rate = f.getframerate()
        assert f.getsampwidth() == 2
        stereo = np.frombuffer(f.readframes(f.getnframes()), dtype='<i2').reshape(-1, f.getnchannels()) / 32768
        x = stereo.mean(axis=1)
    # Estimate vibrato centre over many frames, rather than tuning to a single crest.
    pitches = []
    for start in np.arange(.4, 1.6, .04):
        y = x[int(start*rate):int((start+.08)*rate)]
        ac = np.fft.irfft(abs(np.fft.rfft(y, 8192))**2)
        lo, hi = int(rate/(target*1.12)), int(rate/(target*.88))
        lag = np.argmax(ac[lo:hi]) + lo
        offset = .5*(ac[lag-1]-ac[lag+1])/(ac[lag-1]-2*ac[lag]+ac[lag+1])
        pitches.append(rate/(lag+offset))
    detected = float(np.median(pitches))
    ratio = target / detected
    positions = np.arange(0, len(x)-1, ratio)
    x = np.stack([np.interp(positions, np.arange(len(x)), channel) for channel in stereo.T], axis=1)
    # Preserve the original stereo attack and first 1.8 seconds; only extend the tail.
    segment = x[int(.65*rate):int(1.8*rate)]
    output = x[:int(1.8*rate)].copy()
    overlap = int(.08*rate)
    ramp = np.linspace(0, 1, overlap)[:, None]
    while len(output) < rate*12:
        output[-overlap:] = output[-overlap:]*(1-ramp) + segment[:overlap]*ramp
        output = np.concatenate([output, segment[overlap:]])
    output = output[:rate*12]
    output[-int(.15*rate):] *= np.linspace(1, 0, int(.15*rate))[:, None]
    with wave.open(str(destination / f'{note}-natural.wav'), 'wb') as f:
        f.setparams((2, 2, rate, 0, 'NONE', 'not compressed'))
        f.writeframes((output*32767).astype('<i2').tobytes())
    print(f'{note}: measured centre {detected:.2f} Hz, tuned to {target:.2f} Hz; preserved stereo attack, 12 s sustain')

