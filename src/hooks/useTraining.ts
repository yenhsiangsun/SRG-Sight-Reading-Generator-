import {useCallback,useRef,useState} from 'react';
import {TRAINING_KEY,readTrainingResult,recordTraining} from '../practice/training';

export function useTraining(){
  const [initial]=useState(()=>{
    try{const raw=localStorage.getItem(TRAINING_KEY),saved=readTrainingResult(raw);return {history:saved.history,readProtected:saved.unreadable,raw};}
    catch{return {history:[],readProtected:true,raw:null};}
  });
  const [history,setHistory]=useState(initial.history);
  const [storageIssue,setStorageIssue]=useState<'unavailable'|'conflict'|null>(initial.readProtected?'unavailable':null);
  const latest=useRef(history);
  const expectedRaw=useRef(initial.raw);
  const record=useCallback((...args:Parameters<typeof recordTraining> extends [unknown,...infer Rest]?Rest:never)=>{
    const next=recordTraining(latest.current,...args);
    if(next===latest.current)return;
    latest.current=next;setHistory(next);
    // An unreadable initial save must survive this visit. Keep new results
    // in memory until a fresh mount can read the existing history safely.
    if(initial.readProtected)return;
    try{
      const raw=JSON.stringify(next);
      // Do not replace a save changed since this mount's last successful write.
      if(localStorage.getItem(TRAINING_KEY)!==expectedRaw.current){setStorageIssue('conflict');return;}
      localStorage.setItem(TRAINING_KEY,raw);expectedRaw.current=raw;setStorageIssue(null);
    }catch{setStorageIssue('unavailable');}
  },[initial.readProtected]);
  return {history,record,storageWarning:storageIssue!==null,storageConflict:storageIssue==='conflict'};
}
