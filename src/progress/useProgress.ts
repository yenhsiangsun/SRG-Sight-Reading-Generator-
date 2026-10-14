import {useCallback,useEffect,useRef,useState} from 'react';
import {createProgress,normalizeProgress,recordPractice,redeemReward,getLevel,dayKey,unequipPet,type RewardId,type PetCompanion} from './progress';
import {recordCompanionPractice,selectCompanionStage,type CompanionStage} from './companionGrowth';
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
  const addPracticeTime=useCallback((pet:PetCompanion|null,seconds:number)=>setState(s=>recordCompanionPractice(s,pet,seconds)),[]);
  const selectStage=useCallback((pet:PetCompanion|null,stage:CompanionStage|null)=>setState(s=>selectCompanionStage(s,pet,stage)),[]);
  return {state,level:getLevel(state.xp),storageWarning,
    addPracticeTime,selectStage,
    grantPreviewPoints:allowPreviewTools?()=>{
      if(allowPreviewTools)setState(s=>({...s,points:Math.max(s.points,10000)}));
    }:undefined,
    complete:(id:string)=>setState(s=>recordPractice(s,id).state),
    redeem:(id:RewardId)=>setState(s=>redeemReward(s,id).state),
    resetPet: ()=>setState(s=>unequipPet(s)),
  };
}
/** Self-reported practice: count foreground time on a score, never time in another tab. */
export function usePracticeClock(sessionId:string|null,enabled:boolean,onElapsed?:(seconds:number)=>void){
  const [display,setDisplay]=useState<{sessionId:string|null;seconds:number}>({sessionId:null,seconds:0});
  const clock=useRef<{sessionId:string|null;elapsed:number}>({sessionId:null,elapsed:0});
  useEffect(()=>{
    if(clock.current.sessionId!==sessionId)clock.current={sessionId,elapsed:0};
    if(!enabled||!sessionId)return;
    let previous=performance.now(),visible=!document.hidden;
    const flush=(countForeground:boolean)=>{
      const now=performance.now();
      // A suspended device may resume with a long timer gap. Count at most the
      // normal timer tolerance, never all of that unattended sleep time.
      const elapsed=countForeground?Math.max(0,Math.min(1500,now-previous)):0;
      previous=now;
      if(elapsed>0){
        clock.current.elapsed=Math.min(60000,clock.current.elapsed+elapsed);
        const seconds=Math.floor(clock.current.elapsed/1000);
        setDisplay(value=>value.sessionId===sessionId&&value.seconds===seconds?value:{sessionId,seconds});
        // Companion growth continues after the 60-second completion display.
        onElapsed?.(elapsed/1000);
      }
    };
    const visibilityChanged=()=>{flush(visible);visible=!document.hidden;};
    const timer=setInterval(()=>flush(visible&&!document.hidden),500);
    document.addEventListener('visibilitychange',visibilityChanged);
    return()=>{
      clearInterval(timer);
      document.removeEventListener('visibilitychange',visibilityChanged);
      flush(visible&&!document.hidden);
    };
  },[sessionId,enabled,onElapsed]);
  // A new score immediately displays zero, before its effect resets the clock.
  return display.sessionId===sessionId?display.seconds:0;
}
