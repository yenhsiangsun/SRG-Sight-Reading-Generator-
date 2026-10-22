import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadModule} from './helpers.mjs';

const library=loadModule('src/practice/library.ts',1,undefined,{}, {Error});
const plain=value=>JSON.parse(JSON.stringify(value));
const source=fs.readFileSync(process.env.LIBRARY_CONFLICT_BEFORE_SOURCE??'src/hooks/useLibrary.ts','utf8');
const settings={instrument:'Piano',clef:'treble',difficulty:'Beginner',rhythmLevel:'Simple',keySignature:'C',tonic:'C',scaleId:'major',timeSignature:'4/4',measureCount:4,rangeMinMidi:60,rangeMaxMidi:84,allowAccidentals:false,mixedMeters:false,meters:['4/4']};

function score(midi=60,bpm=80){
  const key=({60:'c/4',62:'d/4',64:'e/4'})[midi];
  assert.ok(key);
  const measures=Array.from({length:4},()=>({timeSignature:'4/4',totalUnits:16,groups:[4,4,4,4],events:Array.from({length:4},(_,i)=>({key,midi,octave:4,rest:false,duration:'q',dots:0,startUnits:i*4,durationUnits:4}))}));
  return {settings:plain(settings),bpm,exercise:{instrument:'Piano',soundProfile:'Piano',clef:'treble',difficulty:'beginner',rhythmLevel:'simple',keySignature:'C',tempo:bpm,timeSignature:'4/4',measures}};
}
const savedScore=(id,midi=60)=>({id,created:1,...score(midi)});
const preset=(id,bpm=80)=>({id,created:1,settings:plain(settings),bpm});
const rawLibrary=(scores=[],presets=[])=>JSON.stringify({version:1,scores,presets});

function storage(raw=null){
  let value=raw;
  return {writes:[],readError:false,writeError:false,
    get raw(){return value;},set raw(next){value=next;},
    getItem(key){assert.equal(key,library.LIBRARY_KEY);if(this.readError)throw Error('isolated read denied');return value;},
    setItem(key,next){assert.equal(key,library.LIBRARY_KEY);if(this.writeError)throw Error('isolated quota exhausted');this.writes.push(String(next));value=String(next);},
    read(){return JSON.parse(value);}};
}

// Separate hook instances model already mounted views of one persisted library.
// The root's browser check separately covers two genuine native Storage tabs.
function tab(saved,prefix){
  const values=[];let cursor=0,serial=0;
  const react={useState(initial){const index=cursor++;if(!(index in values))values[index]=typeof initial==='function'?initial():initial;return[values[index],next=>{values[index]=typeof next==='function'?next(values[index]):next;}];}};
  const {useLibrary:invokeLibraryHook}=loadModule('src/hooks/useLibrary.ts',1,source,{react,'../practice/library':library},{Error,localStorage:saved,crypto:{randomUUID:()=>`${prefix}-${++serial}`}});
  return {render(){cursor=0;return invokeLibraryHook();}};
}
const saveScore=(current,midi=60,bpm=80)=>current.save(score(midi,bpm),'scores');
const ids=(saved,kind='scores')=>saved.read()[kind].map(item=>item.id);

test('two mounted collections retain distinct sequential saves from both tabs',()=>{
  const saved=storage(),a=tab(saved,'A'),b=tab(saved,'B');
  a.render();b.render();
  assert.equal(saveScore(a.render(),60),true);assert.equal(saveScore(b.render(),62),true);
  assert.deepEqual(ids(saved),['B-1','A-1']);
  assert.equal(saveScore(a.render(),64),true);assert.deepEqual(ids(saved),['A-2','B-1','A-1']);
  assert.deepEqual(Array.from(tab(saved,'reopened').render().library.scores,item=>item.id),ids(saved));
});

test('sequential removals in stale tabs do not resurrect an already removed score',()=>{
  const saved=storage(rawLibrary([savedScore('X'),savedScore('Y',62)])),a=tab(saved,'A'),b=tab(saved,'B');
  a.render();b.render();b.render().remove('Y','scores');a.render().remove('X','scores');
  assert.deepEqual(ids(saved),[]);assert.equal(a.render().message,null);
});

test('a stale remove preserves another tab newer score and unrelated presets',()=>{
  const originalPreset=preset('kept-preset');
  const saved=storage(rawLibrary([savedScore('old')],[originalPreset])),a=tab(saved,'A'),b=tab(saved,'B');
  a.render();b.render();assert.equal(saveScore(a.render(),62),true);
  b.render().remove('old','scores');
  assert.deepEqual(ids(saved),['A-1']);assert.deepEqual(saved.read().presets,[originalPreset]);
});

test('score and preset mutations preserve both current collections across stale tabs',()=>{
  const saved=storage(),a=tab(saved,'A'),b=tab(saved,'B');a.render();b.render();
  assert.equal(a.render().save({settings:plain(settings),bpm:90},'presets'),true);
  assert.equal(saveScore(b.render(),62),true);
  assert.deepEqual(ids(saved),['B-1']);assert.deepEqual(ids(saved,'presets'),['A-1']);
  a.render().remove('A-1','presets');
  assert.deepEqual(ids(saved),['B-1']);assert.deepEqual(ids(saved,'presets'),[]);
});

