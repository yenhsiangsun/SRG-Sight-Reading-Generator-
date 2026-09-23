"""Prepare owstu's CC0 sung C-sharp from the public Freesound MP3 preview.
Requires numpy and miniaudio (western-tools.local). No synthesized voice is used.
"""
import hashlib
import json
import sys
import wave
from pathlib import Path
import numpy as np
root=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root/'western-tools.local'))
import miniaudio
source=root/'voice-sources.local/555984.mp3'
d=miniaudio.decode_file(str(source),output_format=miniaudio.SampleFormat.FLOAT32,nchannels=2,sample_rate=44100)
x=np.array(d.samples).reshape(-1,2)
rate=44100
target=440*2**(4/12)  # C#5, MIDI 73
centres=[]
for t in np.arange(.8,8,.08):
    y=x[int(t*rate):int((t+.1)*rate)].mean(axis=1)
    ac=np.fft.irfft(abs(np.fft.rfft(y,16384))**2)
    lo,hi=int(rate/(target*1.06)),int(rate/(target*.94))
    k=int(np.argmax(ac[lo:hi]))+lo
    delta=.5*(ac[k-1]-ac[k+1])/(ac[k-1]-2*ac[k]+ac[k+1])
    centres.append(rate/(k+delta))
measured=float(np.median(centres))
# Omit the initial pitch scoop and final breath; retain the stable sung vowel.
x=x[int(.65*rate):int(8.65*rate)]
positions=np.arange(0,len(x)-1,target/measured)
out=np.stack([np.interp(positions,np.arange(len(x)),ch) for ch in x.T],axis=1)
out[:int(.015*rate)]*=np.linspace(0,1,int(.015*rate))[:,None]
out[-int(.1*rate):]*=np.linspace(1,0,int(.1*rate))[:,None]
out*=.65/np.max(abs(out))
dest=root/'public/samples/voice';dest.mkdir(exist_ok=True)
with wave.open(str(dest/'Cs5-vowel.wav'),'wb') as f:
    f.setparams((2,2,rate,0,'NONE','not compressed'))
    f.writeframes((out*32767).astype('<i2').tobytes())
meta={'title':'vocal C sharp long.wav','author':'owstu','license':'CC0 1.0',
      'source':'https://freesound.org/people/owstu/sounds/555984/',
      'download':'https://cdn.freesound.org/previews/555/555984_1690102-lq.mp3',
      'sourceFormat':'public lossy MP3 preview, not original WAV',
      'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),
      'startSeconds':.65,'endSeconds':8.65,'measuredHz':measured,'targetHz':target,
      'recordedRoot':'C#5','changes':'crop, pitch-centre correction, gain and edge fades; other notes repitched by playback'}
(dest/'provenance.json').write_text(json.dumps(meta,indent=2)+'\n')
print('Voice C#5:',measured,'->',target,'Hz;',len(out)/rate,'seconds')
