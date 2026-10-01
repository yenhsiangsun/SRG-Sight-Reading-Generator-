import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadModule} from './helpers.mjs';

const bank=JSON.parse(fs.readFileSync('src/audio/sampleManifest.json','utf8'));
const audioBuffer={length:48000,numberOfChannels:2};
const wav=()=>{
  const file=fs.readFileSync('public/samples/pipa/A3-recital.wav');
  return file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength);
};
const response=(overrides={})=>({status:200,ok:true,type:'basic',arrayBuffer:async()=>wav(),...overrides});
const moduleWith=(fetch)=>loadModule('src/audio/loadRecordedSamples.ts',1,undefined,{}, {fetch,URL,AbortController,setTimeout,clearTimeout,Uint8Array});
const options={urls:{A3:'A3-recital.wav'},baseUrl:'/samples/pipa/',pageUrl:'capacitor://localhost/',decode:async()=>audioBuffer};

test('Capacitor bundled WAV and MP3 status-zero responses decode without Tone HTTP checks',async()=>{
  const requests=[];
  const {loadRecordedSamples}=moduleWith(async url=>{
    requests.push(url);
    const path=new URL(url).pathname;
    const file=fs.readFileSync('public'+path);
    return response({status:0,ok:false,type:'default',arrayBuffer:async()=>file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength)});
  });
  const pipa=await loadRecordedSamples(options);
  const piano=await loadRecordedSamples({...options,urls:{C4:'C4.mp3'},baseUrl:'/samples/piano/'});
  assert.equal(pipa.A3,audioBuffer);assert.equal(piano.C4,audioBuffer);
  assert.deepEqual(requests,['capacitor://localhost/samples/pipa/A3-recital.wav','capacitor://localhost/samples/piano/C4.mp3']);
});

test('native media exception never accepts HTTP failures, foreign hosts or opaque responses',async()=>{
  for(const variant of [
    {response:{status:404,ok:false}},
    {pageUrl:'https://practice.example/',response:{status:0,ok:false}},
    {baseUrl:'capacitor://other/samples/',response:{status:0,ok:false}},
    {response:{status:0,ok:false,type:'opaque'}},
    {response:{status:0,ok:false,type:'opaqueredirect'}},
  ]){
    let decoded=false;
    const {loadRecordedSamples}=moduleWith(async()=>response(variant.response));
    await assert.rejects(loadRecordedSamples({...options,...variant,decode:async()=>{decoded=true;return audioBuffer;}}),/Sample request failed/);
    assert.equal(decoded,false);
  }
});

test('missing HTML, empty audio and decoder failures remain actionable errors',async()=>{
  for(const bytes of [new ArrayBuffer(0),new TextEncoder().encode('<html>index.html fallback</html>').buffer]) {
    const {loadRecordedSamples}=moduleWith(async()=>response({arrayBuffer:async()=>bytes}));
    await assert.rejects(loadRecordedSamples(options),/Invalid audio/);
  }
  const {loadRecordedSamples}=moduleWith(async()=>response());
  await assert.rejects(loadRecordedSamples({...options,decode:async()=>{throw Error('invalid codec');}}),/invalid codec/);
  await assert.rejects(loadRecordedSamples({...options,decode:async()=>({length:0,numberOfChannels:2})}),/Empty audio/);
});

test('sample URLs respect deployed subpaths and loading uses at most three decoders',async()=>{
  let active=0,peak=0;const requested=[];
  const {loadRecordedSamples}=moduleWith(async url=>{requested.push(url);return response();});
  const urls=Object.fromEntries(Array.from({length:12},(_,i)=>[String(i),`sample-${i}.wav`]));
  const buffers=await loadRecordedSamples({...options,urls,baseUrl:'/app/samples/piano/',pageUrl:'https://practice.example/app/',decode:async()=>{
    active++;peak=Math.max(peak,active);
    await new Promise(resolve=>setTimeout(resolve,2));active--;return audioBuffer;
  }});
  assert.equal(Object.keys(buffers).length,12);assert.equal(peak,3);
  assert.ok(requested.every(url=>url.startsWith('https://practice.example/app/samples/piano/')));
});

