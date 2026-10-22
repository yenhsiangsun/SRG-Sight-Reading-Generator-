// Audio lifecycle integration: all device/audio/network endpoints are explicit silent mocks.
// Runs the original hook, controller, factory and loader. React effect setup/cleanup is
// invoked by a small mock, without rendering or creating an AudioContext. Installed
// Tone implementation and device audio remain separate verification boundaries.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadModule} from './helpers.mjs';
const exercise = {instrument:'Piano',soundProfile:'Piano',timeSignature:'4/4',measures:[{totalUnits:16,events:[{key:'c/4',rest:false,durationUnits:16}]}]};
const wav = new TextEncoder().encode('RIFF0000WAVE0000').buffer;
const pcm = () => ({length:100,numberOfChannels:1});
const deferred = () => {let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const tick = () => new Promise(setImmediate);
const response = () => ({ok:true,status:200,type:'basic',arrayBuffer:async()=>wav});

function fixture({fetch=async()=>response(), decode=async()=>pcm(), unlock=async()=>{}, destinationFails=false}={}) {
  const states=[],nodes=[],scheduled=new Map(),draws=[],requests=[];
  let cleanup,id=0,starts=0,unlockCalls=0;
  const context = {decodeAudioData:decode};
  const transport = {bpm:{value:60},position:0,loop:false,loopStart:0,loopEnd:0,
    schedule:(callback,time)=>{const key=id++;scheduled.set(key,{callback,time});return key;},
    scheduleOnce:(callback,time)=>{const key=id++;scheduled.set(key,{callback,time});return key;},
    clear:key=>scheduled.delete(key),start:()=>{starts++;},pause(){},stop(){},getSecondsAtTime:()=>0};
  class SilentNode {
    volume={value:0}; disposed=0; attacks=0;
    constructor(options){this.options=options;nodes.push(this);}
    toDestination(){if(destinationFails && this.options?.urls)throw Error('destination failure');return this;}
    triggerAttackRelease(){this.attacks++;}
    releaseAll(){}
    dispose(){this.disposed++;return this;}
  }
  const tone={getTransport:()=>transport,getContext:()=>context,Sampler:SilentNode,PolySynth:SilentNode,Synth:SilentNode,
    getDraw:()=>({schedule:callback=>draws.push(callback)}),now:()=>.1,immediate:()=>0,
    start:()=>{unlockCalls++;return unlock();}};
  // helpers uses separate VM contexts per module. Share Error as in one browser
  // realm so factory errors keep their real message through the controller.
  const loader=loadModule('src/audio/loadRecordedSamples.ts',1,undefined,{}, {fetch:(url,options)=>{
    requests.push({url,signal:options.signal});return fetch(url,options);
  },URL,Error,setTimeout,clearTimeout});
  const factorySource=fs.readFileSync('src/audio/createPlaybackInstrument.ts','utf8')
    .replace('import.meta.env.BASE_URL',"'/'").replace('import.meta.env.VITE_LOCAL_PIPA','false');
  const factory=loadModule('src/audio/createPlaybackInstrument.ts',1,factorySource,{
    tone,'./sampleManifest.json':{Piano:{folder:'piano',urls:{C4:'C4.wav'}}},
    './createInstrumentSynth':{createInstrumentSynth(){throw Error('unexpected synthesized fallback');}},
    './loadRecordedSamples':loader,
  },{Error,document:{baseURI:'capacitor://localhost/'}});
  const {usePlayback:invokePlaybackHook}=loadModule('src/hooks/usePlayback.ts',1,undefined,{
    tone,react:{useEffect:effect=>{cleanup=effect();},useRef:current=>({current}),useState:value=>[value,next=>states.push(next)],useCallback:callback=>callback},
    '../audio/createPlaybackInstrument':factory,
  },{Error});
  const playback=invokePlaybackHook();
  return {playback,states,nodes,scheduled,draws,requests,cleanup:()=>cleanup(),starts:()=>starts,unlockCalls:()=>unlockCalls};
}

test('hook cleanup during pending unlock prevents requests, schedules, audio start, and late state changes',async()=>{
  const gate=deferred(),f=fixture({unlock:()=>gate.promise});
  const pending=f.playback.play(exercise,60),count=f.states.length;
  f.cleanup();gate.resolve();await pending;
  assert.equal(f.requests.length,0);assert.equal(f.scheduled.size,0);assert.equal(f.nodes.length,0);
  assert.equal(f.starts(),0);assert.equal(f.states.length,count);
});

test('hook cleanup aborts actual loader fetch and never constructs a sampler',async()=>{
  const entered=deferred(),f=fixture({fetch:(_, {signal})=>{
    entered.resolve();return new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(Error('mock fetch aborted')),{once:true}));
  }});
  const pending=f.playback.play(exercise,60);await entered.promise;
  const count=f.states.length;f.cleanup();await pending;
  assert.equal(f.requests.length,1);assert.ok(f.requests[0].signal.aborted);
  assert.equal(f.nodes.length,0);assert.equal(f.starts(),0);assert.equal(f.states.length,count);
});

