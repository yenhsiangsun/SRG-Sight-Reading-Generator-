import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';import {loadModule} from './helpers.mjs';
const base={compositionStyle:'auto',instrument:'Piano',instrumentProfile:'Daruan',clef:'bass',difficulty:'intermediate',keySignature:'C',tonic:'C',scaleId:'major',timeSignature:'4/4',rhythmLevel:'medium',measures:8,tempo:90,range:{min:38,max:67},allowAccidentals:false,mixedMeters:false,meters:['4/4']};
const seeds=[95011,95029,95047,95071,95093,95111,95131,95153,95177,95203,95227,95257,95603,95627,95653,95683,95707,95731,95759,95783];
const random=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const plain=x=>JSON.parse(JSON.stringify(x));

test('plucked motives, contour points and development boundaries are composed rather than selected from six fixed themes',()=>{
  const {planLongLineDevelopment}=loadModule('src/music/longLineDevelopment.ts');
  for(const instrumentProfile of ['Daruan','Pipa']){
    const plans=seeds.map(seed=>planLongLineDevelopment({...base,instrumentProfile},random(seed)));
    assert.ok(new Set(plans.map(p=>p.motif.join(','))).size>=16,'each new motive must have its own interval identity');
    assert.ok(new Set(plans.map(p=>p.motif.length)).size>=3,'a five-note loop cannot define every study');
    assert.equal(new Set(plans.map(p=>JSON.stringify(p.longLine.material.outline))).size,20);
    assert.ok(new Set(plans.map(p=>JSON.stringify(p.longLine.material.ideas.map(i=>i.end-i.start)))).size>=16);
    for(const p of plans){const ideas=p.longLine.material.ideas;assert.equal(ideas[0].start,0);assert.equal(ideas.at(-1).end,32);assert.ok(ideas.some(i=>i.operation==='sequence'||i.operation==='invert'||i.operation==='tail'));}
  }
});

test('only the requested plucked profiles use the new material and non-plucked seeded studies remain exact',()=>{
  const {isPluckedProfile}=loadModule('src/music/pluckedDevelopment.ts');
  for(const name of ['Liuqin','Pipa','Zhongruan','Daruan','Sanxian','Guzheng','Yangqin','Guitar','Bass Guitar'])assert.equal(isPluckedProfile(name),true,name);
  for(const name of ['Piano','Sheng','Erhu','Flute','Voice','Cello'])assert.equal(isPluckedProfile(name),false,name);
  const fixtures=JSON.parse(fs.readFileSync(new URL('./fixtures/plucked-bypass.json',import.meta.url)));
  for(const c of fixtures){const ex=loadModule('src/music/composeExercise.ts',c.seed).composeExercise(c.options,c.grand);assert.equal(createHash('sha256').update(JSON.stringify(ex)).digest('hex'),c.hash,c.id);}
});

test('procedural pulse vocabulary preserves every meter, phrase length and rhythm grade',()=>{
  const {planLongLineDevelopment}=loadModule('src/music/longLineDevelopment.ts'),{validMusicalIntent}=loadModule('src/music/musicalIntent.ts'),{assertMeasureRhythm}=loadModule('src/music/rhythmTiming.ts');
  for(const meter of ['2/4','3/4','4/4','5/4','3/8','6/8','7/8','9/8','12/8'])for(const measures of [4,8,12,16])for(const rhythmLevel of ['simple','medium','complex']){
    const plan=planLongLineDevelopment({...base,timeSignature:meter,measures,rhythmLevel},random(95653));assert.ok(validMusicalIntent(plan,measures));
    for(const bar of plan.rhythm){const [top,bottom]=meter.split('/').map(Number);assertMeasureRhythm({totalUnits:top*16/bottom,events:bar.notes.map(n=>({...n,durationUnits:n.units}))},meter);if(meter.endsWith('/8'))assert.ok(bar.notes.every(n=>!n.tuplet));}
    assert.equal(plan.rhythm.at(-1).notes.at(-1).rest,false);
  }
});

test('pitch difficulty cannot alter the plucked identity, rhythm, meter feel or subdivision budget',()=>{
  for(const instrumentProfile of ['Daruan','Pipa','Yangqin']){
    let reference;
    for(const difficulty of ['beginner','intermediate','advanced']){
      const range=instrumentProfile==='Daruan'?base.range:{min:45,max:88},options={...base,instrumentProfile,range,difficulty,rhythmLevel:'complex'};
      const ex=loadModule('src/music/composeExercise.ts',95683).composeExercise(options,instrumentProfile==='Yangqin'?'two-hand':undefined);
      loadModule('src/music/exerciseQuality.ts').validateGeneratedExercise(ex,range,false);
      const identity={motif:plain(ex.musicalIntent.motif),material:plain(ex.musicalIntent.longLine.material),rhythm:ex.measures.map(b=>b.events.map(n=>[n.startUnits,n.durationUnits,n.rest,n.tuplet]))};
      reference??=plain(identity);assert.deepEqual(plain(identity),reference);
      const notes=ex.measures.flatMap(b=>b.events.filter(n=>!n.rest));assert.ok(notes.filter(n=>n.durationUnits<=1).length/notes.length>=.8);
    }
  }
});

test('saved generative plans accept old metadata and reject broken outlines, pulse cells and idea boundaries',()=>{
  const {planLongLineDevelopment}=loadModule('src/music/longLineDevelopment.ts'),{validMusicalIntent}=loadModule('src/music/musicalIntent.ts');
  const plan=planLongLineDevelopment(base,random(95731));assert.ok(validMusicalIntent(plan,8));
  const legacy=plain(plan);delete legacy.longLine.material;assert.ok(validMusicalIntent(legacy,8));
  for(const change of [p=>p.longLine.material.outline[1][0]=-1,p=>p.longLine.material.ideas[0].start=1,p=>p.longLine.material.palette[4][0]=[4,4],p=>p.longLine.material.tail[0]=Infinity]){
    const corrupt=plain(plan);change(corrupt);assert.equal(validMusicalIntent(corrupt,8),false);
  }
});

test('recalled complex cells cannot turn an occasional light pulse into a recurring easy rhythm',()=>{
  const {planLongLineDevelopment}=loadModule('src/music/longLineDevelopment.ts');
  for(let seed=0;seed<100;seed++){
    const plan=planLongLineDevelopment({...base,rhythmLevel:'complex'},random(96001+seed));
    for(const cells of Object.values(plan.longLine.material.palette)){
      const durations=cells.flat();assert.ok(durations.filter(n=>n===1).length/durations.length>=.88);
    }
  }
});
