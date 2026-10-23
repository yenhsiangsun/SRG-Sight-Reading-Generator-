import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

const {planMixedStaff,planSingleStaff}=loadModule('src/notation/mixedStaff.ts');
const {midiFromKey,notePitches}=loadModule('src/music/notePitches.ts');
const {ledgerCount}=loadModule('src/notation/octaveLines.ts');
const {createPlaybackEvents}=loadModule('src/audio/PlaybackController.ts');
const plain=value=>JSON.parse(JSON.stringify(value));
function bar(keys,units=4){
 return {timeSignature:'4/4',totalUnits:keys.length*units,groups:[4,4,4,4],beamGroups:[4,4,4,4],
  events:keys.map((key,index)=>({key,octave:+key.split('/')[1],midi:midiFromKey(key),rest:false,
   duration:units===4?'q':units===2?'8':'16',dots:0,startUnits:index*units,durationUnits:units}))};
}
const phrases=[{startBar:0,endBar:1,role:'opening'},{startBar:2,endBar:3,role:'closing'}];
const changes=rows=>rows.flat().filter((clef,i,all)=>i&&clef!==all[i-1]).length;

test('one phrase retains its clef through brief low passing notes without exchanging clef chatter for octave signs',()=>{
 const keys=Array(16).fill('g/4');keys[3]='c/3';keys[10]='d/3';keys[14]='e/3';
 const measures=[bar(keys,1),bar(['e/4','g/4','b/4','g/4'])],before=plain(measures);
 const plan=planMixedStaff(measures,'treble','4/4',undefined,[{startBar:0,endBar:1}]);
 assert.ok(plan.clefs.flat().every(clef=>clef==='treble'));
 assert.ok(plan.shifts.flat().every(shift=>shift===0));
 assert.deepEqual(plain(measures),before);
});

test('whole-phrase planning introduces the new register at the actual phrase entrance, not midway through it',()=>{
 const measures=[bar(['g/3','b/3','d/4','g/3']),bar(['g/3','b/3','d/4','g/3']),
  bar(['e/4','g/4','b/4','g/4']),bar(['e/4','g/4','b/4','g/4'])];
 const plan=planMixedStaff(measures,'treble','4/4',undefined,phrases);
 assert.deepEqual(plain(plan.clefs),[Array(4).fill('bass'),Array(4).fill('bass'),Array(4).fill('treble'),Array(4).fill('treble')]);
 assert.equal(changes(plan.clefs),1);assert.ok(plan.shifts.flat().every(shift=>shift===0));
 // With no phrase metadata the same four bars form one conservative fallback
 // phrase; this confirms the real phrase plan is used, not a bar-by-bar rule.
 assert.equal(changes(planMixedStaff(measures).clefs),0);
 const exercise={staffMode:'mixed',clef:'treble',timeSignature:'4/4',phrasePlan:phrases};
 assert.deepEqual(plain(planSingleStaff(exercise,measures)),plain(plan));
 const intentOnly={...exercise,phrasePlan:undefined,musicalIntent:{phrases}};
 assert.deepEqual(plain(planSingleStaff(intentOnly,measures)),plain(plan));
});

test('subdividing notes cannot give a dense rhythm more votes than the same sounding register',()=>{
 const coarse=[bar(['e/3','g/3','b/3','g/3']),bar(['g/3','b/3','d/4','g/3']),
  bar(['e/4','g/4','b/4','g/4']),bar(['g/4','b/4','d/5','g/4'])];
 const dense=coarse.map(m=>bar(m.events.flatMap(note=>Array(4).fill(note.key)),1));
 const a=planMixedStaff(coarse,'treble','4/4',undefined,phrases),b=planMixedStaff(dense,'treble','4/4',undefined,phrases);
 assert.deepEqual(b.clefs.map(row=>Array.from(new Set(row))),a.clefs.map(row=>Array.from(new Set(row))));
 assert.equal(changes(a.clefs),1);assert.equal(changes(b.clefs),1);
});

test('opening silence defers the new phrase clef until its first sounding note',()=>{
 const measures=[bar(['e/3','g/3','b/3','g/3']),bar(['e/3','g/3','b/3','g/3']),
  bar(['e/4','e/4','e/4','g/4','b/4','g/4','e/4','g/4'],2),bar(['e/4','g/4','b/4','g/4'])];
 measures[2].events[0].rest=true;measures[2].events[1].rest=true;
 const plan=planMixedStaff(measures,'treble','4/4',undefined,phrases);
 assert.ok(plan.clefs[2].slice(0,2).every(clef=>clef==='bass'),'no instruction appears during the opening rests');
 assert.ok(plan.clefs[2].slice(2).every(clef=>clef==='treble'));
 assert.equal(changes(plan.clefs),1);
});

test('unreadable extremes still override phrase continuity, and selected clefs, music and sound remain intact',()=>{
 const measures=[bar(['a/2','c/3','e/3','a/3']),bar(['a/4','c/5','e/5','a/5'])];
 const exercise={instrument:'Sheng',soundProfile:'Pipa',clef:'treble',staffMode:'mixed',timeSignature:'4/4',keySignature:'C',tempo:80,measures,phrasePlan:[{startBar:0,endBar:1,role:'closing'}]};
 const before=plain(exercise),audio=plain(createPlaybackEvents(exercise,80));
 const plan=planSingleStaff(exercise,measures);
 assert.ok(plan.clefs[0].every(clef=>clef==='bass'));assert.ok(plan.clefs[1].every(clef=>clef==='treble'));
 measures.forEach((m,b)=>m.events.forEach((n,i)=>notePitches(n).forEach(p=>assert.ok(ledgerCount(p.key,plan.clefs[b][i],plan.shifts[b][i])<=3))));
 for(const mixedClefs of [['alto','tenor'],['bass','alto'],['treble','tenor']]){
  const custom=planSingleStaff({...exercise,mixedClefs},measures);
  assert.ok(custom.clefs.flat().every(clef=>mixedClefs.includes(clef)));
 }
 assert.deepEqual(plain(exercise),before);assert.deepEqual(plain(createPlaybackEvents(exercise,80)),audio);
 assert.deepEqual(plain(planSingleStaff({...exercise,staffMode:'fixed'},measures).clefs),measures.map(m=>Array(m.events.length).fill('treble')));
});

test('empty and silent studies remain stable without emitting octave instructions',()=>{
 assert.deepEqual(plain(planMixedStaff([bar([])])),{clefs:[[]],shifts:[[]]});
 const silent=[bar(['c/2','c/3','c/6','c/7'])];silent[0].events.forEach(note=>note.rest=true);
 const plan=planMixedStaff(silent,'bass');
 assert.ok(plan.clefs.flat().every(clef=>clef==='bass'));assert.ok(plan.shifts.flat().every(shift=>shift===0));
});
