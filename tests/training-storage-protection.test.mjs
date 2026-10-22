import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadModule} from './helpers.mjs';

const training=loadModule('src/practice/training.ts');
const source=fs.readFileSync(process.env.TRAINING_STORAGE_BEFORE_SOURCE??'src/hooks/useTraining.ts','utf8');
const settings={instrument:'Piano',clef:'treble',difficulty:'Beginner',rhythmLevel:'Simple',keySignature:'C',tonic:'C',scaleId:'major',timeSignature:'4/4',measureCount:4,rangeMinMidi:60,rangeMaxMidi:84,allowAccidentals:false,mixedMeters:false,meters:['4/4']};
const exercise={timeSignature:'4/4',measures:[{timeSignature:'4/4'}]};
const result={reliable:true,confidence:95,completion:100,pitch:92,rhythm:94,clipped:false};
const original=JSON.stringify([{id:'previous-assessment',at:1,instrument:'Piano',difficulty:'Beginner',rhythmLevel:'Simple',quarterBpm:80,pitch:90,rhythm:90,completion:100,context:training.trainingContext(settings)}]);

function storage(raw=original){
  let value=raw;
  return {readError:false,writeError:false,writes:[],get raw(){return value;},set raw(next){value=next;},
    getItem(key){assert.equal(key,training.TRAINING_KEY);if(this.readError)throw Error('isolated read denied');return value;},
    setItem(key,next){assert.equal(key,training.TRAINING_KEY);if(this.writeError)throw Error('isolated quota full');this.writes.push(String(next));value=String(next);}};
}

// Explicit hook/storage substitutes: this tests source-level failure handling,
// not React scheduling, browser storage policies, microphone grading or iOS.
function harness(saved){
  const slots=[];let cursor=0,dirty=false;
  const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
  const react={
    useState(initial){const i=cursor++;if(!(i in slots))slots[i]={value:typeof initial==='function'?initial():initial};return[slots[i].value,next=>{const value=typeof next==='function'?next(slots[i].value):next;if(!Object.is(value,slots[i].value)){slots[i].value=value;dirty=true;}}];},
    useRef(initial){const i=cursor++;if(!(i in slots))slots[i]={current:initial};return slots[i];},
    useCallback(fn,deps){const i=cursor++;if(!(i in slots)||!same(slots[i].deps,deps))slots[i]={value:fn,deps};return slots[i].value;},
  };
  const {useTraining:invokeTrainingHook}=loadModule('src/hooks/useTraining.ts',1,source,{react,'../practice/training':training},{localStorage:saved});
  return {render(){let value,turns=0;do{assert.ok(turns++<10);cursor=0;dirty=false;value=invokeTrainingHook();}while(dirty);return value;}};
}
const record=(view,id)=>view.record(id,exercise,settings,80,result,2);

// Fixed-input backend: no access counters, callbacks or scheduler hooks. Each
// external replacement happens explicitly between rendering and recording.
function fixedStorage(raw=original){
  let value=raw;
  return {readError:false,writeError:false,get raw(){return value;},set raw(next){value=next;},
    getItem(key){assert.equal(key,training.TRAINING_KEY);if(this.readError)throw Error('isolated read denied');return value;},
    setItem(key,next){assert.equal(key,training.TRAINING_KEY);if(this.writeError)throw Error('isolated quota full');value=String(next);}};
}
const external=JSON.stringify([{...JSON.parse(original)[0],id:'external-assessment',at:3}]);
const ids=current=>Array.from(current.history,a=>a.id);

test('an initial training read exception cannot overwrite history after access recovers; a fresh mount can save',()=>{
  const saved=storage();saved.readError=true;
  const h=harness(saved);let current=h.render();
  saved.readError=false;record(current,'temporary-result');current=h.render();
  assert.equal(saved.raw,original,'unknown saved history must remain byte-exact for this mount');
  assert.equal(saved.writes.length,0);
  assert.deepEqual(Array.from(current.history,a=>a.id),['temporary-result'],'current-session advice can still use the in-memory result');
  assert.equal(current.storageWarning,true);
  const fresh=harness(saved);current=fresh.render();
  assert.deepEqual(Array.from(current.history,a=>a.id),['previous-assessment']);assert.equal(current.storageWarning,false);
  record(current,'fresh-result');current=fresh.render();
  assert.deepEqual(JSON.parse(saved.raw).map(a=>a.id),['previous-assessment','fresh-result']);assert.equal(current.storageWarning,false);
});

test('a training write failure preserves the old save and current-session results can be persisted on recovery',()=>{
  const saved=storage(),h=harness(saved);let current=h.render();saved.writeError=true;
  record(current,'pending-result');current=h.render();
  assert.equal(saved.raw,original);assert.equal(saved.writes.length,0);assert.equal(current.storageWarning,true);
  assert.deepEqual(Array.from(current.history,a=>a.id),['previous-assessment','pending-result']);
  saved.writeError=false;record(current,'next-result');current=h.render();
  assert.deepEqual(JSON.parse(saved.raw).map(a=>a.id),['previous-assessment','pending-result','next-result']);assert.equal(current.storageWarning,false);
});

