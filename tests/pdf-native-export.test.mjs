import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

const pdf=new Blob(['%PDF-1.7\n',new Uint8Array([0,128,255]),'\n%%EOF'],{type:'application/pdf'});
function fixture({native=true,available=true,missingPlugin,canShare=true,canShareError,writeError,shareError,readError,readMode,browserError,uri='file:///cache/export.pdf'}={}){
  const writes=[],shares=[],downloads=[],revoked=[],timers=[],pluginChecks=[];
  let reads=0,capabilityCalls=0,removed=0;
  class Reader{
    readAsDataURL(blob){
      reads++;
      if(readMode==='abort'){queueMicrotask(()=>this.onabort());return;}
      if(readMode==='invalid'){this.result='data:application/pdf,not-base64';queueMicrotask(()=>this.onload());return;}
      if(readError){this.error=readError;queueMicrotask(()=>this.onerror());return;}
      blob.arrayBuffer().then(bytes=>{this.result=`data:application/pdf;base64,${Buffer.from(bytes).toString('base64')}`;this.onload();});
    }
  }
  const api=loadModule('src/export/savePdfBlob.ts',1,undefined,{
    '@capacitor/core':{Capacitor:{isNativePlatform:()=>native,isPluginAvailable(name){pluginChecks.push(name);return available&&name!==missingPlugin;}}},
    '@capacitor/filesystem':{Directory:{Cache:'CACHE'},Filesystem:{async writeFile(options){writes.push(options);if(writeError)throw writeError;return {uri};}}},
    '@capacitor/share':{Share:{async canShare(){capabilityCalls++;if(canShareError)throw canShareError;return {value:canShare};},async share(options){shares.push(options);if(shareError)throw shareError;return {};}}},
  },{
    FileReader:Reader,
    URL:{createObjectURL:()=> 'blob:score-pdf',revokeObjectURL:url=>revoked.push(url)},
    document:{createElement(tag){assert.equal(tag,'a');return {click(){downloads.push({href:this.href,download:this.download});if(browserError==='click')throw new Error('download click failed');},remove(){removed++;}};},body:{append(){if(browserError==='append')throw new Error('download append failed');}}},
    setTimeout(callback,delay){timers.push({callback,delay});},
  });
  return {save:api.savePdfBlob,writes,shares,downloads,revoked,timers,pluginChecks,reads:()=>reads,capabilityCalls:()=>capabilityCalls,removed:()=>removed};
}

test('native PDF export preserves binary bytes in Cache and shares the returned file URI',async()=>{
  const f=fixture();
  assert.equal(await f.save(pdf,'Sight-Reading-01-琵琶.pdf','琵琶'),'shared');
  assert.equal(f.writes.length,1);
  const write=f.writes[0];
  assert.equal(write.directory,'CACHE');assert.equal(write.recursive,true);
  assert.ok(write.path.endsWith('/Sight-Reading-01-琵琶.pdf'));
  assert.equal(write.encoding,undefined,'base64 must be written as binary, not UTF-8 text');
  assert.deepEqual(Buffer.from(write.data,'base64'),Buffer.from(await pdf.arrayBuffer()));
  assert.deepEqual(Array.from(f.shares[0].files),['file:///cache/export.pdf']);
  assert.equal(f.shares[0].title,'琵琶');assert.equal(f.downloads.length,0);
  await f.save(pdf,'Sight-Reading-01-琵琶.pdf','琵琶');
  assert.notEqual(f.writes[0].path,f.writes[1].path,'an outstanding shared file is never overwritten');
});

test('native plugin or sharing unavailability rejects without a silent WebView download fallback',async()=>{
  for(const options of [{available:false},{canShare:false}]){
    const f=fixture(options);
    await assert.rejects(f.save(pdf,'score.pdf','Score'),/unavailable/);
    assert.equal(f.writes.length,0);assert.equal(f.shares.length,0);assert.equal(f.downloads.length,0);
  }
});

