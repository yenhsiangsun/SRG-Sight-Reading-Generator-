import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {readScoreSizes,type ScoreOrientation} from '../practice/scoreLayout';
const KEY='sight-reading-score-layout-v1';
export function useScoreFocus(active:boolean){
  const [session,setSession]=useState({active,focus:false});
  // A page change starts a fresh focus session. This conditional adjustment is
  // resolved before commit, so navigation never refocuses an old score control.
  if(session.active!==active)setSession({active,focus:false});
  const entryRef=useRef<HTMLButtonElement>(null),exitRef=useRef<HTMLButtonElement>(null);
  const previousFocus=useRef(false);
  const focused=active&&session.active===active&&session.focus;
  const [orientation,setOrientation]=useState<ScoreOrientation>(()=>window.matchMedia('(orientation: portrait)').matches?'portrait':'landscape');
  const [sizes,setSizes]=useState(()=>{try{return readScoreSizes(localStorage.getItem(KEY));}catch{return readScoreSizes(null);}});
  useEffect(()=>{
    const query=window.matchMedia('(orientation: portrait)');const changed=()=>setOrientation(query.matches?'portrait':'landscape');
    query.addEventListener('change',changed);return()=>query.removeEventListener('change',changed);
  },[]);
  useLayoutEffect(()=>{
    const wasFocused=previousFocus.current;
    previousFocus.current=focused;
    // Navigation owns focus after leaving practice. Only a local toggle should
    // move between these controls, and neither transition should scroll the score.
    if(!active)return;
    if(focused)exitRef.current?.focus({preventScroll:true});
    else if(wasFocused)entryRef.current?.focus({preventScroll:true});
  },[active,focused]);
  useEffect(()=>{
    if(!focused)return;
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!event.defaultPrevented)setSession(previous=>({...previous,focus:false}));};
    window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape);
  },[focused]);
  const changeSize=(size:number)=>{
    const next=readScoreSizes(JSON.stringify({...sizes,[orientation]:size}));setSizes(next);
    try{localStorage.setItem(KEY,JSON.stringify(next));}catch{/* Layout changes still work without storage. */}
  };
  return {focus:focused,entryRef,exitRef,toggle:()=>{if(active)setSession(previous=>({active,focus:!previous.focus}));},size:sizes[orientation],changeSize};
}
