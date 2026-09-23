"""Validate and install the pinned batch (numpy + miniaudio required).
Run fetch-western-samples.mjs first. Source downloads remain in *.local folders.
"""
import json
import math
import shutil
import sys
import wave
from pathlib import Path
import numpy as np
root=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root/'western-tools.local'))
import miniaudio

plan=json.loads((root/'scripts/western-samples-plan.json').read_text())
manifest=json.loads((root/'src/audio/sampleManifest.json').read_text())
report=[]
names=['C','Cs','D','Ds','E','F','Fs','G','Gs','A','As','B']
for item in plan:
    source=root/'western-sources.local'/f"{item['blob']}.{item['kind']}"
    decoded=miniaudio.decode_file(str(source),output_format=miniaudio.SampleFormat.FLOAT32,nchannels=2,sample_rate=44100)
    x=np.array(decoded.samples).reshape(-1,2)
    assert np.all(np.isfinite(x)) and len(x)>4410 and np.max(abs(x))>.001, item['path']
    pitch=item['midi']; hz=440*2**((pitch-69)/12)
    # Fundamental-centred autocorrelation: inspect tuning without retuning ensembles.
    mono=x.mean(axis=1); detected=[]
    for t in [.3,.5,.7]:
        y=mono[int(t*44100):int((t+.12)*44100)]
        if len(y)<2048: continue
        ac=np.fft.irfft(abs(np.fft.rfft(y,16384))**2)
        lo=max(2,int(44100/(hz*1.06))); hi=min(len(y)-2,int(44100/(hz*.94)))
        if hi<=lo:continue
        k=int(np.argmax(ac[lo:hi]))+lo
        denom=ac[k-1]-2*ac[k]+ac[k+1]
        if abs(denom)<1e-12:continue
        offset=.5*(ac[k-1]-ac[k+1])/denom
        detected.append(44100/(k+offset))
    cents=1200*math.log2(float(np.median(detected))/hz) if detected else None
    if cents is not None and abs(cents)>45:
        print('Excluded suspect tuning:',item['path'],round(cents,1),'cents')
        continue
    folder=root/'public/samples'/item['folder'];folder.mkdir(exist_ok=True)
    filename=f'{names[pitch%12]}{pitch//12-1}.{item["kind"]}'
    dest=folder/filename
    if item['kind']=='mp3':shutil.copyfile(source,dest)
    else:
        # Retain stereo and full natural sustain, reduce 24-bit sources to PCM16.
        x=np.clip(x,-.9999,.9999)
        with wave.open(str(dest),'wb') as f:
            f.setparams((2,2,44100,0,'NONE','not compressed'))
            f.writeframes((x*32767).astype('<i2').tobytes())
    instrument=item['instrument']
    if instrument not in [r['instrument'] for r in report]:manifest[instrument]={'folder':item['folder'],'urls':{}}
    manifest[instrument]['urls'][f'{names[pitch%12].replace("s","#")}{pitch//12-1}']=filename
    energy=np.sqrt(np.mean(x[:min(len(x),44100)]**2))
    report.append(dict(instrument=instrument,midi=pitch,file=f'{item["folder"]}/{filename}',
                       seconds=round(len(x)/44100,3),peak=round(float(np.max(abs(x))),4),
                       rms=round(float(energy),5),cents=round(cents,1) if cents is not None else None,
                       source=f'https://github.com/{item["repo"]}/blob/{item["revision"]}/{item["path"]}'))
for instrument in dict.fromkeys(r['instrument'] for r in report):
    rows=[r for r in report if r['instrument']==instrument]
    # Bring the median initial second to roughly -24 dBFS at playback. Avoid large boosts.
    gain=max(-20,min(6,20*math.log10(.0631/max(.001,float(np.median([r['rms'] for r in rows])))),20*math.log10(.75/max(r['peak'] for r in rows))))
    manifest[instrument]['volume']=round(gain,1)
    print(instrument,len(rows),'samples; shortest',min(r['seconds'] for r in rows),'s; volume',round(gain,1),'dB')
(root/'src/audio/sampleManifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
(root/'public/samples/western-source-report.json').write_text(json.dumps(report,indent=2)+'\n')
print('Large tuning deviations:',[(r['instrument'],r['midi'],r['cents']) for r in report if r['cents'] is not None and abs(r['cents'])>45])
