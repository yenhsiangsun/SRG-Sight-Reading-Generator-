import {useState} from 'react';
import {isStudioPaletteId,STUDIO_PALETTE_KEY,type StudioPaletteId} from '../theme/studioPalettes';

export function useStudioPalette(){
  const [id,setId]=useState<StudioPaletteId>(()=>{
    try{const saved=localStorage.getItem(STUDIO_PALETTE_KEY);return isStudioPaletteId(saved)?saved:'wood';}
    catch{return 'wood';}
  });
  const [warning,setWarning]=useState(false);
  function change(next:StudioPaletteId){
    if(!isStudioPaletteId(next))return;
    setId(next);
    try{localStorage.setItem(STUDIO_PALETTE_KEY,next);setWarning(false);}
    catch{setWarning(true);}
  }
  return {id,change,warning};
}
