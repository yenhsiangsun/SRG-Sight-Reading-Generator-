import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';
test('capture worklet batches complete samples with sample-clock timestamps',()=>{
  const messages=[];let Processor;
  class Base{port={postMessage:message=>messages.push(message)};}
  const context=vm.createContext({AudioWorkletProcessor:Base,sampleRate:48000,currentTime:0,registerProcessor:(name,type)=>{assert.equal(name,'practice-capture');Processor=type;}});
  vm.runInContext(fs.readFileSync('public/capture-worklet.js','utf8'),context);
  const processor=new Processor();
  for(let i=0;i<32;i++){context.currentTime=i*128/48000;processor.process([[new Float32Array(128).fill(i)]]);}
  assert.equal(messages.length,5);assert.equal(messages[0].time,0);assert.ok(Math.abs(messages[1].time-512/48000)<1e-10);
  for(let i=0;i<messages.length;i++){
    assert.equal(messages[i].samples.length,2048);assert.equal(messages[i].samples[0],i*4);assert.equal(messages[i].samples[2047],i*4+15);
    assert.ok(Math.abs(messages[i].time-i*512/48000)<1e-10);
  }
});
function sessionFixture(getUserMedia){
  let closed=0;
  class Context{state='running';resume(){return Promise.resolve();}close(){closed++;this.state='closed';return Promise.resolve();}}
  const source=fs.readFileSync('src/assessment/MicrophoneSession.ts','utf8').replace('import.meta.env.BASE_URL',"'/'");
  const {MicrophoneSession}=loadModule('src/assessment/MicrophoneSession.ts',1,source,{}, {AudioContext:Context,window:{AudioWorkletNode:class{}},navigator:{mediaDevices:{getUserMedia}},clearInterval(){}});
  return {session:new MicrophoneSession(),closed:()=>closed};
}
test('canceling while microphone permission is pending releases the late stream without recording',async()=>{
  let resolve;let stopped=0,finished=0;
  const f=sessionFixture(()=>new Promise(r=>{resolve=r;}));
  const pending=f.session.start(30,60,4,()=>{},()=>finished++);
  f.session.stop();resolve({getTracks:()=>[{stop:()=>stopped++}]});await pending;
  assert.equal(stopped,1);assert.equal(f.closed(),1);assert.equal(finished,0);
});
test('microphone permission denial closes the audio context and does not fabricate a result',async()=>{
  const f=sessionFixture(async()=>{throw new Error('Permission denied');});let finished=0;
  await assert.rejects(f.session.start(30,60,4,()=>{},()=>finished++),/Permission denied/);
  assert.equal(f.closed(),1);assert.equal(finished,0);
});
