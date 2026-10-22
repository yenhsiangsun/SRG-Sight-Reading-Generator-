import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

const {searchLibrary}=loadModule('src/practice/librarySearch.ts');
const {translate,localeOrder}=loadModule('src/i18n/messages.ts');
const {instrumentLabel}=loadModule('src/i18n/musicLabels.ts');
const settings={instrument:'Piano',clef:'grand',difficulty:'Beginner',rhythmLevel:'Simple',keySignature:'D',tonic:'C#',scaleId:'locrian',timeSignature:'4/4',measureCount:8,rangeMinMidi:48,rangeMaxMidi:84,allowAccidentals:false,mixedMeters:false,meters:['4/4','6/8']};
const saved={id:'saved',created:1,bpm:124,settings,exercise:{timeSignature:'4/4',tonality:{tonic:'C#',scaleId:'locrian'},measures:[]}};

test('saved study search matches musical identity and combined Unicode keywords without mutating order or objects',()=>{
  const other={...saved,id:'other',bpm:72,settings:{...settings,instrument:'Flute'},exercise:{...saved.exercise,tonality:{tonic:'C',scaleId:'major'}}};
  const studies=[other,saved],before=JSON.stringify(studies);
  assert.equal(searchLibrary(studies,'  ','en'),studies);
  for(const query of ['ＰＩＡＮＯ　C♯','piano locrian 124','4/4 beginner simple','洛克里安']){
    const result=searchLibrary(studies,query,query==='洛克里安'?'zh-TW':'en');
    assert.ok(result.includes(saved),query);
  }
  assert.deepEqual(Array.from(searchLibrary(studies,'flute locrian','en')),[]);
  assert.equal(searchLibrary(studies,'locrian','en')[0],saved);
  assert.equal(JSON.stringify(studies),before);
});

test('presets do not invent a generated mode; mixed selected clefs and local instrument labels remain searchable',()=>{
  const preset={...saved,exercise:undefined,settings:{...settings,clef:'mixedStaff',mixedClefs:['alto','tenor']}};
  assert.equal(searchLibrary([preset],'locrian','en').length,0);
  assert.equal(searchLibrary([preset],'alto tenor','en')[0],preset);
  assert.equal(searchLibrary([preset],'bass','en').length,0);
  for(const locale of localeOrder){
    assert.equal(searchLibrary([preset],instrumentLabel('Piano',locale),locale)[0],preset,locale);
    for(const key of ['searchLibrary','librarySearchHint','librarySearchResults','librarySearchEmpty']){
      assert.equal(typeof translate(locale,key),'string',locale+' '+key);
      assert.ok(translate(locale,key).length>0);
    }
    assert.match(translate(locale,'librarySearchResults'),/\{count\}/);
    assert.match(translate(locale,'librarySearchResults'),/\{total\}/);
  }
});