test('timed-out and failed loads abort pending requests and do not drain the remaining bank',async()=>{
  const signals=[];
  const {loadRecordedSamples}=moduleWith(async(_,options)=>{
    signals.push(options.signal);
    await new Promise((_,reject)=>options.signal.addEventListener('abort',()=>reject(Error('aborted'))));
  });
  await assert.rejects(loadRecordedSamples({...options,urls:bank.Piano.urls,timeoutMs:5}),/逾時/);
  assert.equal(signals.length,3);assert.ok(signals.every(signal=>signal.aborted));
  const attempts=[];
  const failure=moduleWith(async(url,{signal})=>{attempts.push(signal);if(url.includes('A1'))throw Error('missing recording');return new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(Error('aborted'))));});
  await assert.rejects(failure.loadRecordedSamples({...options,urls:bank.Piano.urls}),/missing recording/);
  assert.equal(attempts.length,3);assert.ok(attempts.every(signal=>signal.aborted));
});

test('score-specific sample selection preserves Tone nearest roots for enharmonics and complete piano range',()=>{
  const {samplesForNotes}=moduleWith(()=>{throw Error('no requests');});
  const selected=samplesForNotes(bank.Piano.urls,['C4','D4','E4','G4','c/4','b#3']);
  assert.deepEqual(Object.keys(selected),['C4','D4','E4','G4']);
  assert.equal(Object.keys(bank.Piano.urls).length,85,'catalog remains complete');
  const sparse={C3:'C3.wav',E3:'E3.wav',C4:'C4.wav'};
  assert.deepEqual(Object.keys(samplesForNotes(sparse,['D3'])),['E3'],'upper root wins a tie, matching Tone');
  assert.deepEqual(Object.keys(samplesForNotes(sparse,['Cb3','B3'])),['C3','C4']);
  assert.equal(samplesForNotes(bank.Piano.urls,undefined),bank.Piano.urls);
  assert.equal(samplesForNotes(bank.Piano.urls,['unrecognized']),bank.Piano.urls,'safe full-bank fallback for an unknown note format');
});

test('every recorded instrument has complete native-accessible assets and uses the same decoding path',async()=>{
  const {INSTRUMENTS}=loadModule('src/music/instruments.ts');
  const requested=[];
  const {loadRecordedSamples}=moduleWith(async url=>{
    requested.push(url);
    const file=fs.readFileSync('public'+new URL(url).pathname);
    assert.ok(file.length>1000,url);
    return response({status:0,ok:false,arrayBuffer:async()=>file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength)});
  });
  for(const [name,samples] of Object.entries(bank)) {
    assert.ok(INSTRUMENTS[name],name);
    const loaded=await loadRecordedSamples({...options,urls:samples.urls,baseUrl:`/samples/${samples.folder}/`});
    assert.equal(Object.keys(loaded).length,Object.keys(samples.urls).length,name);
  }
  assert.equal(requested.length,Object.values(bank).reduce((sum,s)=>sum+Object.keys(s.urls).length,0));
  assert.ok(requested.every(url=>url.startsWith('capacitor://localhost/samples/')));
});

test('playback hook requests sounding pitches from both staves, chords and transposing instruments',async()=>{
  let adapter;const requested=[];
  const {createPlaybackEvents}=loadModule('src/audio/PlaybackController.ts');
  const {usePlayback}=loadModule('src/hooks/usePlayback.ts',1,undefined,{
    react:{useEffect:effect=>effect(),useRef:current=>({current}),useState:value=>[value,()=>{}],useCallback:callback=>callback},
    tone:{getTransport:()=>({})},
    '../audio/PlaybackController':{PlaybackController:class{constructor(value){adapter=value;}},createPlaybackEvents},
    '../audio/createPlaybackInstrument':{createPlaybackInstrument:(name,notes,signal)=>{requested.push({name,notes:Array.from(notes),signal});}},
  });
  usePlayback();
  const signal=new AbortController().signal;
  await adapter.createSynth({instrument:'Piano',soundProfile:'Piano',timeSignature:'4/4',transposition:-2,
    measures:[{totalUnits:16,events:[{key:'c/4',rest:false,durationUnits:16,chord:[{key:'c/4'},{key:'e/4'},{key:'g/4'}]}]}],
    lowerMeasures:[{totalUnits:16,events:[{key:'c/3',rest:false,durationUnits:16}]}],
  },signal);
  assert.deepEqual(requested,[{name:'Piano',notes:['A#3','D4','F4','A#2'],signal}]);
});

