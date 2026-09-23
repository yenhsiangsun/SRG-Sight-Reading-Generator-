import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

const {companionGeometry, normalizeCompanionPosition} = loadModule('src/progress/companionPosition.ts');

test('floating companion and speech bubble stay inside portrait, landscape and zoomed viewports', () => {
  for (const [width, height, left, top] of [[390,844,0,0],[844,390,0,0],[1360,900,0,0],[320,568,0,0],[300,300,50,75]]) {
    for (const x of [0,.2,.5,.8,1]) for (const y of [0,.2,.5,.8,1]) {
      const g = companionGeometry({width,height,left,top},{x,y});
      assert.ok(g.left >= left && g.left + g.width <= left + width);
      assert.ok(g.top >= top && g.top + g.height <= top + height);
      const bx = g.left + g.bubbleLeft;
      assert.ok(bx >= left && bx + g.bubbleWidth <= left + width);
      if (g.above) assert.ok(g.top - 8 - g.bubbleHeight >= top);
      else assert.ok(g.top + g.height + 8 + g.bubbleHeight <= top + height);
    }
  }
  for (const raw of [null,{}, {x:NaN,y:.5}, {x:Infinity,y:0}, {x:'1',y:0}]) {
    const restored = normalizeCompanionPosition(raw);
    assert.ok(Number.isFinite(restored.x) && Number.isFinite(restored.y));
  }
  assert.deepEqual({...normalizeCompanionPosition({x:-10,y:20})},{x:0,y:1});
});
