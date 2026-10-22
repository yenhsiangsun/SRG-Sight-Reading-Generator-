import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

const KEY='sight-reading-microphone-calibration-v1';
const value=(routeKey,offsetMs=80)=>({version:1,offsetMs,spreadMs:8,measuredAt:'2026-10-19',...(routeKey?{routeKey,outputRoute:'speakers'}:{})});
const envelope=(entries,lastRoute=Object.keys(entries).at(-1))=>JSON.stringify({version:2,lastRoute,entries});
const original=envelope({a1:value('a1',40),b2:value('b2',120)});

// In-memory Storage substitute only: no browser, microphone, device or permission.
function store(raw=original){
  let saved=raw;
  const storage={readError:false,writeError:false,writes:[],get raw(){return saved;},
    getItem(key){assert.equal(key,KEY);if(this.readError)throw Error('isolated read denied');return saved;},
    setItem(key,next){assert.equal(key,KEY);if(this.writeError)throw Error('isolated quota exceeded');this.writes.push(next);saved=next;}};
  return {storage,...loadModule('src/assessment/calibration.ts',1,undefined,{}, {localStorage:storage})};
}

test('calibration read exceptions preserve all saved routes and a later retry succeeds without remounting',()=>{
  const api=store();api.storage.readError=true;
  assert.equal(api.loadCalibration('a1'),null);
  assert.equal(api.saveCalibration(value('c3')),false);
  assert.equal(api.storage.raw,original);assert.equal(api.storage.writes.length,0);
  api.storage.readError=false;
  assert.equal(api.saveCalibration(value('c3')),true);
  assert.equal(api.loadCalibration('a1').offsetMs,40);assert.equal(api.loadCalibration('b2').offsetMs,120);
  assert.equal(api.loadCalibration('c3').offsetMs,80);assert.equal(api.storage.writes.length,1);
});

test('malformed or unsupported calibration saves cannot be replaced by either routed or legacy saves',()=>{
  for(const raw of ['', '{broken','null','[]','{}','"calibration"','{"version":9,"entries":{"a1":{"future":"keep"}}}',
    JSON.stringify({version:2,lastRoute:'a1',entries:[value('a1')]}),
    JSON.stringify({version:2,lastRoute:'missing',entries:{a1:value('a1')}}),
    JSON.stringify({version:2,lastRoute:'a1',entries:{a1:value('b2')}})]){
    const api=store(raw);
    assert.equal(api.saveCalibration(value('c3')),false,raw);
    assert.equal(api.saveCalibration(value()),false,raw);
    assert.equal(api.storage.raw,raw);assert.equal(api.storage.writes.length,0);
  }
});

test('readable calibration routes remain available when a different entry prevents safe persistence',()=>{
  const raw=envelope({a1:value('a1',40),b2:{...value('b2'),offsetMs:900}},'a1'),api=store(raw);
  assert.equal(api.loadCalibration('a1').offsetMs,40);assert.equal(api.loadCalibration('b2'),null);
  assert.equal(api.saveCalibration(value('c3')),false);
  assert.equal(api.storage.raw,raw);assert.equal(api.storage.writes.length,0);
});

test('calibration write failures report failure, retain old routes and allow a normal retry',()=>{
  const api=store();api.storage.writeError=true;
  assert.equal(api.saveCalibration(value('c3')),false);assert.equal(api.storage.raw,original);
  assert.equal(api.loadCalibration('b2').offsetMs,120);
  api.storage.writeError=false;
  assert.equal(api.saveCalibration(value('c3')),true);assert.equal(api.storage.writes.length,1);
  assert.equal(api.loadCalibration('a1').offsetMs,40);assert.equal(api.loadCalibration('c3').offsetMs,80);
});

test('missing calibration saves and valid anonymous legacy recalibration retain their supported behavior',()=>{
  const api=store(null);
  assert.equal(api.saveCalibration(value()),true);assert.equal(api.loadCalibration().offsetMs,80);
  assert.equal(api.saveCalibration(value(undefined,100)),true);assert.equal(api.loadCalibration().offsetMs,100);
  // An anonymous legacy value cannot identify a prior route. Explicit new
  // calibration keeps the existing anonymous-to-routed replacement policy.
  assert.equal(api.saveCalibration(value('a1',60)),true);
  assert.equal(api.loadCalibration('a1').offsetMs,60);assert.equal(JSON.parse(api.storage.raw).version,2);
});

test('a supported routed legacy calibration is preserved when another route is added',()=>{
  const api=store(JSON.stringify(value('a1',40)));
  assert.equal(api.saveCalibration(value('b2',120)),true);
  assert.equal(api.loadCalibration('a1').offsetMs,40);assert.equal(api.loadCalibration('b2').offsetMs,120);
});

test('a legacy caller cannot erase a routed save and normal routed saves remain writable afterwards',()=>{
  for(const raw of [original,JSON.stringify(value('a1',40))]){
    const api=store(raw);
    assert.equal(api.saveCalibration(value()),false);assert.equal(api.storage.raw,raw);assert.equal(api.storage.writes.length,0);
    assert.equal(api.saveCalibration(value('b2',150)),true);
    assert.equal(api.loadCalibration('a1').offsetMs,40);assert.equal(api.loadCalibration('b2').offsetMs,150);
  }
});

test('updating a calibration at the existing twelve-route limit does not evict another saved route',()=>{
  const entries=Object.fromEntries(Array.from({length:12},(_,i)=>[`a${i.toString(16)}`,value(`a${i.toString(16)}`,i*10)]));
  const api=store(envelope(entries));
  assert.equal(api.saveCalibration(value('ab',200)),true);
  assert.equal(Object.keys(JSON.parse(api.storage.raw).entries).length,12);
  for(const key of Object.keys(entries))assert.equal(api.loadCalibration(key).offsetMs,key==='ab'?200:entries[key].offsetMs);
  assert.equal(api.saveCalibration(value('ff',220)),true);
  assert.equal(Object.keys(JSON.parse(api.storage.raw).entries).length,12);
  assert.equal(api.loadCalibration('ff').offsetMs,220);
});