test('all synthetic winds avoid the whistling effects chain, soprano sheng stays unchanged, and other families retain their effects',()=>{
  const {INSTRUMENTS}=loadModule('src/music/instruments.ts');
  const nodes=[],connections=[],attacks=[];
  const destination={name:'destination'};
  class Node {
    volume={value:0};wet={value:0};disposed=0;
    constructor(...args){this.args=args;nodes.push(this);}
    connect(node){connections.push([this,node]);return this;}
    toDestination(){return this.connect(destination);}
    start(){return this;}
    triggerAttackRelease(...args){attacks.push(args);}
    releaseAll(){this.released=true;}
    dispose(){this.disposed++;}
  }
  const tone=Object.fromEntries(['PolySynth','FMSynth','MonoSynth','Filter','Chorus','Phaser','EQ3','Reverb','FeedbackDelay','Vibrato','AutoFilter','Compressor'].map(name=>[name,Node]));
  tone.Destination=destination;
  const {createInstrumentSynth}=loadModule('src/audio/createInstrumentSynth.ts',1,undefined,{tone});
  const source=fs.readFileSync('src/audio/createPlaybackInstrument.ts','utf8').replace('import.meta.env.BASE_URL',"'/'").replace('import.meta.env.VITE_LOCAL_PIPA','false');
  const {createPlaybackInstrument,hasSamples}=loadModule('src/audio/createPlaybackInstrument.ts',1,source,{
    tone,'./sampleManifest.json':bank,'./createInstrumentSynth':{createInstrumentSynth},
    './loadRecordedSamples':{loadRecordedSamples:()=>{throw Error('synthetic instrument must not fetch recordings');}},
  });
  const syntheticInstruments=Object.keys(INSTRUMENTS).filter(name=>!hasSamples(name));
  return Promise.all(syntheticInstruments.map(async name=>{
    const start=nodes.length,wireStart=connections.length;
    // Creation is synchronous until the async factory returns its resolved value.
    const pending=createPlaybackInstrument(name);
    const created=nodes.slice(start),wires=connections.slice(wireStart);
    const voice=await pending;
    const wind=['木管','銅管','國樂・吹管'].includes(INSTRUMENTS[name].family);
    assert.ok(wind?created.length===1:created.length>=6,name);
    assert.equal(wires.length,created.length,name);
    assert.equal(wires.at(-1)[1],destination,name);
    for(let i=0;i<wires.length-1;i++)assert.equal(wires[i][1],wires[i+1][0],`${name}: serial effect ${i}`);
    if(wind) {
      assert.equal(wires.at(-1)[0],created[0],`${name}: direct voice, no sweeping phaser or delayed notes`);
      assert.equal(created[0].args[1].filter.Q,.68,`${name}: retain non-resonant voice filter`);
    } else {
      assert.notEqual(wires.at(-1)[0],created[0],`${name}: no dry bypass`);
    }
    if(name==='Sheng') {
      assert.deepEqual(Array.from(created[0].args[1].oscillator.partials),[1,.52,.33,.17,.11,.04]);
      assert.equal(created[0].volume.value,-18);
      assert.equal(created[0].args[1].envelope.attack,.045);
      assert.equal(created[0].args[1].envelope.release,.12);
      assert.equal(created[0].args[1].filterEnvelope.baseFrequency,1850);
    }
    voice.triggerAttackRelease('C4',.5,0,.7);voice.releaseAll();voice.dispose();
    assert.ok(created[0].released,name);
    assert.ok(created.every(node=>node.disposed===1),name);
    for(const node of created)assert.ok(Number.isFinite(node.volume.value),name);
  })).then(()=>assert.equal(attacks.length,syntheticInstruments.length));
});
