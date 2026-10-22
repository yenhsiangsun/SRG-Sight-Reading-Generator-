import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import * as jsxRuntime from 'react/jsx-runtime';
import {loadModule} from './helpers.mjs';

const file='src/components/SetupPage.tsx';
const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS}}).outputText;
const instruments=[{name:'Piano',zh:'鋼琴',family:'鍵盤',clef:'grand',min:21,max:108},{name:'Pipa',zh:'琵琶',family:'國樂・彈撥',clef:'treble',min:45,max:88}];
function mount(overrides={}){
  const states=[];let cursor=0,starts=0;
  const settings={instrument:'Piano',difficulty:'Beginner',rhythmLevel:'Simple',rangeMinMidi:48,rangeMaxMidi:84,clef:'grand',measureCount:8,timeSignature:'4/4',allowedKeySignatures:['C'],mixedMeters:false,meters:['4/4'],performanceMarks:true,allowAccidentals:false,...overrides};
  const react={useState(initial){const i=cursor++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return[states[i],v=>{states[i]=typeof v==='function'?v(states[i]):v;}];},useRef:()=>({current:null}),useEffect(){},useId:()=>`field-${cursor++}`};
  const Component=loadModule(file,1,source,{
    react,'react/jsx-runtime':jsxRuntime,'../hooks/useStudioMotion':{useSetupStepMotion(){}},'../hooks/useCompactScreen':{useCompactScreen:()=>false},'../i18n/context':{useI18n:()=>({locale:'en',t:k=>k})},'../progress/words':{words:(_l,_z,e)=>e},'../i18n/musicLabels':{instrumentLabel:n=>n},'../music/instruments':{INSTRUMENT_LIST:instruments,INSTRUMENTS:Object.fromEntries(instruments.map(i=>[i.name,i]))},'../exerciseConfig':{CLEFS:['treble','grand'],TIME_SIGNATURES:['4/4','6/8'],RANGE_OPTIONS:[48,60,72,84],midiToNoteLabel:String},'./StaffRangePicker':{StaffRangePicker:()=>null},'./InstrumentArtwork':{InstrumentArtwork:()=>null},'./KeySignaturePicker':{KeySignaturePicker:()=>null},'./MixedClefPicker':{MixedClefPicker:()=>null},'./InstrumentSelection.css':{},'./SetupWizard.css':{},
  }).default;
  return{settings,get starts(){return starts;},render(){cursor=0;return Component({settings,change:(key,value)=>{settings[key]=value;},onStart:()=>starts++,error:''});}};
}
function nodes(n){if(!n||typeof n!=='object')return[];if(Array.isArray(n))return n.flatMap(nodes);return[n,...nodes(n.props?.children)];}
const find=(tree,p)=>nodes(tree).find(p);
const button=(app,key)=>find(app.render(),n=>n.type==='button'&&n.props.children===key);
const next=app=>button(app,'next').props.onClick();
const back=app=>button(app,'previous').props.onClick();
const current=app=>find(app.render(),n=>n.type==='li'&&n.props['aria-current']==='step');

test('four progress items are noninteractive and Next/Back follow the full sequence',()=>{
  const app=mount();const status=find(app.render(),n=>n.type==='ol'&&n.props.className.includes('setup-step-list'));
  const steps=nodes(status).filter(n=>n.type==='li');assert.equal(steps.length,4);
  assert.ok(steps.every(n=>!n.props.onClick&&n.props.tabIndex===undefined));assert.equal(button(app,'previous').props.disabled,true);
  const seen=[];for(let i=0;i<4;i++){seen.push(current(app).props.children[0].props.children);if(i<3){assert.equal(button(app,'start'),undefined);next(app);}}
  assert.deepEqual(seen,['01','02','03','04']);assert.equal(app.starts,0);assert.ok(button(app,'start'));
  back(app);assert.equal(current(app).props.children[0].props.children,'03');assert.ok(button(app,'next'));assert.equal(button(app,'start'),undefined);
});

test('instrument, range, difficulty, rhythm and key choices survive navigating back and forward',()=>{
  const app=mount();find(app.render(),n=>n.type==='button'&&n.props.className?.includes('instrument-card ')&&n.props.children.some?.(x=>x?.props?.children==='Pipa')).props.onClick();
  next(app);const range=find(app.render(),n=>n.props?.onMin&&n.props?.onMax);range.props.onMin(48);range.props.onMax(72);next(app);
  find(app.render(),n=>n.type==='button'&&n.props.className==='difficulty-card '&&nodes(n).some(x=>x.type==='strong'&&x.props.children==='advanced')).props.onClick();
  find(app.render(),n=>n.props?.label==='rhythm').props.onChange('Complex');find(app.render(),n=>n.props?.value===app.settings.allowedKeySignatures).props.onChange(['G','F']);
  next(app);back(app);assert.equal(app.settings.instrument,'Pipa');assert.equal(app.settings.rangeMinMidi,48);assert.equal(app.settings.rangeMaxMidi,72);assert.equal(app.settings.difficulty,'Advanced');assert.equal(app.settings.rhythmLevel,'Complex');assert.deepEqual(app.settings.allowedKeySignatures,['G','F']);assert.equal(app.starts,0);
});

test('mixed-meter validation blocks only the final start action and can be corrected there',()=>{
  const app=mount({mixedMeters:true,meters:['4/4']});next(app);next(app);next(app);assert.equal(button(app,'start').props.disabled,true);
  find(app.render(),n=>n.type==='button'&&n.props.children==='6/8').props.onClick();assert.equal(button(app,'start').props.disabled,false);button(app,'start').props.onClick();assert.equal(app.starts,1);
});
