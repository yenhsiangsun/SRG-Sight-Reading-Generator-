import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import * as React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadModule} from './helpers.mjs';

const {translate,locales}=loadModule('src/i18n/messages.ts');
const {assessmentMessages}=loadModule('src/i18n/assessmentMessages.ts');
const file='src/components/CalibrationProgress.tsx';
const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS}}).outputText;
const scoreFile='src/components/CalibrationScore.tsx';
const scoreSource=ts.transpileModule(fs.readFileSync(scoreFile,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS}}).outputText;
const scoreModule=loadModule(scoreFile,1,scoreSource,{react:React,'react/jsx-runtime':jsxRuntime,vexflow:{},'./CalibrationScore.css':{}});
const {calibrationCursorX,calibrationWrittenPitch}=loadModule('src/notation/calibrationScore.ts');
function render(props,locale='zh-TW') {
  const {default:Progress}=loadModule(file,1,source,{
    react:React,'react/jsx-runtime':jsxRuntime,'./CalibrationScore':scoreModule,'../i18n/context':{useI18n:()=>({t:key=>translate(locale,key)})},
  });
  const html=renderToStaticMarkup(React.createElement(Progress,{clef:'treble',noteKey:'b/4',...props}));
  return {html,status:html.match(/<output>(.*?)<\/output>/)?.[1]};
}

test('calibration distinguishes preparation seconds, four count-in beats and eight played notes',()=>{
  assert.equal(render({stage:'reading',remaining:3,elapsed:0}).status,'準備聽預備拍 · 3 秒');
  for(let step=1;step<=4;step++){
    const {html,status}=render({stage:'countin',remaining:5-step,elapsed:step-1});
    assert.ok(status.includes(String(step))&&status.includes('4'));
    assert.ok(!status.includes('秒'));
    assert.match(html,/class="calibration-score-bar"[^>]*hidden/, 'bar stays hidden during count-in');
    assert.match(html,new RegExp(`class="is-current">${step}</span>`));
  }
  for(let step=1;step<=8;step++){
    // The capture window deliberately begins at 4.5 seconds, rounded to 5 by
    // the generic exam timer. That must never become the calibration display.
    const {html,status}=render({stage:'performing',remaining:5,elapsed:(step-1)*.5});
    assert.equal(status,`演奏第 ${step} 音 / 共 8 音`);
    assert.match(html,/class="calibration-score-bar is-playing"/);
    assert.ok(!html.includes('hidden=""'),'playhead is visible during playing');
    assert.ok(html.includes(translate('zh-TW','calibrationScoreLabel')));
  }
});

test('the capture tail has a completion message without a ninth note or extra countdown',()=>{
  const {html,status}=render({stage:'performing',remaining:1,elapsed:4.1});
  assert.equal(status,translate('zh-TW','calibrationFinishing'));
  assert.ok(!/[0-9]/.test(status));
  assert.match(html,/class="calibration-score-bar is-playing"/);
});

test('calibration guidance and audio failure messages are explicit in every supported language',()=>{
  for(const locale of locales){
    for(const key of ['calibrationPreparing','calibrationCountInProgress','calibrationNoteProgress','calibrationFinishing','calibrationNoteGuide','calibrationNoteLabel','calibrationAudioError','calibrationStaffGuide','calibrationScoreLabel','calibrationPitchGuide']){
      const text=translate(locale,key);
      assert.ok(typeof text==='string'&&text.length>0,`${locale}: ${key}`);
      assert.equal(assessmentMessages[key].length,12,`${key} must explicitly translate all 12 languages`);
      if(locale!=='en'&&key!=='calibrationNoteLabel')assert.notEqual(text,translate('en',key),`${locale}: ${key} falls back to English`);
    }
    assert.ok(!render({stage:'performing',remaining:5,elapsed:0},locale).status.includes('{current}'));
  }
});

test('calibration bar reaches each engraved onset from the audio clock and stays on the barline through the capture tail',()=>{
  const noteXs=[108,133,167,206,244,281,323,364],end=402;
  for(let note=0;note<8;note++){
    assert.equal(calibrationCursorX('performing',note*.5,noteXs,end),noteXs[note]);
    assert.equal(calibrationCursorX('performing',note*.5+.25,noteXs,end),(noteXs[note]+(noteXs[note+1]??end))/2);
  }
  for(const time of [4,4.25,4.5,30])assert.equal(calibrationCursorX('performing',time,noteXs,end),end);
  for(const stage of ['idle','permission','reading','countin','result'])assert.equal(calibrationCursorX(stage,2,noteXs,end),null);
  assert.equal(calibrationCursorX('performing',1,[],end),null);
});

test('calibration keeps the fourth ledger line and preserves extreme pitches with a single octave mark',()=>{
  assert.equal(calibrationWrittenPitch('treble','g/6').octaveShift,0);
  assert.deepEqual({...calibrationWrittenPitch('treble','a#/6')},{key:'a#/5',octaveShift:1,staffSteps:10});
  assert.deepEqual({...calibrationWrittenPitch('treble','c/2')},{key:'c/3',octaveShift:-1,staffSteps:-9});
  for(const [clef,key] of [['treble','b/4'],['bass','d/3'],['alto','c/4'],['tenor','a/3']]){
    const written=calibrationWrittenPitch(clef,key);
    assert.equal(written.key,key);
    assert.equal(written.octaveShift,0);
  }
});
