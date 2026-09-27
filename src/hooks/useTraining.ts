import {useCallback,useRef,useState} from 'react';
import {TRAINING_KEY,readTraining,recordTraining} from '../practice/training';

export function useTraining(){
  const [history,setHistory]=useState(()=>{try{return readTraining(localStorage.getItem(TRAINING_KEY));}catch{return [];}});
  const [storageWarning,setStorageWarning]=useState(false);
  const latest=useRef(history);
  const record=useCallback((...args:Parameters<typeof recordTraining> extends [unknown,...infer Rest]?Rest:never)=>{
    const next=recordTraining(latest.current,...args);
    if(next===latest.current)return;
    latest.current=next;setHistory(next);
    try{localStorage.setItem(TRAINING_KEY,JSON.stringify(next));setStorageWarning(false);}catch{setStorageWarning(true);}
  },[]);
  return {history,record,storageWarning};
}
