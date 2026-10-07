"""Audit all 17 Western recorded banks and prepare only useful improvements.

Writes public/samples/western-completion and an ignored integration suggestion;
never edits the shared manifest. Requires numpy, miniaudio, and Python <=3.12
(aifc). The checked sources are VSCO 2 CE/VCSL (CC0), tonejs-instruments
(CC BY 3.0), and University of Iowa MIS (unrestricted project use).
Existing dense solo Viola/Cello and Bass Guitar banks are retained. Existing
wind recordings receive phase-matched recorded sustain, rather than synthesized
oscillators or recordings relabelled as another instrument or another pitch.
"""
import aifc
import hashlib
import json
import math
import re
import sys
import urllib.parse
import urllib.request
import wave
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '.tmp-source-bowed/deps'))
sys.path.insert(0, str(ROOT / 'western-tools.local'))
import miniaudio

RATE = 44100
SECONDS = 18
CACHE = ROOT / '.tmp-western-completion'
OUT = ROOT / 'public/samples/western-completion'
IOWA_LICENSE = 'https://theremin.music.uiowa.edu/MIS.html'
SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
# Sounding ranges, after applying each profile's written-pitch transposition.
RANGES = {
    'Piano': (21,108), 'Violin': (55,105), 'Viola': (48,93),
    'Cello': (36,81), 'Double Bass': (28,67), 'Flute': (59,98),
    'Clarinet': (50,91), 'Oboe': (58,91), 'Bassoon': (34,75),
    'Trumpet': (54,84), 'French Horn': (35,77), 'Trombone': (40,77),
    'Tuba': (26,67), 'Alto Saxophone': (49,81),
    'Tenor Saxophone': (44,76), 'Guitar': (40,84), 'Bass Guitar': (28,67),
}
WINDS = {'Flute','Clarinet','Oboe','Bassoon','Trumpet','French Horn',
         'Trombone','Tuba','Alto Saxophone','Tenor Saxophone'}


def note(midi, flats=False):
    return f'{(FLATS if flats else SHARPS)[midi % 12]}{midi // 12 - 1}'


def midi(s):
    match = re.fullmatch(r'([A-G])([#bs]?)(-?\d+)', s)
    if not match:
        raise ValueError(f'Invalid note {s}')
    return (int(match[3])+1)*12 + dict(C=0,D=2,E=4,F=5,G=7,A=9,B=11)[match[1]] + (1 if match[2] in ['#','s'] else -1 if match[2] == 'b' else 0)


def slug(name):
    return name.lower().replace(' ', '-')


def fetch(url, suffix):
    path = CACHE / (hashlib.sha256(url.encode()).hexdigest()[:24] + suffix)
    if not path.exists():
        request = urllib.request.Request(url, headers={'User-Agent':'SightReadingSamplePreparation/1.0'})
        with urllib.request.urlopen(request, timeout=60) as response:
            data = response.read()
        if len(data) < 100:
            raise ValueError(f'Empty source {url}')
        path.write_bytes(data)
    return path


