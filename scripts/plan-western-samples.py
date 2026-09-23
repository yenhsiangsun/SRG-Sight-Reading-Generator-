"""Build a pinned batch-import plan from downloaded official GitHub trees."""
import json
import re
from pathlib import Path

root=Path(__file__).resolve().parents[1]
plan=[]
def tree(name): return json.loads((root/f'{name}-tree.local').read_text(encoding='utf-8-sig'))
def midi(note):
    m=re.fullmatch(r'([A-G])([#s]?)(-?\d+)',note)
    return (int(m[3])+1)*12+{'C':0,'D':2,'E':4,'F':5,'G':7,'A':9,'B':11}[m[1]]+bool(m[2])
def add(repo,t,entry,instrument,folder,note,kind):
    plan.append(dict(repo=repo,revision=t['sha'],path=entry['path'],blob=entry['sha'],
                     instrument=instrument,folder=folder,midi=note,kind=kind))
t=tree('tone')
tone={'Piano':('piano',21,108),'Violin':('violin',55,105),'Flute':('flute',59,98),
      'Bassoon':('bassoon',34,75),'Double Bass':('contrabass',28,67),
      'French Horn':('french-horn',35,77),'Trombone':('trombone',40,77),
      'Trumpet':('trumpet',54,84),'Tuba':('tuba',26,67),
      'Guitar':('guitar-acoustic',40,84),'Bass Guitar':('bass-electric',28,67),
      'Alto Saxophone':('saxophone',49,81)}
for instrument,(folder,lo,hi) in tone.items():
    for e in t['tree']:
        if e['path'].startswith(f'samples/{folder}/') and e['path'].endswith('.mp3'):
            pitch=midi(Path(e['path']).stem)
            if lo-3<=pitch<=hi+3: add('nbrosowsky/tonejs-instruments',t,e,instrument,folder,pitch,'mp3')
t=tree('vsco')
for instrument,folder,prefix,pattern in [
    ('Viola','viola','Strings/Viola Section/susvib/',r'_v2_1.wav$'),
    ('Cello','cello','Strings/Cello Section/susvib/',r'_v3_1.wav$'),
    ('Clarinet','clarinet','Woodwinds/Clarinet/susLong/',r'_v2_rr1_sum.wav$'),
    ('Oboe','oboe','Woodwinds/Oboe/Sus/',r'_v3_Main.wav$')]:
    for e in t['tree']:
        if e['path'].startswith(prefix) and re.search(pattern,e['path']):
            note=re.search(r'_([A-G]#?\d)_',e['path'])[1]
            add('sgossner/VSCO-2-CE',t,e,instrument,folder,midi(note)+12,'wav')
t=tree('vcsl')
for e in t['tree']:
    if '/Tenor Saxophone/Non-Vibrato/' in e['path'] and e['path'].endswith('_vl2_rr1.wav'):
        note=re.search(r'_([A-G]#?\d)_',e['path'])[1]
        pitch=midi(note)+12
        if 44<=pitch<=76: add('sgossner/VCSL',t,e,'Tenor Saxophone','tenor-saxophone',pitch,'wav')
(root/'scripts/western-samples-plan.json').write_text(json.dumps(plan,indent=2)+'\n')
print(len(plan),'samples for',len(set(p['instrument'] for p in plan)),'instruments')
