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
  class Context{
    state='running';
    resume(){return Promise.resolve();}
    createBuffer(){return {};}
    createBufferSource(){return {connect(){},disconnect(){},start(){}};}
    close(){closed++;this.state='closed';return Promise.resolve();}
  }
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

function deferred(){let resolve;const promise=new Promise(yes=>{resolve=yes;});return {promise,resolve};}
async function until(condition){for(let i=0;i<30&&!condition();i++)await Promise.resolve();assert.ok(condition(),'expected async boundary was reached');}
function fullSessionFixture(config={}){
  const events=[],oscillators=[],primers=[],timers=new Map(),states=[],progress=[],results=[];
  let context,capture,closed=0,stopped=0,resumes=0,modules=0,mediaRequests=0,nextTimer=0;
  const audioSession=config.audioSession??{type:'playback'};
  class Node{
    connections=[];disconnected=false;
    connect(node){this.connections.push(node);return node;}
    disconnect(){this.disconnected=true;}
  }
  class Parameter{
    value=0;changes=[];
    setValueAtTime(value,time){this.changes.push({kind:'set',value,time});}
    linearRampToValueAtTime(value,time){this.changes.push({kind:'linear',value,time});}
    exponentialRampToValueAtTime(value,time){this.changes.push({kind:'exponential',value,time});}
  }
  class Context{
    state='suspended';sampleRate=48000;currentTime=10;destination=new Node();
    audioWorklet={addModule:async url=>{modules++;events.push(['module',url]);await config.addModule?.(this);}};
    constructor(){context=this;events.push(['context',audioSession.type]);}
    resume(){
      resumes++;events.push(['resume',resumes]);
      if(config.resume)return config.resume(this,resumes);
      this.state='running';return Promise.resolve();
    }
    close(){closed++;this.state='closed';events.push(['close']);return Promise.resolve();}
    createBuffer(channels,length,sampleRate){return {channels,length,sampleRate,data:new Float32Array(length)};}
    createBufferSource(){const source=new Node();source.start=at=>{source.at=at;events.push(['primer']);};primers.push(source);return source;}
    createMediaStreamSource(){return new Node();}
    createGain(){const node=new Node();node.gain=new Parameter();return node;}
    createOscillator(){
      const node=new Node();node.frequency=new Parameter();node.start=at=>{node.startAt=at;};node.stop=at=>{node.stopAt=at;};oscillators.push(node);return node;
    }
  }
  class Worklet extends Node{port={};constructor(){super();capture=this;}}
  const track={stop(){stopped++;},getSettings(){return {deviceId:'mic-A'};},addEventListener(name,listener){this[name]=listener;}};
  const stream={getTracks:()=>[track],getAudioTracks:()=>[track]};
  const navigator={mediaDevices:{getUserMedia:async()=>{
    mediaRequests++;events.push(['microphone',audioSession.type]);return config.getUserMedia?config.getUserMedia(context,stream):stream;
  }}};
  if(config.hasAudioSession!==false)navigator.audioSession=audioSession;
  const source=fs.readFileSync('src/assessment/MicrophoneSession.ts','utf8').replace('import.meta.env.BASE_URL',"'/'");
  const {MicrophoneSession}=loadModule('src/assessment/MicrophoneSession.ts',1,source,{'./pitch':{detectPitch:samples=>samples[0]?{midi:60,confidence:.99,rms:.2}:null}}, {
    AudioContext:Context,AudioWorkletNode:Worklet,window:{AudioWorkletNode:Worklet},navigator,
    setInterval(callback){const id=++nextTimer;timers.set(id,callback);return id;},clearInterval:id=>timers.delete(id),
  });
  const session=new MicrophoneSession();
  return {
    session,events,oscillators,primers,states,progress,results,audioSession,track,
    get context(){return context;},get capture(){return capture;},get closed(){return closed;},get stopped(){return stopped;},
    get resumes(){return resumes;},get modules(){return modules;},get mediaRequests(){return mediaRequests;},get timerCount(){return timers.size;},
    start:(reading=3,bpm=60,duration=4.5)=>session.start(reading,bpm,duration,(...state)=>states.push(state),frames=>results.push(frames),{onProgress:(...state)=>progress.push(state)}),
    tick(time){context.currentTime=time;for(const callback of [...timers.values()])callback();},
    frame(centerTime,voiced=true){const samples=new Float32Array(2048).fill(voiced ? .2 : 0);capture.port.onmessage({data:{samples,time:centerTime-samples.length/context.sampleRate/2,sampleRate:context.sampleRate}});},
  };
}

