"""Prepare user-owned Pipa.zip for local development only (numpy required).
No audio is written to public/ or included in production builds.
"""
import io
import json
import sys
import wave
import zipfile
from pathlib import Path
import numpy as np

dest = Path(__file__).resolve().parents[1] / 'pipa-preview.local'
dest.mkdir(exist_ok=True)
records = []
with zipfile.ZipFile(sys.argv[1]) as archive:
    for label, midi in [('a1',45),('c#2',49),('f2',53),('a2',57),('d3',62),('f#3',66),('c4',72),('e4',76),('g4',79)]:
        name = next(n for n in archive.namelist() if '/pipa pluck high velocity ' in n and n.endswith(f' {label} 1.wav'))
        with wave.open(io.BytesIO(archive.read(name))) as f:
            assert f.getsampwidth()==2 and f.getnchannels()==2
            rate=f.getframerate()
            x=np.frombuffer(f.readframes(f.getnframes()),'<i2').reshape(-1,2)/32768
        mono=x.mean(axis=1)
        onset=int(np.argmax(abs(mono)>np.max(abs(mono))*.1))
        target=440*2**((midi-69)/12)
        pitches=[]
        for offset in [.05,.09,.13,.17,.21]:
            y=mono[onset+int(offset*rate):onset+int((offset+.08)*rate)]
            ac=np.fft.irfft(abs(np.fft.rfft(y,16384))**2)
            lo,hi=int(rate/(target*1.045)),int(rate/(target*.955))
            k=np.argmax(ac[lo:hi])+lo
            delta=.5*(ac[k-1]-ac[k+1])/(ac[k-1]-2*ac[k]+ac[k+1])
            pitches.append(rate/(k+delta))
        measured=float(np.median(pitches))
        x=x[max(0,onset-int(.003*rate)):]
        positions=np.arange(0,len(x)-1,target/measured)
        out=np.stack([np.interp(positions,np.arange(len(x)),ch) for ch in x.T],axis=1)
        out[:44]*=np.linspace(0,1,44)[:,None]
        out[-2205:]*=np.linspace(1,0,2205)[:,None]
        out*=.75/np.max(abs(out))
        with wave.open(str(dest/f'{midi}.wav'),'wb') as f:
            f.setparams((2,2,rate,0,'NONE','not compressed'))
            f.writeframes((out*32767).astype('<i2').tobytes())
        records.append({'file':name,'midi':midi,'measuredHz':measured,'targetHz':target})
        print(midi,round(measured,2),'->',round(target,2))
    (dest/'source-info.txt').write_bytes(archive.read('pipa info.txt'))
(dest/'preparation.json').write_text(json.dumps(records,indent=2))
