import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

function harness(width=800,fonts){
  let notify,disconnected=false,serial=0;const pending=new Map(),cancelled=[],draws=[];
  const container={clientWidth:width,...(fonts?{ownerDocument:{fonts}}:{})};
  const {observeScoreWidth}=loadModule('src/notation/observeScoreWidth.ts',1,undefined,{}, {
    ResizeObserver:class{constructor(callback){notify=callback;}observe(target){assert.equal(target,container);}disconnect(){disconnected=true;}},
    requestAnimationFrame(callback){const id=serial++;pending.set(id,callback);return id;},
    cancelAnimationFrame(id){cancelled.push(id);pending.delete(id);},
  });
  const cleanup=observeScoreWidth(container,width=>draws.push(width));
  return {container,draws,pending,cancelled,cleanup,notify:()=>notify(),disconnected:()=>disconnected,
    flush(){const callbacks=[...pending.values()];pending.clear();for(const callback of callbacks)callback();}};
}

test('engraving never mutates its SVG during ResizeObserver delivery and bursts use the latest stable width',()=>{
  const h=harness();assert.deepEqual(h.draws,[800]);
  h.notify();assert.equal(h.pending.size,0,'height-only notification must not re-engrave');
  h.container.clientWidth=760;h.notify();h.container.clientWidth=720;h.notify();h.notify();
  assert.deepEqual(h.draws,[800],'do not redraw synchronously inside resize delivery');
  assert.equal(h.pending.size,1);h.flush();assert.deepEqual(h.draws,[800,720]);
  h.notify();assert.equal(h.pending.size,0);
});

test('a transient width change returning to its original value avoids an unnecessary score replacement',()=>{
  const h=harness();h.container.clientWidth=815;h.notify();h.container.clientWidth=800;h.flush();
  assert.deepEqual(h.draws,[800]);h.cleanup();assert.ok(h.disconnected());
});

test('hidden score containers wait for a real width and stale frames cannot overwrite a replacement score',()=>{
  const h=harness(0);h.notify();assert.equal(h.pending.size,0);assert.deepEqual(h.draws,[]);
  h.container.clientWidth=390;h.notify();const stale=[...h.pending.values()][0];
  h.cleanup();assert.ok(h.disconnected());assert.equal(h.cancelled.length,1);
  stale();assert.deepEqual(h.draws,[],'a late frame after unmount must not draw the old exercise');
});

test('first engraving waits for both music fonts and uses the latest width without a resize or stale score flash',async()=>{
  const waiting=[],requests=[],fonts={check:()=>false,load(name){requests.push(name);return new Promise(resolve=>waiting.push(resolve));}};
  const h=harness(800,fonts);assert.deepEqual(h.draws,[]);assert.deepEqual(requests,['40px Bravura','16px Academico']);
  h.container.clientWidth=620;h.notify();h.flush();assert.deepEqual(h.draws,[]);
  waiting[0]();await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(h.draws,[]);
  waiting[1]();await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(h.draws,[620]);
  h.notify();assert.equal(h.pending.size,0);
});

test('font completion after cleanup cannot replace a different score, and loaded fonts keep synchronous drawing',async()=>{
  const waiting=[];
  const h=harness(800,{check:()=>false,load:()=>new Promise(resolve=>waiting.push(resolve))});
  h.cleanup();waiting.forEach(resolve=>resolve());await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(h.draws,[]);
  const loaded=harness(800,{check:()=>true,load(){throw Error('loaded fonts must not reload');}});assert.deepEqual(loaded.draws,[800]);
});

test('failed font loading retains the existing fallback score instead of leaving a blank page',async()=>{
  const h=harness(800,{check:()=>false,load:()=>Promise.reject(Error('font unavailable'))});
  await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(h.draws,[800]);
});
