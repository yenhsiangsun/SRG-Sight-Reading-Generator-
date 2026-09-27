import {useEffect,useState} from 'react';
import {readScoreSizes,type ScoreOrientation} from '../practice/scoreLayout';
const KEY='sight-reading-score-layout-v1';
export function useScoreFocus(active:boolean){
  const [focus,setFocus]=useState(false);
  const [orientation,setOrientation]=useState<ScoreOrientation>(()=>window.matchMedia('(orientation: portrait)').matches?'portrait':'landscape');
  const [sizes,setSizes]=useState(()=>{try{return readScoreSizes(localStorage.getItem(KEY));}catch{return readScoreSizes(null);}});
  useEffect(()=>{
    const query=window.matchMedia('(orientation: portrait)');const changed=()=>setOrientation(query.matches?'portrait':'landscape');
    query.addEventListener('change',changed);return()=>query.removeEventListener('change',changed);
  },[]);
  useEffect(()=>{
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')setFocus(false);};
    window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape);
  },[]);
  const changeSize=(size:number)=>{
    const next=readScoreSizes(JSON.stringify({...sizes,[orientation]:size}));setSizes(next);
    try{localStorage.setItem(KEY,JSON.stringify(next));}catch{/* Layout changes still work without storage. */}
  };
  return {focus:active&&focus,toggle:()=>setFocus(value=>!value),size:sizes[orientation],changeSize};
}
