import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

const {tipsForScore, generalTips} = loadModule('src/progress/companionTips.ts');

test('companion cues follow actual meters and both staves without changing score data', () => {
  const quarter = {rest:false, duration:'q'};
  const simple = {timeSignature:'4/4', measures:[{events:[quarter]}]};
  const simpleTips = Array.from(tipsForScore(simple));
  assert.deepEqual(simpleTips, Array.from(generalTips));
  const mixed = {
    timeSignature:'4/4',
    measures:[{events:[quarter]}, {timeSignature:'6/8',events:[quarter]}, {events:[quarter]}],
    lowerMeasures:[{events:[{rest:true,duration:'q'}, {rest:false,duration:'16'}]}],
  };
  const before = JSON.stringify(mixed);
  const tips = Array.from(tipsForScore(mixed));
  for (const key of ['tipMixed','tipEighth','tipGrand','tipRest','tipSubdivision']) assert.ok(tips.includes(key),key);
  assert.equal(JSON.stringify(mixed), before);
  assert.equal(new Set(tips).size, tips.length);
  assert.ok(!tipsForScore({timeSignature:'6/8',measures:[{events:[]},{events:[]}]}).includes('tipMixed'));
  assert.ok(!tipsForScore({timeSignature:'4/4',measures:[{events:[{rest:true,duration:'16'}]}]}).includes('tipSubdivision'));
});