test('a truly missing training key allows saving without duplicate attempts or unrelated writes',()=>{
  const saved=storage(null),h=harness(saved);let current=h.render();
  assert.equal(current.storageWarning,false);assert.equal(current.history.length,0);
  record(current,'first-result');current=h.render();record(current,'first-result');current=h.render();
  assert.equal(saved.writes.length,1);assert.deepEqual(JSON.parse(saved.raw).map(a=>a.id),['first-result']);assert.equal(current.storageWarning,false);
});

test('malformed or unsupported training saves stay untouched while current-session results remain usable',()=>{
  for(const raw of ['{broken','', 'null','{}','"training"','{"version":2,"attempts":[{"id":"keep"}]}']){
    const saved=storage(raw),h=harness(saved);let current=h.render();
    assert.equal(current.storageWarning,true,raw);
    record(current,'temporary-result');current=h.render();
    assert.equal(saved.raw,raw);assert.equal(saved.writes.length,0);
    assert.deepEqual(Array.from(current.history,a=>a.id),['temporary-result']);
    assert.equal(current.storageWarning,true);
  }
});

test('partially unreadable training history still exposes valid attempts without discarding the original save',()=>{
  const raw=JSON.stringify([...JSON.parse(original),{id:'future-or-damaged-attempt',pitch:500}]);
  const saved=storage(raw),h=harness(saved);let current=h.render();
  assert.deepEqual(Array.from(current.history,a=>a.id),['previous-assessment']);
  assert.equal(current.storageWarning,true);
  record(current,'temporary-result');current=h.render();
  assert.deepEqual(Array.from(current.history,a=>a.id),['previous-assessment','temporary-result']);
  assert.equal(saved.raw,raw);assert.equal(saved.writes.length,0);assert.equal(current.storageWarning,true);
});

test('training read protection is lifted by a fresh valid mount, without rewriting a repaired save from stale memory',()=>{
  const saved=storage('{broken'),h=harness(saved);let current=h.render();
  saved.raw=original;
  record(current,'temporary-result');current=h.render();
  assert.equal(current.storageWarning,true);assert.equal(saved.raw,original);assert.equal(saved.writes.length,0);
  const fresh=harness(saved);current=fresh.render();
  assert.equal(current.storageWarning,false);assert.deepEqual(Array.from(current.history,a=>a.id),['previous-assessment']);
  record(current,'fresh-result');current=fresh.render();
  assert.equal(current.storageWarning,false);assert.deepEqual(JSON.parse(saved.raw).map(a=>a.id),['previous-assessment','fresh-result']);
});

test('valid empty arrays and the established training retention limit continue to save normally',()=>{
  const previous=JSON.parse(original)[0];
  for(const raw of ['[]',JSON.stringify(Array.from({length:101},(_,i)=>({...previous,id:`kept-${i}`})))]){
    const saved=storage(raw),h=harness(saved);let current=h.render();
    assert.equal(current.storageWarning,false);assert.equal(current.history.length,raw==='[]'?0:100);
    record(current,'new-result');current=h.render();
    assert.equal(current.storageWarning,false);assert.equal(saved.writes.length,1);
    const persisted=JSON.parse(saved.raw);
    assert.equal(persisted.length,raw==='[]'?1:100);assert.equal(persisted.at(-1).id,'new-result');
    if(raw!=='[]')assert.equal(persisted[0].id,'kept-2');
  }
});

test('fixed external training replacements remain byte-exact when an older mounted history records again',()=>{
  const replacements=[external,'{broken','', 'null','{}','{"version":2,"attempts":[]}',
    JSON.stringify([...JSON.parse(original),{id:'future-or-damaged',pitch:500}]),null,
    JSON.stringify(JSON.parse(original),null,2)];
  for(const raw of replacements){
    const saved=fixedStorage(),h=harness(saved);let current=h.render();
    saved.raw=raw;record(current,'local-assessment');current=h.render();
    assert.equal(saved.raw,raw,'a changed raw snapshot must survive even if it is valid, missing or only reformatted');
    assert.deepEqual(ids(current),['previous-assessment','local-assessment']);
    assert.equal(current.storageWarning,true);assert.equal(current.storageConflict,true);
  }
});

test('a fixed missing initial snapshot cannot overwrite a newly created external training save',()=>{
  const saved=fixedStorage(null),h=harness(saved);let current=h.render();
  saved.raw=external;record(current,'local-assessment');current=h.render();
  assert.equal(saved.raw,external);assert.deepEqual(ids(current),['local-assessment']);
  assert.equal(current.storageWarning,true);assert.equal(current.storageConflict,true);
});

