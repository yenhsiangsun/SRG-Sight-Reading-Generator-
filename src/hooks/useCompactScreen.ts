import { useEffect, useState } from 'react';
export function useCompactScreen() {
  const [compact,setCompact]=useState(()=>window.matchMedia('(max-width: 600px)').matches);
  useEffect(()=>{const query=window.matchMedia('(max-width: 600px)');const change=()=>setCompact(query.matches);query.addEventListener('change',change);return()=>query.removeEventListener('change',change);},[]);
  return compact;
}
