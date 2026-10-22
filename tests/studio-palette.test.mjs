import test from 'node:test';
import assert from 'node:assert/strict';
import {loadModule} from './helpers.mjs';

const palettes=loadModule('src/theme/studioPalettes.ts');
function contrast(a,b){
  const luminance=hex=>hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
  const values=[luminance(a),luminance(b)].sort((x,y)=>x-y);return(values[1]+.05)/(values[0]+.05);
}
test('all four curated colorways keep normal text and button labels readable',()=>{
  assert.deepEqual([...palettes.STUDIO_PALETTE_IDS],['wood','linen','blue','forest']);
  for(const id of palettes.STUDIO_PALETTE_IDS){
    const s=palettes.studioPaletteStyle(id);
    for(const ink of ['--theme-text','--theme-muted','--theme-primary-ink'])
      for(const paper of ['--theme-surface','--theme-soft','--theme-accent-soft'])assert.ok(contrast(s[ink],s[paper])>=4.5,`${id}: ${ink} on ${paper}`);
    for(const [ink,paper] of [['--theme-page-text','--theme-background'],['--theme-page-muted','--theme-background'],['--theme-primary-text','--theme-primary']])assert.ok(contrast(s[ink],s[paper])>=4.5,`${id}: ${ink}`);
  }
});
function mount(saved=null,failWrites=false){
  const slots=[];let cursor=0;const writes=[];
  const react={useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],v=>{slots[i]=v;}];}};
  const storage={getItem:key=>key===palettes.STUDIO_PALETTE_KEY?saved:null,setItem(key,value){if(failWrites)throw Error('unavailable');writes.push([key,value]);saved=value;}};
  const {useStudioPalette}=loadModule('src/hooks/useStudioPalette.ts',1,undefined,{react},{localStorage:storage});
  function PaletteHookHarness(){return useStudioPalette();}
  return{render(){cursor=0;return PaletteHookHarness();},writes,get saved(){return saved;}};
}
test('only preset IDs are restored and a chosen preset persists without changing other storage',()=>{
  for(const invalid of [null,'#ffffff','midnight','{"primary":"red"}','toString']){
    const h=mount(invalid);assert.equal(h.render().id,'wood');assert.equal(h.writes.length,0);
    h.render().change('#abcdef');assert.equal(h.writes.length,0);
  }
  const h=mount();h.render().change('blue');assert.equal(h.render().id,'blue');
  assert.deepEqual(h.writes,[[palettes.STUDIO_PALETTE_KEY,'blue']]);assert.equal(mount(h.saved).render().id,'blue');
});
test('an unavailable preference save still changes this visit without overwriting anything',()=>{
  const h=mount('forest',true);h.render().change('linen');assert.equal(h.render().id,'linen');assert.equal(h.render().warning,true);assert.equal(h.writes.length,0);
});
