import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';
const {paginateScore,scorePixelRatio,PDF_PAGE}=loadModule('src/export/pdfPagination.ts');
const {tempoMark}=loadModule('src/audio/tempo.ts');

test('PDF tempo matches the current score BPM and both beat units in mixed meter',()=>{
  assert.equal(tempoMark({timeSignature:'4/4',measures:[{timeSignature:'4/4'},{timeSignature:'6/8'}]},76),'♩ = 76 · ♪ = 152');
  assert.equal(tempoMark({timeSignature:'6/8',measures:[{timeSignature:'6/8'},{timeSignature:'4/4'}]},152),'♪ = 152 · ♩ = 76');
  assert.equal(tempoMark({timeSignature:'3/4',measures:[{}]},132),'♩ = 132');
});

test('PDF pagination includes every complete system once and fits A4 margins',()=>{
  for(const count of [1,4,16,32])for(const rowHeight of [180,280,450,650]) {
    const systems=Array.from({length:count},(_,i)=>({top:i*rowHeight,bottom:(i+1)*rowHeight+(i===count-1?45:0)}));
    const pages=paginateScore({width:1000,systems});
    assert.equal(pages[0].firstSystem,0);assert.equal(pages.at(-1).lastSystem,count-1);
    let next=0;
    for(const page of pages){
      assert.equal(page.firstSystem,next);next=page.lastSystem+1;
      assert.equal(page.sourceY,systems[page.firstSystem].top);
      assert.equal(page.sourceY+page.sourceHeight,systems[page.lastSystem].bottom);
      assert.ok(page.height<=PDF_PAGE.scoreBottom-PDF_PAGE.scoreTop+1e-8);
      assert.ok(page.width<=PDF_PAGE.width-2*PDF_PAGE.margin+1e-8);
    }
  }
});

test('exceptionally tall grand-staff system scales intact; per-page canvases stay bounded',()=>{
  const page=paginateScore({width:800,systems:[{top:0,bottom:2200}]})[0];
  assert.equal(page.sourceHeight,2200);assert.equal(page.height,235);assert.ok(page.width<180);
  for(const [w,h] of [[1000,1300],[800,2200],[700,900],[1600,1800]]) {
    const ratio=scorePixelRatio(w,h);
    assert.ok(w*ratio<=4096 && h*ratio<=4096);assert.ok(w*h*ratio*ratio<=12_000_001);
  }
  assert.throws(()=>paginateScore({width:0,systems:[]}));
});
