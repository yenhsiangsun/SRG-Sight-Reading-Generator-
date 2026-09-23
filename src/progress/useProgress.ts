import {useEffect,useRef,useState} from 'react';
import {createProgress,normalizeProgress,recordPractice,redeemReward,getLevel,dayKey,unequipPet,type RewardId} from './progress';
const KEY='sight-reading-progress-v1';
export function useProgress(allowPreviewTools=false){
  const [state,setState]=useState(()=>{try{return normalizeProgress(JSON.parse(localStorage.getItem(KEY)??'null'));}catch{return createProgress();}});
  const [storageWarning,setStorageWarning]=useState(false);
  useEffect(()=>{
    let cancelled=false;
    queueMicrotask(()=>{
      if(cancelled)return;
      try{localStorage.setItem(KEY,JSON.stringify(state));setStorageWarning(false);}catch{setStorageWarning(true);}
    });
    return()=>{cancelled=true;};
  },[state]);
  useEffect(()=>{
    const refresh=()=>setState(s=>s.today.date===dayKey(new Date())?s:normalizeProgress(s));
    const timer=setInterval(refresh,60000);window.addEventListener('focus',refresh);
    return()=>{clearInterval(timer);window.removeEventListener('focus',refresh);};
  },[]);
  return {state,level:getLevel(state.xp),storageWarning,
    grantPreviewPoints:allowPreviewTools?()=>{
      if(allowPreviewTools)setState(s=>({...s,points:Math.max(s.points,10000)}));
    }:undefined,
    complete:(id:string)=>setState(s=>recordPractice(s,id).state),
    redeem:(id:RewardId)=>setState(s=>redeemReward(s,id).state),
    resetPet: ()=>setState(s=>unequipPet(s)),
  };
}
/** Self-reported practice: count foreground time on a score, never time in another tab. */
export function usePracticeClock(sessionId:string|null,enabled:boolean){
  const [display,setDisplay]=useState<{sessionId:string|null;seconds:number}>({sessionId:null,seconds:0});
  const clock=useRef<{sessionId:string|null;elapsed:number}>({sessionId:null,elapsed:0});
  useEffect(()=>{
    if(clock.current.sessionId!==sessionId)clock.current={sessionId,elapsed:0};
    if(!enabled||!sessionId)return;
    let previous=performance.now();
    const reset=()=>{previous=performance.now();};
    const timer=setInterval(()=>{
      const now=performance.now();
      if(!document.hidden){
        clock.current.elapsed=Math.min(60000,clock.current.elapsed+Math.max(0,Math.min(1500,now-previous)));
        const seconds=Math.floor(clock.current.elapsed/1000);
        setDisplay(value=>value.sessionId===sessionId&&value.seconds===seconds?value:{sessionId,seconds});
      }
      previous=now;
    },500);
    document.addEventListener('visibilitychange',reset);
    return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',reset);};
  },[sessionId,enabled]);
  // A new score immediately displays zero, before its effect resets the clock.
  return display.sessionId===sessionId?display.seconds:0;
}
