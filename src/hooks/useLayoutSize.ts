import {useState} from 'react';

export const layoutSizes=['compact','standard','comfortable'] as const;
export type LayoutSize=typeof layoutSizes[number];
const storageKey='sight-reading-layout-v1';
export function useLayoutSize(){
  const [size,setSize]=useState<LayoutSize>(()=>{
    try {const saved=localStorage.getItem(storageKey);return layoutSizes.includes(saved as LayoutSize)?saved as LayoutSize:'compact';}
    catch{return 'compact';}
  });
  const [warning,setWarning]=useState(false);
  function change(next:LayoutSize){
    setSize(next);
    try{localStorage.setItem(storageKey,next);setWarning(false);}catch{setWarning(true);}
  }
  return {size,change,warning};
}
