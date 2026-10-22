import {useState} from 'react';
import {LIBRARY_KEY, addStudy, emptyLibrary, readLibraryResult, validStudy, type Library, type LibraryMessage, type SavedStudy} from '../practice/library';

export function useLibrary() {
  const [initial] = useState(() => {
    try { return {...readLibraryResult(localStorage.getItem(LIBRARY_KEY)),storageError:false}; }
    catch { return {library:emptyLibrary(),unreadable:false,storageError:true}; }
  });
  const [library, setLibrary] = useState(initial.library);
  const [readProtected, setReadProtected] = useState(initial.unreadable||initial.storageError);
  const [message, setMessage] = useState<LibraryMessage | null>(initial.storageError?'libraryError':null);
  // A different tab may have saved or removed entries since this hook mounted.
  // Apply each action to the latest validated save, never merge a stale snapshot.
  function writableLibrary(): Library | undefined {
    if (readProtected) return;
    try {
      const latest = readLibraryResult(localStorage.getItem(LIBRARY_KEY));
      if (latest.unreadable) {
        setReadProtected(true);
        return;
      }
      return latest.library;
    } catch { setMessage('libraryError'); }
  }
  function write(next: Library, success: 'savedStudy' | 'savedPreset' = 'savedStudy') {
    try { localStorage.setItem(LIBRARY_KEY, JSON.stringify(next)); setLibrary(next); setMessage(success); return true; }
    catch { setMessage('libraryError'); return false; }
  }
  function save(study: Omit<SavedStudy,'id'|'created'>, kind: 'scores' | 'presets') {
    const latest = writableLibrary();
    if (!latest) return false;
    try {
      const entry = {...study, id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`, created: Date.now()};
      if (!validStudy(entry,kind==='scores')) { setMessage('libraryInvalidScore'); return false; }
      return write(addStudy(latest, entry, kind), kind==='scores'?'savedStudy':'savedPreset');
    } catch (error) { setMessage(error instanceof Error && error.message === 'libraryFull' ? 'libraryFull' : 'libraryError'); return false; }
  }
  function remove(id: string, kind: 'scores' | 'presets') {
    const latest = writableLibrary();
    if (!latest) return;
    if (write({...latest,[kind]:latest[kind].filter(item=>item.id!==id)})) setMessage(null);
  }
  return {library, message:initial.storageError?'libraryReadUnavailable' as const:readProtected?'libraryReadProtected' as const:message, readProtected, save, remove, clearMessage:()=>setMessage(null)};
}