test('calibration has four audible quarter-note cues, eight half-beat onsets and a silent capture tail on one clock',async()=>{
  const f=fullSessionFixture();await f.start();
  assert.deepEqual(f.events.slice(0,4),[['context','play-and-record'],['resume',1],['primer'],['microphone','play-and-record']]);
  assert.equal(f.primers.length,1);assert.equal(f.primers[0].buffer.data.every(n=>n===0),true,'unlock primer is silent');
  assert.deepEqual(f.oscillators.map(n=>n.startAt),[13,14,15,16]);
  for(const cue of f.oscillators){
    assert.equal(cue.connections[0].connections[0],f.context.destination,'count-in reaches output independently of the muted input');
    assert.ok(cue.connections[0].gain.changes.some(change=>change.value>0));
    assert.ok(cue.stopAt<17,'count-in never leaks into the performance window');
  }
  assert.equal(f.capture.connections[0].gain.value,0,'captured microphone input is never monitored through the speakers');
  f.tick(13);assert.deepEqual(f.states.at(-1),['countin',4]);
  f.tick(16);assert.deepEqual(f.states.at(-1),['countin',1]);
  f.tick(17);assert.deepEqual(f.progress.at(-1),['performing',0]);
  f.frame(16.79); // Outside the permitted early-attack margin.
  for(let i=0;i<8;i++){
    f.tick(17+i*.5);assert.equal(f.progress.at(-1)[1],i*.5);
    f.frame(17+i*.5+.08);f.frame(17+i*.5+.11);
  }
  f.tick(21);assert.deepEqual(f.progress.at(-1),['performing',4]);assert.equal(f.results.length,0);
  f.frame(21.49,false);f.frame(21.51,false);
  f.tick(21.5);assert.equal(f.results.length,0,'capture tail completes before the worklet delivery grace period');
  f.tick(21.63);assert.equal(f.results.length,1);assert.equal(f.results[0].length,17);
  assert.ok(Math.abs(f.results[0][0].time-.08)<1e-10);
  const {estimateCalibration}=loadModule('src/assessment/calibration.ts');
  assert.equal(estimateCalibration(f.results[0]).offsetMs,80,'captured frames retain the original musical onset clock');
  assert.equal(f.oscillators.length,4,'no audible click is generated during performance or the capture tail');
  assert.equal(f.stopped,1);assert.equal(f.closed,1);assert.equal(f.timerCount,0);assert.equal(f.audioSession.type,'playback');
});

test('ordinary assessments retain four count-in beats at the score tempo',async()=>{
  const f=fullSessionFixture();await f.start(30,120,2.4);
  assert.deepEqual(f.oscillators.map(n=>n.startAt),[40,40.5,41,41.5]);
  f.tick(42);assert.deepEqual(f.progress.at(-1),['performing',0]);
  f.frame(42.1);f.tick(44.53);
  assert.equal(f.results.length,1);assert.ok(Math.abs(f.results[0][0].time-.1)<1e-10);assert.equal(f.audioSession.type,'playback');
});

test('microphone routing and worklet setup can suspend output; count-in waits for the resumed clock',async()=>{
  for(const boundary of ['microphone','worklet']){
    const f=fullSessionFixture({
      getUserMedia(context,stream){if(boundary==='microphone')context.state='suspended';return stream;},
      addModule(context){if(boundary==='worklet')context.state='suspended';},
      resume(context,count){context.state='running';if(count===2)context.currentTime=24;return Promise.resolve();},
    });
    await f.start();assert.equal(f.resumes,2,boundary);assert.deepEqual(f.oscillators.map(n=>n.startAt),[27,28,29,30]);
    f.tick(31);assert.deepEqual(f.progress.at(-1),['performing',0]);f.session.stop();
  }
});

