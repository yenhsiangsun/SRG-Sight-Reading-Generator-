import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {loadModule} from './helpers.mjs';

const {makeStudySnapshot,swapStudyComparison}=loadModule('src/practice/studyComparison.ts');
const plain=x=>JSON.parse(JSON.stringify(x));
const exercise=loadModule('src/music.ts',81001).generateExercise('Sheng','treble','beginner','C','4/4','simple',4,80);
const settings={instrument:'Sheng',clef:'treble',difficulty:'Beginner',rhythmLevel:'Simple',timeSignature:'4/4',keySignature:'C',tonic:'C',scaleId:'major',measureCount:4,rangeMinMidi:60,rangeMaxMidi:84,allowAccidentals:false,mixedMeters:false,meters:['4/4'],allowedKeySignatures:['C']};
const sample=(id,bpm=80,position=2)=>({exercise:plain(exercise),settings:plain(settings),id,bpm,position,number:1});
const tree=ts.createSourceFile('App.tsx',fs.readFileSync('src/App.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function action(name,context){
  let expression;const visit=node=>{if(ts.isVariableDeclaration(node)&&node.name.getText(tree)===name)expression=node.initializer?.getText(tree);ts.forEachChild(node,visit);};visit(tree);assert.ok(expression,name);
  const code=ts.transpileModule('('+expression+')',{compilerOptions:{target:ts.ScriptTarget.ES2023}}).outputText;
  return vm.runInNewContext(code,context);
}

test('comparison snapshots keep notes, independent settings, tempo and completion identity in session memory',()=>{
  const source=sample('original-session',124,7.25),copy=makeStudySnapshot(source);
  source.exercise.measures[0].events[0].key='changed';source.settings.meters.push('6/8');source.settings.allowedKeySignatures.push('G');
  assert.notEqual(copy.exercise.measures[0].events[0].key,'changed');
  assert.deepEqual(plain(copy.settings.meters),['4/4']);assert.deepEqual(plain(copy.settings.allowedKeySignatures),['C']);
  assert.equal(copy.bpm,124);assert.equal(copy.id,'original-session');assert.equal(copy.position,7.25);assert.equal(copy.number,1);
  assert.equal(makeStudySnapshot({...source,position:NaN}).position,0);
});

test('previous/new comparison is bounded to two exact studies and can be swapped both ways without composition',()=>{
  const previous=makeStudySnapshot(sample('old',92,5)),current=makeStudySnapshot(sample('new',108,1));
  const back=swapStudyComparison({previous,showingPrevious:false},current);
  assert.equal(back.restore,previous);assert.equal(back.state.previous,current);assert.equal(back.state.showingPrevious,true);
  const forward=swapStudyComparison(back.state,previous);
  assert.equal(forward.restore,current);assert.equal(forward.state.previous,previous);assert.equal(forward.state.showingPrevious,false);
  assert.equal(swapStudyComparison({previous:null,showingPrevious:false},current),null);
});

test('the actual App restore action keeps the original completion ID, bookmark and tempo, and never starts playback',()=>{
  const previous=makeStudySnapshot(sample('completed-old-session',92,7.25)),current=makeStudySnapshot(sample('new-session',108,2));
  const accepted={...previous.exercise,accepted:true},log=[],result={};
  const context={busy:false,comparison:{previous,showingPrevious:false},captureCurrentStudy:()=>current,swapStudyComparison,
    resume:{capture(){log.push('capture');}},collection:{clearMessage(){}},
    playback:{stop(){log.push('stop');},seek(ex,bpm,position){assert.deepEqual(log,['capture','stop']);result.seek={ex,bpm,position};},play(){throw Error('comparison must never autoplay');}},
    practice:{restore(ex,s){assert.equal(ex,previous.exercise);assert.equal(s,previous.settings);return accepted;},generateFrom(){throw Error('comparison must never compose');}},
    setResumeIdentity(value){result.identity=value;},setBpm(v){result.bpm=v;},setComparison(v){result.comparison=v;},setMode(v){result.mode=v;},setPage(v){result.page=v;},window:{scrollTo(){}},
  };
  action('restorePrevious',context)();
  assert.equal(result.identity.exercise,accepted);assert.equal(result.identity.id,'completed-old-session');assert.equal(result.identity.number,1);
  assert.equal(result.bpm,92);assert.equal(result.seek.position,7.25);assert.equal(result.seek.ex,accepted);
  assert.equal(result.comparison.showingPrevious,true);assert.equal(result.mode,'practice');assert.equal(result.page,'practice');
});

test('the actual Next action snapshots the bookmark before stopping and only commits history on successful generation',()=>{
  for(const success of [false,true]){
    let position=6.25;const remembered=[],pages=[],log=[];
    const current={exercise:plain(exercise),settings:plain(settings),isPreview:false};
    const context={current,sessionId:'same-session',bpm:124,studyNumber:2,makeStudySnapshot,
      playback:{getPosition:()=>position,stop(){position=0;log.push('stop');}},collection:{clearMessage(){}},
      practice:{generateNew(){log.push('generate');return success?108:false;}},
      setBpm(){},rememberPrevious(value){remembered.push(value);},setPage(v){pages.push(v);},window:{scrollTo(){}},
    };
    context.captureCurrentStudy=action('captureCurrentStudy',context);context.generateNew=action('generateNew',context);
    action('start',context)();assert.deepEqual(log,['stop','generate']);
    if(success){assert.equal(remembered.length,1);assert.equal(remembered[0].position,6.25);assert.equal(remembered[0].bpm,124);assert.equal(remembered[0].id,'same-session');assert.equal(remembered[0].number,2);assert.deepEqual(pages,['practice']);}
    else {assert.equal(remembered.length,0);assert.equal(pages.length,0);}
  }
});