test('each missing native plugin or failed sharing capability check stops before PDF I/O',async()=>{
  for(const missingPlugin of ['Filesystem','Share']){
    const f=fixture({missingPlugin});
    await assert.rejects(f.save(pdf,'score.pdf','Score'),/unavailable/);
    assert.equal(f.capabilityCalls(),0);assert.equal(f.reads(),0);
    assert.equal(f.writes.length,0);assert.equal(f.shares.length,0);assert.equal(f.downloads.length,0);
  }
  const failure=new Error('capability check failed'),f=fixture({canShareError:failure});
  await assert.rejects(f.save(pdf,'score.pdf','Score'),error=>error===failure);
  assert.equal(f.capabilityCalls(),1);assert.equal(f.reads(),0);
  assert.equal(f.writes.length,0);assert.equal(f.shares.length,0);assert.equal(f.downloads.length,0);
});

test('PDF read and write failures reject before opening the share sheet',async()=>{
  for(const options of [{readError:new Error('read failed')},{writeError:new Error('write failed')}]){
    const f=fixture(options);
    await assert.rejects(f.save(pdf,'score.pdf','Score'),/failed/);
    assert.equal(f.shares.length,0);assert.equal(f.downloads.length,0);
  }
});

test('aborted PDF reads and non-base64 FileReader results cannot reach native write/share',async()=>{
  for(const readMode of ['abort','invalid']){
    const f=fixture({readMode});
    await assert.rejects(f.save(pdf,'score.pdf','Score'),readMode==='abort'?/reading was canceled/:/Invalid PDF data/);
    assert.equal(f.reads(),1);assert.equal(f.writes.length,0);assert.equal(f.shares.length,0);assert.equal(f.downloads.length,0);
  }
});

test('invalid native file URIs and share failures never report success',async()=>{
  for(const options of [{uri:''},{uri:'blob:invalid'},{shareError:new Error('share failed')}]){
    const f=fixture(options);
    await assert.rejects(f.save(pdf,'score.pdf','Score'),/unavailable|failed/);
    assert.equal(f.downloads.length,0);
  }
});

test('dismissed native share sheets return cancellation distinctly from success',async()=>{
  const f=fixture({shareError:new Error('Share canceled')});
  assert.equal(await f.save(pdf,'score.pdf','Score'),'canceled');
  assert.equal(f.downloads.length,0);
});

test('native bridge cancellation objects are distinct from genuine and near-cancellation failures',async()=>{
  const canceled=fixture({shareError:{message:'Share canceled'}});
  assert.equal(await canceled.save(pdf,'score.pdf','Score'),'canceled');
  assert.equal(canceled.writes.length,1);assert.equal(canceled.shares.length,1);assert.equal(canceled.downloads.length,0);
  for(const failure of [{message:'Share canceled unexpectedly'},new Error("Can't share while sharing is in progress")]){
    const f=fixture({shareError:failure});
    await assert.rejects(f.save(pdf,'score.pdf','Score'),error=>error===failure);
    assert.equal(f.shares.length,1);assert.equal(f.downloads.length,0);
  }
});

test('web PDF exports keep the browser download and delayed URL cleanup',async()=>{
  const f=fixture({native:false,available:false});
  assert.equal(await f.save(pdf,'score.pdf','Score'),'download-started');
  assert.deepEqual(f.downloads,[{href:'blob:score-pdf',download:'score.pdf'}]);
  assert.equal(f.reads(),0);assert.equal(f.writes.length,0);assert.equal(f.shares.length,0);
  assert.equal(f.revoked.length,0);assert.equal(f.timers[0].delay,60_000);
  f.timers[0].callback();assert.deepEqual(f.revoked,['blob:score-pdf']);
});

test('web append/click failures clean up temporary anchors and URLs without native fallback',async()=>{
  for(const browserError of ['append','click']){
    const f=fixture({native:false,browserError});
    await assert.rejects(f.save(pdf,'score.pdf','Score'),/download (append|click) failed/);
    assert.deepEqual(f.revoked,['blob:score-pdf']);assert.equal(f.removed(),1);assert.equal(f.timers.length,0);
    assert.equal(f.pluginChecks.length,0);assert.equal(f.capabilityCalls(),0);assert.equal(f.reads(),0);
    assert.equal(f.writes.length,0);assert.equal(f.shares.length,0);
  }
});