test('cancel during microphone permission restores output and releases a late input without recording',async()=>{
  const permission=deferred();let lateStopped=0;
  const f=fullSessionFixture({getUserMedia:()=>permission.promise});const pending=f.start();
  assert.equal(f.audioSession.type,'play-and-record');f.session.stop();assert.equal(f.audioSession.type,'playback');
  permission.resolve({getTracks:()=>[{stop:()=>lateStopped++}]});await pending;
  assert.equal(lateStopped,1);assert.equal(f.closed,1);assert.equal(f.results.length,0);assert.equal(f.oscillators.length,0);assert.equal(f.timerCount,0);
});

test('canceling a pending initial audio resume never progresses into worklet setup',async()=>{
  const resume=deferred();const f=fullSessionFixture({resume:()=>resume.promise});const pending=f.start();
  await until(()=>f.mediaRequests===1);await Promise.resolve();f.session.stop();resume.resolve();await pending;
  assert.equal(f.stopped,1);assert.equal(f.closed,1);assert.equal(f.modules,0);assert.equal(f.oscillators.length,0);assert.equal(f.audioSession.type,'playback');
});

test('canceling pending worklet loading or the post-microphone resume never schedules audio or grading',async()=>{
  for(const boundary of ['worklet','resume']){
    const gate=deferred();const f=fullSessionFixture({
      addModule(context){context.state='suspended';return boundary==='worklet'?gate.promise:undefined;},
      resume(context,count){if(count===1){context.state='running';return Promise.resolve();}return gate.promise;},
    });
    const pending=f.start();await until(()=>boundary==='worklet'?f.modules===1:f.resumes===2);
    f.session.stop();gate.resolve();await pending;
    assert.equal(f.stopped,1,boundary);assert.equal(f.closed,1,boundary);assert.equal(f.oscillators.length,0,boundary);assert.equal(f.timerCount,0,boundary);
    assert.equal(f.results.length,0,boundary);assert.equal(f.audioSession.type,'playback',boundary);
  }
});

test('microphone denial restores the previous output session without a result',async()=>{
  const f=fullSessionFixture({getUserMedia:async()=>{throw new Error('Permission denied');}});
  await assert.rejects(f.start(),/Permission denied/);
  assert.equal(f.closed,1);assert.equal(f.results.length,0);assert.equal(f.audioSession.type,'playback');assert.equal(f.oscillators.length,0);
});

test('iOS interrupted audio, suspended audio and a lost input stop recording without grading',async()=>{
  for(const interruption of ['interrupted','suspended','track-ended','processor-error']){
    const f=fullSessionFixture();await f.start();f.tick(17.2);f.frame(17.1);
    if(interruption==='track-ended')f.track.ended();
    else if(interruption==='processor-error')f.capture.onprocessorerror();
    else{f.context.state=interruption;f.context.onstatechange();}
    assert.deepEqual(f.states.at(-1),['idle',0],interruption);assert.equal(f.results.length,0,interruption);
    assert.equal(f.timerCount,0,interruption);assert.equal(f.stopped,1,interruption);assert.equal(f.closed,1,interruption);assert.equal(f.audioSession.type,'playback',interruption);
    f.frame(17.4);f.tick(99);assert.equal(f.results.length,0,'late worklet messages cannot finish an interrupted session');
  }
});

test('browsers without Audio Session API or with a rejecting implementation still receive the count-in',async()=>{
  for(const config of [
    {hasAudioSession:false},
    {audioSession:{get type(){return 'auto';},set type(_){throw new Error('Unsupported type');}}},
  ]){
    const f=fullSessionFixture(config);await f.start();assert.equal(f.oscillators.length,4);f.session.stop();assert.equal(f.closed,1);
  }
});

test('a context that cannot resume fails clearly instead of silently starting the countdown',async()=>{
  for(const stalled of ['suspended','rejected']){
    const f=fullSessionFixture({resume:()=>stalled==='suspended'?Promise.resolve():Promise.reject(new Error('Audio rejected'))});
    await assert.rejects(f.start(),/AUDIO_UNAVAILABLE/);
    assert.equal(f.stopped,1,stalled);assert.equal(f.closed,1,stalled);assert.equal(f.oscillators.length,0,stalled);
    assert.equal(f.timerCount,0,stalled);assert.equal(f.results.length,0,stalled);assert.equal(f.audioSession.type,'playback',stalled);
  }
});
