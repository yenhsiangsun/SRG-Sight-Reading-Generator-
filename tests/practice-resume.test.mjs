import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

const {createResumeStore,readLastPractice,resumeBar,LAST_PRACTICE_KEY}=loadModule('src/practice/resume.ts');
const {generatePracticeExercise}=loadModule('src/music.ts',843);
const {validStudy}=loadModule('src/practice/library.ts');
const {measureTimeline}=loadModule('src/audio/tempo.ts');
const {resumeCopy}=loadModule('src/i18n/resumeCopy.ts');
const plain=x=>JSON.parse(JSON.stringify(x));
function fixture() {
  const settings={instrument:'Sheng',clef:'treble',difficulty:'Advanced',keySignature:'C',tonic:'C',scaleId:'major',timeSignature:'4/4',rhythmLevel:'Moderate',measureCount:4,rangeMinMidi:55,rangeMaxMidi:90,allowAccidentals:false,mixedMeters:true,meters:['4/4','6/8']};
  const exercise=generatePracticeExercise({instrument:'Sheng',clef:'treble',difficulty:'advanced',keySignature:'C',tonic:'C',scaleId:'major',timeSignature:'4/4',rhythmLevel:'medium',measures:4,tempo:80,range:{min:55,max:90},allowAccidentals:false,mixedMeters:true,meters:['4/4','6/8']});
  exercise.soundProfile='Sheng';
  return {version:1,study:{id:'persistent-practice-123',created:1000,bpm:80,settings,exercise},position:7.25};
}

test('an unsaved mixed-meter score resumes exact notes, settings, tempo, position and completion identity after reload',()=>{
  const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
  const first=createResumeStore(()=>storage),snapshot=fixture();
  assert.equal(validStudy(snapshot.study,true),true);
  assert.equal(first.write(snapshot),true);
  const reloaded=createResumeStore(()=>storage).read();
  assert.deepEqual(plain(reloaded),plain(snapshot));
  assert.equal(resumeBar(reloaded),3);
  assert.deepEqual([...values.keys()],[LAST_PRACTICE_KEY],'automatic resume never mutates library or rewards');
  const next={...snapshot,position:0};
  assert.equal(first.write(next),true);
  assert.equal(createResumeStore(()=>storage).read().position,0,'intentional Stop returns to the score beginning');
});

test('resume validates stored scores and clamps playheads to the true mixed-meter duration',()=>{
  const snapshot=fixture();
  const bars=measureTimeline(snapshot.study.exercise,snapshot.study.bpm),end=bars.at(-1);
  assert.equal(readLastPractice(JSON.stringify({...snapshot,position:1e9})).position,end.start+end.duration);
  assert.equal(readLastPractice(JSON.stringify({...snapshot,position:-20})).position,0);
  for(const value of [null,'{','x'.repeat(2_000_001),JSON.stringify({...snapshot,version:2}),JSON.stringify({...snapshot,position:null}),JSON.stringify({...snapshot,study:{...snapshot.study,exercise:undefined}})])
    assert.equal(readLastPractice(value),null);
  const broken=plain(snapshot);broken.study.exercise.measures[0].events[0].durationUnits=123;
  assert.equal(readLastPractice(JSON.stringify(broken)),null);
});

test('denied or full storage does not throw or overwrite a valid resume with invalid data',()=>{
  const denied=createResumeStore(()=>{throw Error('denied');});
  assert.equal(denied.read(),null);assert.equal(denied.write(fixture()),false);
  const missing=createResumeStore(()=>undefined);assert.equal(missing.write(fixture()),false);
  const snapshot=fixture();let raw=JSON.stringify(snapshot);
  const store=createResumeStore(()=>({getItem:()=>raw,setItem:(_key,value)=>{raw=value;}}));
  assert.equal(store.write({...snapshot,position:NaN}),false);
  assert.deepEqual(plain(store.read()),plain(snapshot));
});

test('resume controls have explicit copy for all twelve supported languages',()=>{
  for(const locale of ['zh-TW','en','ja','es','de','fr','ko','pt-BR','ru','it','zh-CN','th']){
    const copy=resumeCopy(locale);
    assert.ok(copy.title&&copy.help&&copy.error&&copy.position.includes('{bar}'));
    if(locale!=='en')assert.notEqual(copy.title,resumeCopy('en').title);
  }
});
