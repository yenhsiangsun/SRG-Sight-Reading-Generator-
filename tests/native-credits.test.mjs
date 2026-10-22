import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadModule} from './helpers.mjs';

function loader(response,requests=[]){return loadModule('src/native/loadSoundCredits.ts',1,undefined,{}, {URL,fetch:async(url,options)=>{requests.push({url,options});return {ok:false,status:0,type:'basic',text:async()=> 'Recorded instrument credits',...response};}}).loadSoundCredits;}

test('bundled iOS credits allow non-opaque status zero; Android and web use ordinary HTTP success',async()=>{
  assert.equal(await loader({})('capacitor://localhost/','/'),'Recorded instrument credits');
  const requests=[],controller=new AbortController();
  assert.equal(await loader({ok:true,status:200},requests)('https://localhost/','/',controller.signal),'Recorded instrument credits');
  assert.equal(requests[0].url,'https://localhost/samples/CREDITS.txt');
  assert.equal(requests[0].options.signal,controller.signal);
});

test('credits status-zero exception rejects HTTP, foreign origins and opaque responses',async()=>{
  for(const [response,page,base] of [
    [{},'https://localhost/','/'],[{},'https://example.com/','/'],
    [{},'capacitor://foreign/','/'],[{},'capacitor://localhost/','https://foreign/'],
    [{type:'opaque'},'capacitor://localhost/','/'],[{type:'opaqueredirect'},'capacitor://localhost/','/'],
    [{status:404},'capacitor://localhost/','/'],
  ])await assert.rejects(loader(response)(page,base),/unavailable/);
});

test('empty credits are an error and deployed web subpaths remain intact',async()=>{
  await assert.rejects(loader({ok:true,status:200,text:async()=>''})('https://example.com/','/'),/unavailable/);
  const requests=[];
  await loader({ok:true,status:200},requests)('https://example.com/studio/','/studio/');
  assert.equal(requests[0].url,'https://example.com/studio/samples/CREDITS.txt');
});

for(const [name,response,page] of [
  ['HTTP HTML fallback',{ok:true,status:200,headers:{get:()=> 'text/html'},text:async()=> '<!doctype html><html><body><div id="root"></div></body></html>'},'https://example.com/'],
  ['HTML mislabeled as plain text',{ok:true,status:200,headers:{get:()=> 'text/plain'},text:async()=> '<!DOCTYPE html><html><body>App entry</body></html>'},'https://example.com/'],
  ['bundled iOS HTML fallback',{headers:{get:()=> 'text/html'},text:async()=> '<html lang="zh-Hant"><head><title>App</title></head><body></body></html>'},'capacitor://localhost/'],
  ['BOM and whitespace before HTML',{ok:true,status:200,text:async()=> '\uFEFF \n\t<!doctype html><html><body>App entry</body></html>'},'https://example.com/'],
])test(`credits reject ${name} instead of reporting a successful resource load`,async()=>{
  await assert.rejects(loader(response)(page,'/'),/unavailable/);
});

test('credits preserve legitimate plain text bytes without requiring MIME or a license schema',async()=>{
  for(const text of [
    readFileSync('public/samples/CREDITS.txt','utf8'),
    '\uFEFF  # Instrument recordings\nLicense: CC0.\n',
    'Recorded instrument credits\nMP3 preview <not the original WAV>; CC BY 3.0.',
  ])assert.equal(await loader({ok:true,status:200,text:async()=>text})('https://example.com/','/'),text);
});