test('fixed unchanged snapshots allow consecutive training saves, including a truly missing initial key',()=>{
  for(const raw of [original,null]){
    const saved=fixedStorage(raw),h=harness(saved);let current=h.render();
    record(current,'first-local');current=h.render();
    record(current,'second-local');current=h.render();
    assert.deepEqual(JSON.parse(saved.raw).map(a=>a.id),raw===null?['first-local','second-local']:['previous-assessment','first-local','second-local']);
    assert.equal(current.storageWarning,false);
  }
});

test('a fixed reread failure keeps pending training in memory and retries a later distinct result after recovery',()=>{
  const saved=fixedStorage(),h=harness(saved);let current=h.render();
  saved.readError=true;record(current,'pending-result');current=h.render();
  assert.equal(saved.raw,original);assert.deepEqual(ids(current),['previous-assessment','pending-result']);
  assert.equal(current.storageWarning,true);assert.equal(current.storageConflict,false);
  saved.readError=false;record(current,'recovered-result');current=h.render();
  assert.deepEqual(JSON.parse(saved.raw).map(a=>a.id),['previous-assessment','pending-result','recovered-result']);
  assert.equal(current.storageWarning,false);assert.equal(current.storageConflict,false);
});

test('a fixed failed write does not advance the expected snapshot or overwrite a subsequent external save',()=>{
  const saved=fixedStorage(),h=harness(saved);let current=h.render();
  saved.writeError=true;record(current,'pending-result');current=h.render();
  assert.equal(saved.raw,original);assert.equal(current.storageWarning,true);
  saved.writeError=false;saved.raw=external;record(current,'blocked-result');current=h.render();
  assert.equal(saved.raw,external);assert.equal(current.storageWarning,true);assert.equal(current.storageConflict,true);
  saved.raw=original;record(current,'retry-result');current=h.render();
  assert.deepEqual(JSON.parse(saved.raw).map(a=>a.id),['previous-assessment','pending-result','blocked-result','retry-result']);
  assert.equal(current.storageWarning,false);assert.equal(current.storageConflict,false);
});

test('a fixed training conflict persists across distinct changes but exact snapshot restoration permits a later save',()=>{
  const saved=fixedStorage(),h=harness(saved);let current=h.render();
  saved.raw=external;record(current,'blocked-first');current=h.render();
  assert.equal(saved.raw,external);
  saved.raw='[]';record(current,'blocked-second');current=h.render();
  assert.equal(saved.raw,'[]');assert.equal(current.storageConflict,true);
  saved.raw=original;record(current,'accepted-third');current=h.render();
  assert.deepEqual(JSON.parse(saved.raw).map(a=>a.id),['previous-assessment','blocked-first','blocked-second','accepted-third']);
  assert.equal(current.storageWarning,false);assert.equal(current.storageConflict,false);
});

test('a fixed duplicate never flushes pending training or clears a conflict after the original snapshot returns',()=>{
  const saved=fixedStorage(),h=harness(saved);let current=h.render();
  saved.raw=external;record(current,'pending-result');current=h.render();
  assert.equal(saved.raw,external);assert.equal(current.storageConflict,true);
  saved.raw=original;record(current,'pending-result');current=h.render();
  assert.equal(saved.raw,original);assert.deepEqual(ids(current),['previous-assessment','pending-result']);
  assert.equal(current.storageWarning,true);assert.equal(current.storageConflict,true);
});

test('a fresh training mount uses a valid external replacement rather than the older in-memory history',()=>{
  const saved=fixedStorage(),old=harness(saved);let current=old.render();
  saved.raw=external;record(current,'old-pending');current=old.render();
  assert.equal(saved.raw,external);
  const fresh=harness(saved);current=fresh.render();
  assert.deepEqual(ids(current),['external-assessment']);assert.equal(current.storageWarning,false);
  record(current,'fresh-result');current=fresh.render();
  assert.deepEqual(JSON.parse(saved.raw).map(a=>a.id),['external-assessment','fresh-result']);
  assert.equal(current.storageWarning,false);assert.equal(current.storageConflict,false);
});

test('supplemental access trace confirms duplicate training attempts do not reread, write or retry a failed save',()=>{
  const trace=[],saved=fixedStorage(),get=saved.getItem.bind(saved),set=saved.setItem.bind(saved);
  saved.getItem=key=>{trace.push('get');return get(key);};
  saved.setItem=(key,value)=>{trace.push('set');return set(key,value);};
  const h=harness(saved);let current=h.render();saved.writeError=true;
  record(current,'pending-result');current=h.render();
  const before=trace.slice();saved.writeError=false;record(current,'pending-result');current=h.render();
  assert.deepEqual(trace,before);assert.equal(saved.raw,original);assert.equal(current.storageWarning,true);
});