test('explicit removal of the persisted key is respected instead of resurrecting mounted entries',()=>{
  for(const action of ['save','remove']){
    const saved=storage(rawLibrary([savedScore('old')])),a=tab(saved,'A');a.render();saved.raw=null;
    if(action==='save'){assert.equal(saveScore(a.render(),62),true);assert.deepEqual(ids(saved),['A-1']);}
    else{a.render().remove('old','scores');assert.deepEqual(ids(saved),[]);}
  }
});

test('duplicate detection and capacity use current persisted entries',()=>{
  const saved=storage(),a=tab(saved,'A'),b=tab(saved,'B');a.render();b.render();
  assert.equal(saveScore(a.render()),true);assert.equal(saveScore(b.render()),true);
  assert.deepEqual(ids(saved),['A-1'],'same music remains one saved study');
  const full=storage(rawLibrary([],Array.from({length:19},(_,i)=>preset(`initial-${i}`,60+i)))),c=tab(full,'C'),d=tab(full,'D');
  c.render();d.render();assert.equal(c.render().save({settings:plain(settings),bpm:79},'presets'),true);
  const complete=full.raw;
  assert.equal(d.render().save({settings:plain(settings),bpm:80},'presets'),false);
  assert.equal(d.render().message,'libraryFull');assert.equal(full.raw,complete);assert.equal(ids(full,'presets').length,20);
});

test('a quota failure retains persisted entries and retry includes intervening saves',()=>{
  const saved=storage(rawLibrary([savedScore('old')])),a=tab(saved,'A'),b=tab(saved,'B');a.render();b.render();
  assert.equal(saveScore(a.render(),62),true);const before=saved.raw;
  saved.writeError=true;assert.equal(saveScore(b.render(),64),false);
  assert.equal(b.render().message,'libraryError');assert.equal(saved.raw,before);
  assert.deepEqual(Array.from(b.render().library.scores,item=>item.id),['old'],'failed persistence does not claim a successful state update');
  saved.writeError=false;assert.equal(saveScore(b.render(),64),true);
  assert.deepEqual(ids(saved),['B-2','A-1','old']);assert.equal(b.render().message,'savedStudy');
});

test('a failed removal keeps both the visible and persisted collection, then retries against intervening saves',()=>{
  const saved=storage(rawLibrary([savedScore('old'),savedScore('kept',62)])),a=tab(saved,'A'),b=tab(saved,'B');
  a.render();b.render();const before=saved.raw;
  saved.writeError=true;a.render().remove('old','scores');
  assert.equal(saved.raw,before);assert.equal(saved.writes.length,0);assert.equal(a.render().message,'libraryError');
  assert.deepEqual(Array.from(a.render().library.scores,item=>item.id),['old','kept']);
  saved.writeError=false;assert.equal(saveScore(b.render(),64),true);
  a.render().remove('old','scores');
  assert.deepEqual(ids(saved),['B-1','kept']);assert.equal(a.render().message,null);
});

test('a removal read exception cannot write a stale snapshot and remains retryable',()=>{
  const saved=storage(rawLibrary([savedScore('old'),savedScore('kept',62)])),a=tab(saved,'A');a.render();
  const before=saved.raw;saved.readError=true;a.render().remove('old','scores');
  assert.equal(saved.raw,before);assert.equal(saved.writes.length,0);assert.equal(a.render().message,'libraryError');
  assert.deepEqual(Array.from(a.render().library.scores,item=>item.id),['old','kept']);
  saved.readError=false;a.render().remove('old','scores');assert.deepEqual(ids(saved),['kept']);assert.equal(a.render().message,null);
});

test('a transient mutation read failure cannot erase data and retries from the newest save',()=>{
  const saved=storage(rawLibrary([savedScore('old')])),a=tab(saved,'A'),b=tab(saved,'B');a.render();b.render();
  saved.readError=true;assert.equal(saveScore(b.render(),64),false);assert.equal(b.render().message,'libraryError');assert.equal(saved.writes.length,0);
  saved.readError=false;assert.equal(saveScore(a.render(),62),true);assert.equal(saveScore(b.render(),64),true);
  assert.deepEqual(ids(saved),['B-1','A-1','old']);
});

test('late unreadable data protects exact raw through either stale action and remains sticky',()=>{
  const invalid=score();invalid.exercise.measures[0].events[0].durationUnits=99;
  for(const raw of ['{unreadable',rawLibrary([savedScore('kept'),{id:'bad',created:1,...invalid}])]){
    for(const action of ['save','remove']){
      const saved=storage(rawLibrary([savedScore('old')])),a=tab(saved,'A');a.render();saved.raw=raw;
      if(action==='save')assert.equal(saveScore(a.render(),62),false);else a.render().remove('old','scores');
      assert.equal(saved.raw,raw);assert.equal(saved.writes.length,0);assert.equal(a.render().message,'libraryReadProtected');
      saved.raw=rawLibrary([savedScore('externally-valid')]);const repaired=saved.raw;
      assert.equal(saveScore(a.render(),64),false);assert.equal(saved.raw,repaired);assert.equal(saved.writes.length,0);
    }
  }
});

test('an initial read failure stays protected when later reads recover',()=>{
  const saved=storage(rawLibrary([savedScore('kept')]));saved.readError=true;
  const a=tab(saved,'A');assert.equal(a.render().message,'libraryReadUnavailable');
  saved.readError=false;const raw=saved.raw;
  assert.equal(saveScore(a.render(),62),false);a.render().remove('kept','scores');
  assert.equal(saved.raw,raw);assert.equal(saved.writes.length,0);assert.equal(a.render().message,'libraryReadUnavailable');
});