test('hook cleanup settles promptly during noncancelable decode and ignores its eventual PCM',async()=>{
  for(const method of ['play','playLoop']) {
    const entered=deferred(),decoding=deferred(),f=fixture({decode:()=>{entered.resolve();return decoding.promise;}});
    const pending=method==='play'?f.playback.play(exercise,60):f.playback.playLoop(exercise,60,1,1);
    await entered.promise;const count=f.states.length;f.cleanup();
    let deadline;
    try {
      await Promise.race([pending,new Promise((_,reject)=>{deadline=setTimeout(()=>reject(Error('cleanup did not settle promptly')),1000);})]);
    } finally { clearTimeout(deadline); }
    assert.equal(f.nodes.length,0);assert.equal(f.starts(),0);assert.equal(f.states.length,count);
    decoding.resolve(pcm());await tick();assert.equal(f.nodes.length,0);assert.equal(f.states.length,count);
  }
});

test('replay supersedes actual decode, starts only replacement, and old PCM never wins cache',async()=>{
  const firstEntered=deferred(),oldDecode=deferred();let decodes=0;
  const survivor=pcm(),f=fixture({decode:()=>++decodes===1?(firstEntered.resolve(),oldDecode.promise):Promise.resolve(survivor)});
  const first=f.playback.play(exercise,60);await firstEntered.promise;
  await f.playback.replay(exercise,60);await first;
  assert.equal(f.starts(),1);assert.equal(f.requests.length,2);assert.ok(f.requests[0].signal.aborted);
  assert.equal(f.nodes.filter(node=>node.options?.urls).length,1);
  assert.equal(f.nodes.find(node=>node.options?.urls).options.urls.C4,survivor);
  oldDecode.resolve(pcm());await tick();
  await f.playback.replay(exercise,60);
  assert.equal(f.starts(),2);assert.equal(f.requests.length,2,'replacement decoded PCM is reused');
  assert.equal(f.nodes.filter(node=>node.options?.urls).at(-1).options.urls.C4,survivor);
  f.cleanup();assert.ok(f.nodes.every(node=>node.disposed===1));
});

test('factory connection failure disposes its constructed sampler and leaves hook idle',async()=>{
  const f=fixture({destinationFails:true});await f.playback.play(exercise,60);
  assert.equal(f.nodes.length,1);assert.equal(f.nodes[0].disposed,1);assert.equal(f.starts(),0);assert.equal(f.scheduled.size,0);
  assert.ok(f.states.includes('idle'));assert.ok(f.states.some(value=>typeof value==='string'&&value.includes('無法載入')));
  f.cleanup();
});

test('cleanup of playing hook clears IDs and makes previously captured callbacks inert',async()=>{
  const f=fixture();await f.playback.play(exercise,60);
  assert.equal(f.starts(),1);assert.equal(f.nodes.length,2);
  const obsolete=[...f.scheduled.values()].map(event=>event.callback),count=f.states.length;
  f.cleanup();obsolete.forEach(callback=>callback(.1));f.draws.forEach(callback=>callback());
  assert.equal(f.scheduled.size,0);assert.equal(f.states.length,count);assert.ok(f.nodes.every(node=>node.disposed===1));
  assert.ok(f.nodes.every(node=>node.attacks===0));
});

test('stop while unlock waits permits a replacement session and late old unlock cannot restart',async()=>{
  const old=deferred();let unlocks=0;const f=fixture({unlock:()=>++unlocks===1?old.promise:Promise.resolve()});
  const first=f.playback.play(exercise,60);f.playback.stop();
  await f.playback.play(exercise,60);old.resolve();await first;
  assert.equal(f.starts(),1);assert.equal(f.requests.length,1);assert.equal(f.unlockCalls(),2);f.cleanup();
});
