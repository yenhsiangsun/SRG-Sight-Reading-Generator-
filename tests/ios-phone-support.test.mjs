import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadModule} from './helpers.mjs';

test('iOS app targets include both phone and tablet in Debug and Release',()=>{
  const project=fs.readFileSync('ios/App/App.xcodeproj/project.pbxproj','utf8');
  const configurations=[...project.matchAll(/buildSettings = \{([\s\S]*?)\n\s*\};\n\s*name = (Debug|Release);/g)]
    .filter(([,settings])=>settings.includes('INFOPLIST_FILE = App/Info.plist;'));
  assert.deepEqual(configurations.map(([, ,name])=>name).sort(),['Debug','Release']);
  for(const [,settings,name] of configurations) {
    const family=settings.match(/TARGETED_DEVICE_FAMILY = "?([^";]+)"?;/)?.[1];
    assert.deepEqual(family?.split(',').map(value=>Number(value.trim())).sort(),[1,2],name);
  }
});

test('universal iOS support retains phone rotation, every iPad orientation and microphone consent',()=>{
  const plist=fs.readFileSync('ios/App/App/Info.plist','utf8');
  const values=key=>[...plist.match(new RegExp(`<key>${key}</key>\\s*<array>([\\s\\S]*?)</array>`))[1]
    .matchAll(/<string>([^<]+)<\/string>/g)].map(([,value])=>value);
  assert.deepEqual(values('UISupportedInterfaceOrientations'),[
    'UIInterfaceOrientationPortrait','UIInterfaceOrientationLandscapeLeft','UIInterfaceOrientationLandscapeRight',
  ]);
  assert.deepEqual(values('UISupportedInterfaceOrientations~ipad'),[
    'UIInterfaceOrientationPortrait','UIInterfaceOrientationPortraitUpsideDown','UIInterfaceOrientationLandscapeLeft','UIInterfaceOrientationLandscapeRight',
  ]);
  assert.match(plist,/<key>NSMicrophoneUsageDescription<\/key>\s*<string>[^<]+<\/string>/);
});

function harness(phone) {
  let states=[],cursor=0;
  const react={useState(initial){const index=cursor++;if(!(index in states))states[index]=initial;
    return [states[index],next=>{states[index]=typeof next==='function'?next(states[index]):next;}];}};
  const hook=loadModule('src/hooks/useExercise.ts',326,undefined,{react},{window:{matchMedia:()=>({matches:phone})}});
  return {settings:hook.DEFAULT_SETTINGS,render:()=>{cursor=0;return hook.useExercise();}};
}

test('phone generation retains the eight-measure limit and tablet lengths, including both grand-staff modes',()=>{
  for(const measureCount of [4,8,12,16])for(const [instrument,clef] of [['Sheng','treble'],['Sheng','grand'],['Piano','grand']]) {
    const phone=harness(true),tablet=harness(false);
    const settings={...phone.settings,instrument,clef,measureCount,rangeMinMidi:48,rangeMaxMidi:84,
      difficulty:'Intermediate',rhythmLevel:'Moderate',mixedMeters:true,meters:['4/4','6/8']};
    for(const device of [phone,tablet]) {
      assert.equal(device.render().generateFrom(settings,80,80),80);
      const current=device.render().current;
      const expected=device===phone?Math.min(measureCount,8):measureCount;
      assert.equal(current.settings.measureCount,expected);
      assert.equal(current.exercise.measures.length,expected);
      if(clef==='grand')assert.equal(current.exercise.lowerMeasures.length,expected);
    }
    if(measureCount<=8)assert.equal(JSON.stringify(phone.render().current.exercise),JSON.stringify(tablet.render().current.exercise),
      'within the existing phone length limit, pitches, rhythms, harmonies and expression stay identical');
  }
});
