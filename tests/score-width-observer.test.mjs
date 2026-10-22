import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

function harness(width=800){
  let notify,disconnected=false,serial=0;const pending=new Map(),cancelled=[],draws=[];
  const container={clientWidth:width};
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