def decode(path):
    if path.suffix.lower() in ['.aif','.aiff']:
        with aifc.open(str(path), 'rb') as source:
            rate, channels, width = source.getframerate(), source.getnchannels(), source.getsampwidth()
            raw = source.readframes(source.getnframes())
        if width == 3:
            b = np.frombuffer(raw,dtype=np.uint8).reshape(-1,3).astype(np.int32)
            values = b[:,0]*65536 + b[:,1]*256 + b[:,2]
            values = np.where(values >= 8388608, values-16777216, values)/8388608
        elif width == 2:
            values = np.frombuffer(raw,dtype='>i2').astype(np.float64)/32768
        else:
            raise ValueError(f'Unsupported AIFF width {width}')
        audio = values.reshape(-1,channels).mean(axis=1)
        if rate != RATE:
            # FFT rate conversion retains all harmonics below the destination
            # Nyquist frequency. Zero padding keeps the excerpt edges quiet.
            pad = rate // 20
            padded = np.pad(audio,(pad,pad))
            size = int(round(len(padded)*RATE/rate))
            spectrum = np.fft.rfft(padded)
            target = np.zeros(size//2+1,dtype=np.complex128)
            count = min(len(spectrum),len(target))
            target[:count] = spectrum[:count]
            audio = np.fft.irfft(target,n=size)*size/len(padded)
            trim = int(round(pad*RATE/rate))
            audio = audio[trim:trim+int(round(len(values)/channels*RATE/rate))]
    else:
        decoded = miniaudio.decode_file(str(path),output_format=miniaudio.SampleFormat.FLOAT32,
                                       nchannels=1,sample_rate=RATE)
        audio = np.array(decoded.samples,dtype=np.float64)
    if len(audio) < RATE*.15 or not np.isfinite(audio).all() or np.max(np.abs(audio)) < .001:
        raise ValueError(f'Silent or invalid source {path}')
    return audio - np.mean(audio), rate if path.suffix.lower() in ['.aif','.aiff'] else RATE


def pitch(audio, target):
    values, confidences = [], []
    length = int(RATE * min(.5,max(.16,8/target)))
    for start in [.20,.38,.57,.78,1.02,1.28]:
        frame = audio[int(start*RATE):int(start*RATE)+length]
        if len(frame) != length or np.sqrt(np.mean(frame**2)) < .0001:
            continue
        frame = frame-np.mean(frame)
        size = 1 << (2*len(frame)-1).bit_length()
        ac = np.fft.irfft(np.abs(np.fft.rfft(frame,size))**2,n=size)[:length]
        lo = max(2,int(RATE/(target*1.08)))
        hi = min(length-2,int(RATE/(target*.92)))
        lag = int(np.argmax(ac[lo:hi+1]))+lo
        denominator = ac[lag-1]-2*ac[lag]+ac[lag+1]
        if abs(denominator) < 1e-12:
            continue
        shift = .5*(ac[lag-1]-ac[lag+1])/denominator
        if abs(shift) > 1 or lag in [lo,hi]:
            continue
        values.append(RATE/(lag+shift))
        confidences.append(float(ac[lag]/ac[0]))
    if not values:
        raise ValueError('No stable expected pitch found')
    return float(np.median(values)), float(np.median(confidences))


def trim_leading(audio):
    block = 220
    levels = np.sqrt(np.mean(audio[:len(audio)//block*block].reshape(-1,block)**2,axis=1))
    active = np.flatnonzero(levels > max(.0002,float(levels.max())*.12))
    if not len(active):
        raise ValueError('No audible attack')
    frames = max(0,int(active[0])*block-882)
    return audio[frames:], frames/RATE


def extend_sustain(audio):
    overlap = int(.05*RATE)
    # Match the end of a 1-3 second natural sustain to an earlier 50 ms phase.
    # Wider windows retain bow/breath variation instead of a single-cycle loop.
    block = 441
    levels = np.sqrt(np.mean(audio[:len(audio)//block*block].reshape(-1,block)**2,axis=1))
    live = np.flatnonzero(levels > max(.0005,float(np.max(levels))*.25))
    if not len(live):
        raise ValueError('No sustained audible material')
    # A few high Iowa string notes contain a short bow stroke followed by a
    # long silent tail. Correlation alone would happily loop that release.
    upper = min(3.15,len(audio)/RATE-.1,(int(live[-1])+1)*block/RATE-.03)
    minimum_loop = min(.45,max(.25,upper*.38))
    first = int(min(.35,max(.12,upper*.2))*RATE)
    last = int(min(1.1,max(first/RATE+.1,upper-minimum_loop-.03))*RATE)
    search = audio[first:last+overlap]
    squares = np.r_[0,np.cumsum(search**2)]
    energies = squares[overlap:]-squares[:-overlap]
    size = 1 << (len(search)+overlap-2).bit_length()
    spectrum = np.fft.rfft(search,size)
    best = None
    lower = min(1.55,max(first/RATE+minimum_loop+.05,upper*.6))
    for end in range(int(lower*RATE),int(upper*RATE),int(.05*RATE)):
        reference = audio[end-overlap:end]
        products = np.fft.irfft(spectrum*np.fft.rfft(reference[::-1],size),n=size)[overlap-1:len(search)]
        scores = products/np.maximum(1e-12,np.sqrt(energies*np.sum(reference**2)))
        # Match endpoint level as well as phase, and ensure each loop contains
        # actual sustained tone instead of quiet release or repeated attack.
        limit = min(len(scores),end-first-int(minimum_loop*RATE))
        if limit <= 0:
            continue
        scores = scores[:limit]
        ratios = np.sqrt(energies[:limit]/max(1e-12,float(np.sum(reference**2))))
        ranks = scores-.05*np.abs(np.log(np.maximum(ratios,1e-8)))
        ranks[(ratios<.55)|(ratios>1.8)] = -np.inf
        if not np.isfinite(ranks).any():
            continue
        index = int(np.argmax(ranks))
        correlation = float(scores[index])
        # Prefer a longer loop if two candidates have almost identical phase.
        rank = float(ranks[index]) + min(.008,(end-first-index)/RATE*.002)
        if best is None or rank > best[0]:
            best = (rank,correlation,first+index,end)
    if best is None or best[1] < .5:
        raise ValueError(f'No clean sustain join: {None if best is None else best[1]}')
    _, correlation, start, end = best
    segment = audio[start:end]
    result = audio[:end].copy()
    ramp = .5-.5*np.cos(np.linspace(0,np.pi,overlap))
    compensation = np.sqrt((1-ramp)**2+ramp**2+2*correlation*ramp*(1-ramp))
    while len(result) < RATE*SECONDS:
        result[-overlap:] = (result[-overlap:]*(1-ramp)+segment[:overlap]*ramp)/compensation
        result = np.r_[result,segment[overlap:]]
    return result[:RATE*SECONDS], dict(startSeconds=start/RATE,endSeconds=end/RATE,
        crossfadeSeconds=overlap/RATE,correlation=correlation,method='phase-matched recorded-sustain crossfade')


def iowa_links(relative):
    page = 'https://theremin.music.uiowa.edu/'+relative
    html = fetch(page,'.html').read_text(encoding='utf8',errors='replace')
    links = re.findall(r'href=["\']([^"\']+\.(?:aif|aiff))',html,re.I)
    return page,[urllib.parse.quote(urllib.parse.urljoin(page,link),safe=':/') for link in links]


def iowa_job(name,number,page,links,pattern):
    suffix = pattern.format(note=note(number,True))
    # Iowa displays .aiff labels while the actual links use .aif.
    matches = [url for url in links if urllib.parse.unquote(url).replace('.aiff','.aif').endswith(suffix.replace('.aiff','.aif'))]
    link_correction = None
    if not matches and name == 'Clarinet' and number == 91:
        # The G6 text on the official page mistakenly links to the C6 file.
        # The correctly named G6 file exists in the same official directory;
        # its download and measured G6 pitch are validated independently.
        matches = [links[0].rsplit('/',1)[0]+'/'+suffix.replace('.aiff','.aif')]
        link_correction = 'Official G6 label mistakenly links to C6; fetched and pitch-checked the actual G6 file in the same source directory.'
    if not matches:
        raise ValueError(f'Missing source {name} {suffix}')
    row = dict(instrument=name,midi=number,source=matches[0],sourcePage=page,
                license='Iowa MIS unrestricted project use',licenseUrl=IOWA_LICENSE,
                download=True,sustain=name!='Guitar')
    if link_correction:
        row['sourceLinkCorrection'] = link_correction
    return row


def coverage(bank,name):
    roots = sorted(midi(n) for n in bank['urls'])
    lo,hi = RANGES[name]
    offsets = {note(n):min(abs(n-r) for r in roots) for n in range(lo,hi+1)}
    return dict(instrument=name,soundingRange=[note(lo),note(hi)],recordedRoots=len(roots),
        recordedRange=[note(roots[0]),note(roots[-1])],maximumRepitchSemitones=max(offsets.values()),
        notesBeyondThreeSemitones=[n for n,d in offsets.items() if d>3])


def prepare(job,level):
    original = fetch(job['source'],Path(urllib.parse.unquote(job['source'])).suffix) if job.get('download') else Path(job['input'])
    audio,input_rate = decode(original)
    if 'excerptSeconds' in job:
        start,end = job['excerptSeconds']
        audio = audio[int(start*RATE):int(end*RATE)]
    audio,trim = trim_leading(audio)
    target = 440*2**((job['midi']-69)/12)
    detected,confidence = pitch(audio,target)
    cents = 1200*math.log2(detected/target)
    if abs(cents) > 65 or confidence < .24:
        raise ValueError(f'Incorrect/mistuned source {job["instrument"]} {note(job["midi"])}: {cents:.1f} cents, confidence {confidence:.2f}')
    ratio = target/detected
    positions = np.arange(0,len(audio)-1,ratio)
    audio = np.interp(positions,np.arange(len(audio)),audio)
    loop = None
    if job['sustain']:
        audio,loop = extend_sustain(audio)
    # Retain natural decay for piano and guitar; never loop those instruments.
    rms = float(np.sqrt(np.mean(audio[int(.2*RATE):RATE]**2)))
    gain = min(level/max(rms,.00001),.85/np.max(np.abs(audio)))
    audio *= gain
    audio[:220] *= np.linspace(0,1,220)
    tail = min(int(.15*RATE),len(audio)//4)
    audio[-tail:] *= np.linspace(1,0,tail)
    post,post_confidence = pitch(audio,target)
    post_cents = 1200*math.log2(post/target)
    if abs(post_cents) > 10:
        raise ValueError(f'Pitch correction failed: {job["instrument"]} {note(job["midi"])} {post_cents:.1f} cents')
    folder = OUT/slug(job['instrument'])
    folder.mkdir(parents=True,exist_ok=True)
    filename = note(job['midi']).replace('#','s')+'.wav'
    output = folder/filename
    with wave.open(str(output),'wb') as file:
        file.setparams((1,2,RATE,0,'NONE','not compressed'))
        file.writeframes((np.clip(audio,-1,1)*32767).astype('<i2').tobytes())
    row = {k:v for k,v in job.items() if k not in ['input','download','sustain']}
    row.update(note=note(job['midi']),file=output.relative_to(ROOT/'public/samples').as_posix(),
        seconds=len(audio)/RATE,sampleRate=RATE,channels=1,sourceSampleRate=input_rate,
        sourceSha256=job.get('sourceSha256',hashlib.sha256(original.read_bytes()).hexdigest()),
        preparedInputSha256=hashlib.sha256(original.read_bytes()).hexdigest(),
        sha256=hashlib.sha256(output.read_bytes()).hexdigest(),originalCents=cents,cents=post_cents,
        pitchConfidence=post_confidence,trimmedLeadingSeconds=trim,levelGainDb=20*math.log10(gain),
        peak=float(np.max(np.abs(audio))),rms=float(np.sqrt(np.mean(audio**2))),sustainExtension=loop,
        changes='Mono 44.1 kHz PCM16; leading silence trimmed; pitch centre corrected; level balanced; edge fades.' +
            (' Natural recorded sustain crossfaded to 18 seconds.' if loop else ' Original natural decay retained.'))
    print(f'{job["instrument"]} {row["note"]}: {post_cents:.2f} cents, {row["seconds"]:.1f}s',flush=True)
    return row


def main():
    CACHE.mkdir(exist_ok=True)
    OUT.mkdir(exist_ok=True)
    manifest = json.loads((ROOT/'src/audio/sampleManifest.json').read_text(encoding='utf8'))
    saved_report = OUT/'provenance.json'
    if saved_report.exists():
        manifest = json.loads(saved_report.read_text(encoding='utf8')).get('originalBanks',manifest)
    # The baseline snapshot is pinned before parent integration modifies it.
    baseline = CACHE/'baseline-manifest.json'
    if not baseline.exists():
        baseline.write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf8')
    manifest = json.loads(baseline.read_text(encoding='utf8'))
    old_rows = json.loads((ROOT/'public/samples/western-source-report.json').read_text(encoding='utf8'))
    source_rows = {row['file']:row for row in old_rows}
    if saved_report.exists():
        previous = json.loads(saved_report.read_text(encoding='utf8'))
        # Parent integration may replace the superseded report entries while
        # retaining their original audio files. Preserve that input's source
        # evidence in this report so preparation remains reproducible.
        source_rows.update({row['preparedInput']:row for row in previous.get('samples',[])
                            if row.get('preparedInput')})
    old_plan = json.loads((ROOT/'scripts/western-samples-plan.json').read_text(encoding='utf8'))
    source_blobs = {
        f'https://github.com/{row["repo"]}/blob/{row["revision"]}/{row["path"]}':
        ROOT/'western-sources.local'/f'{row["blob"]}.{row["kind"]}' for row in old_plan
    }
    jobs,levels = [],{}
    for name in RANGES:
        bank = manifest[name]
        rms = []
        for n,filename in bank['urls'].items():
            original = ROOT/'public/samples'/bank['folder']/filename
            audio,_ = decode(original)
            rms.append(float(np.sqrt(np.mean(audio[int(.2*RATE):RATE]**2))))
            if name in WINDS:
                key = f'{bank["folder"]}/{filename}'
                source = source_rows.get(key)
                if not source:
                    raise ValueError(f'Missing provenance {key}')
                url = source['source']
                source_path = source_blobs.get(url)
                source_hash = source.get('sourceSha256')
                if source_path and source_path.exists():
                    source_hash = hashlib.sha256(source_path.read_bytes()).hexdigest()
                job = dict(instrument=name,midi=midi(n),input=str(original),
                    source=urllib.parse.quote(url,safe=':/%'),
                    sourcePage=urllib.parse.quote(source.get('sourcePage',url),safe=':/%'),
                    license=source.get('license','CC0 1.0' if '/sgossner/' in url else 'CC BY 3.0'),
                    licenseUrl=source.get('licenseUrl','https://github.com/sgossner/VSCO-2-CE' if '/sgossner/VSCO' in url else
                        'https://github.com/sgossner/VCSL' if '/sgossner/VCSL' in url else
                        'https://github.com/nbrosowsky/tonejs-instruments/blob/master/LICENSE.md'),
                    preparedInput=key,sustain=True)
                if source_hash:
                    job['sourceSha256'] = source_hash
                pinned = re.search(r'/blob/([a-f0-9]{40})/',url)
                if pinned:
                    job['revision'] = pinned[1]
                excerpt = source.get('excerptSeconds',source.get('upstreamExcerptSeconds'))
                if excerpt:
                    job['upstreamExcerptSeconds'] = excerpt
                jobs.append(job)
        levels[name] = max(.015,float(np.median(rms)))
    # Select new roots only for real range gaps and sparse zones. Individual Iowa
    # files are source-pitch recordings, never pitch-shifted copies advertised
    # as new recorded anchors.
    specs = [
        ('Violin','MISViolin2012.html',[98,100],'Violin.arco.ff.sulE.{note}.stereo.aif'),
        ('Double Bass','MISDoubleBass2012.html',[28],'Bass.arco.ff.sulE.{note}.stereo.aif'),
        ('Double Bass','MISDoubleBass2012.html',[60,63,66,67],'Bass.arco.ff.sulG.{note}.stereo.aif'),
        ('Flute','MISFlute2012.html',[59,67,79,91,97],'Flute.nonvib.ff.{note}.stereo.aiff'),
        ('Clarinet','MISBbClarinet2012.html',[55,67,79,89,91],'BbClarinet.ff.{note}.stereo.aiff'),
        ('Oboe','MISOboe2012.html',[69,81,91],'Oboe.ff.{note}.stereo.aiff'),
        ('Bassoon','MISBassoon2012.html',[37,51,58,63,66,74],'Bassoon.ff.{note}.stereo.aiff'),
        ('French Horn','MISHorn2012.html',[40,46,52,58,63,67,72],'Horn.ff.{note}.stereo.aiff'),
        ('Trumpet','MISBbTrumpet2012.html',[54,59,69,76,83],'Trumpet.novib.ff.{note}.stereo.aiff'),
        ('Trombone','MISTenorTrombone2012.html',[40,64,69],'TenorTrombone.ff.{note}.stereo.aiff'),
        ('Tuba','MISTuba2012.html',[26,33,36,40,45,48,52,57,60],'Tuba.ff.{note}.stereo.aiff'),
    ]
    pages = {}
    for name,relative,numbers,pattern in specs:
        if relative not in pages:
            pages[relative] = iowa_links('MIS-Pitches-2012/'+relative)
        page,links = pages[relative]
        for number in numbers:
            jobs.append(iowa_job(name,number,page,links,pattern))
    # Lowest Kawai sample A#-1 uses the library's C3=MIDI60 convention: it sounds
    # A#0. Knight A-1 supplies the distinct true A0 recording. Both are verified
    # against measured pitch before accepting the source.
    tree = json.loads((ROOT/'vcsl-tree.local').read_text(encoding='utf-8-sig'))
    for number,path in [
        (21,'Chordophones/Zithers/Upright Piano, Knight/Sustains/Player_vl2_rr1_A-1.wav'),
        (22,'Chordophones/Zithers/Grand Piano, Kawai/Sustains/GPiano_sus_A#-1_v3_rr1_Player.wav'),
    ]:
        entry = next(e for e in tree['tree'] if e['path']==path)
        url = 'https://raw.githubusercontent.com/sgossner/VCSL/'+tree['sha']+'/'+urllib.parse.quote(path,safe='/')
        jobs.append(dict(instrument='Piano',midi=number,source=url,
            sourcePage='https://github.com/sgossner/VCSL/blob/'+tree['sha']+'/'+urllib.parse.quote(path,safe='/'),
            license='CC0 1.0',licenseUrl='https://github.com/sgossner/VCSL/blob/'+tree['sha']+'/LICENSE',
            revision=tree['sha'],gitBlobSha=entry['sha'],download=True,sustain=False))
    # Individually played notes from Iowa's chromatic recording. These excerpt
    # starts were checked with both fundamental-spectrum and autocorrelation
    # measurements; each clip ends before the next note's attack.
    guitar_source = 'https://theremin.music.uiowa.edu/sound%20files/MIS/Piano_Other/guitar/Guitar.mf.sul_E.C5B5.stereo.aif'
    for number,start,end in [(76,24.10,30.5),(79,43.40,49.45),(82,59.38,64.45),(83,64.65,69.5)]:
        jobs.append(dict(instrument='Guitar',midi=number,source=guitar_source,
            sourcePage='https://theremin.music.uiowa.edu/MISguitar.html',
            license='Iowa MIS unrestricted project use',licenseUrl=IOWA_LICENSE,
            download=True,sustain=False,excerptSeconds=[start,end]))
    rows,rejected = [],[]
    def run(job):
        try:
            return prepare(job,levels[job['instrument']]),None
        except Exception as error:
            print('REJECTED',job['instrument'],note(job['midi']),str(error),flush=True)
            return None,dict(instrument=job['instrument'],note=note(job['midi']),source=job['source'],reason=str(error))
    with ThreadPoolExecutor(max_workers=4) as pool:
        for row,error in pool.map(run,jobs):
            if row: rows.append(row)
            if error: rejected.append(error)
    suggested = {}
    for name in RANGES:
        old = manifest[name]
        data = [row for row in rows if row['instrument']==name]
        if not data:
            continue
        urls = {n:'../'+old['folder']+'/'+filename for n,filename in old['urls'].items()}
        urls.update({row['note']:slug(name)+'/'+Path(row['file']).name for row in data})
        suggested[name] = dict(folder='western-completion',urls=urls,volume=old.get('volume',0))
    before = [coverage(manifest[name],name) for name in RANGES]
    after = [coverage(suggested.get(name,manifest[name]),name) for name in RANGES]
    report = dict(date='2026-10-03',sourcesChecked=[IOWA_LICENSE,'https://github.com/sgossner/VSCO-2-CE',
        'https://github.com/sgossner/VCSL','https://github.com/nbrosowsky/tonejs-instruments/blob/master/sample-source-info.txt'],
        limitations=['Each root is a genuine source-pitch recording; other pitches use nearest-root playback repitching.',
            'Violin Iowa recordings end at E7; E7–A7 uses up to five semitones of upward repitching.',
            'Tenor Trombone recordings end at C5; C5–F5 uses up to five semitones of upward repitching.',
            'Tuba available recordings end at D4; D4–G4 uses up to five semitones of upward repitching.',
            'The lowest piano addition is a Knight upright A0 mixed with the existing grand-piano bank; timbre varies at that low boundary. The Kawai candidate labelled A#0 was rejected for incorrect pitch.',
            'Long sustained playback repeats crossfaded recorded material; it is not a new 18-second performance.'],
        preservedBanks=['Viola','Cello','Bass Guitar'],originalBanks={name:manifest[name] for name in RANGES},
        before=before,after=after,samples=rows,rejected=rejected)
    (OUT/'provenance.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
    (CACHE/'manifest-suggestion.json').write_text(json.dumps(suggested,indent=2)+'\n',encoding='utf8')
    print('Prepared',len(rows),'recordings; rejected',len(rejected),flush=True)
    for row in after:
        print(row['instrument'],row['recordedRoots'],row['recordedRange'],row['maximumRepitchSemitones'],flush=True)


if __name__ == '__main__':
    main()
