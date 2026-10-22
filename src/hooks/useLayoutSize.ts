import {useState} from 'react';

export const layoutSizes=['compact','standard','comfortable'] as const;
export type LayoutSize=typeof layoutSizes[number];
export const textSizes=['auto','standard','large','extra-large'] as const;
export type TextSize=typeof textSizes[number];
const storageKey='sight-reading-layout-v1';
const textStorageKey='tonecraft-text-size-v1';
export function useLayoutSize(){
  const [size,setSize]=useState<LayoutSize>(()=>{
    try {const saved=localStorage.getItem(storageKey);return layoutSizes.includes(saved as LayoutSize)?saved as LayoutSize:'compact';}
    catch{return 'compact';}
  });
  const [textSize,setTextSize]=useState<TextSize>(()=>{
    try {const saved=localStorage.getItem(textStorageKey);return textSizes.includes(saved as TextSize)?saved as TextSize:'auto';}
    catch{return 'auto';}
  });
  const [layoutWarning,setLayoutWarning]=useState(false);
  const [textWarning,setTextWarning]=useState(false);
  function change(next:LayoutSize){
    if(!layoutSizes.includes(next))return;
    setSize(next);
    try{localStorage.setItem(storageKey,next);setLayoutWarning(false);}catch{setLayoutWarning(true);}
  }
  function changeText(next:TextSize){
    if(!textSizes.includes(next))return;
    setTextSize(next);
    try{localStorage.setItem(textStorageKey,next);setTextWarning(false);}catch{setTextWarning(true);}
  }
  return {size,change,textSize,changeText,warning:layoutWarning||textWarning};
}
