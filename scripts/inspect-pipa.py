import wave
import numpy as np
from pathlib import Path

source = Path.home() / 'Downloads/162086__xserra__pipa-2.wav'
with wave.open(str(source)) as f:
    rate = f.getframerate()
    x = np.frombuffer(f.readframes(f.getnframes()), '<i2').reshape(-1, f.getnchannels()).mean(axis=1) / 32768
print('rate/duration/peak', rate, len(x)/rate, np.max(abs(x)))
hop = int(rate*.01)
energy = np.array([np.sqrt(np.mean(x[i:i+hop]**2)) for i in range(0,len(x)-hop,hop)])
onsets=[]
for i in range(3,len(energy)-2):
    if energy[i]>.025 and energy[i] > np.mean(energy[i-3:i])*1.65 and energy[i]>=energy[i+1] and (not onsets or i*.01-onsets[-1]>.12):
        onsets.append(i*.01)
for j,t in enumerate(onsets):
    end=onsets[j+1] if j+1<len(onsets) else len(x)/rate
    if end-t<.23: continue
    pitches=[]
    for offset in [.04,.09,.14]:
        y=x[int((t+offset)*rate):int((t+offset+.07)*rate)]
        n=32768
        spec=abs(np.fft.rfft(y*np.hanning(len(y)),n))
        peaks=np.argsort(spec)[-6:]
        k=peaks[-1]
        freq=k*rate/n
        pitches.append(round(69+12*np.log2(freq/440),2))
    print(round(t,3),round(end-t,3),pitches)
