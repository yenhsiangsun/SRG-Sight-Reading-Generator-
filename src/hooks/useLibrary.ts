import {useState} from 'react';
import {LIBRARY_KEY, addStudy, emptyLibrary, readLibrary, type Library, type SavedStudy} from '../practice/library';

export function useLibrary() {
  const [library, setLibrary] = useState(() => {
    try { return readLibrary(localStorage.getItem(LIBRARY_KEY)); } catch { return emptyLibrary(); }
  });
  const [message, setMessage] = useState<'savedStudy' | 'savedPreset' | 'libraryFull' | 'libraryError' | null>(null);
  function write(next: Library, success: 'savedStudy' | 'savedPreset' = 'savedStudy') {
    try { localStorage.setItem(LIBRARY_KEY, JSON.stringify(next)); setLibrary(next); setMessage(success); return true; }
    catch { setMessage('libraryError'); return false; }
  }
  function save(study: Omit<SavedStudy,'id'|'created'>, kind: 'scores' | 'presets') {
    try {
      const entry = {...study, id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`, created: Date.now()};
      return write(addStudy(library, entry, kind), kind==='scores'?'savedStudy':'savedPreset');
    } catch { setMessage('libraryFull'); return false; }
  }
  function remove(id: string, kind: 'scores' | 'presets') {
    if (write({...library,[kind]:library[kind].filter(item=>item.id!==id)})) setMessage(null);
  }
  return {library, message, save, remove, clearMessage:()=>setMessage(null)};
}
