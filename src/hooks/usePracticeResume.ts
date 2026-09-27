import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {createResumeStore, type LastPractice} from '../practice/resume';
import type {SavedStudy} from '../practice/library';

export function usePracticeResume(study: Omit<SavedStudy, 'created'> | null, active: boolean, getPosition: () => number) {
  const store = useMemo(() => createResumeStore(() => window.localStorage), []);
  const [last, setLast] = useState(() => store.read());
  const [storageWarning, setStorageWarning] = useState(false);
  const written = useRef('');
  const created = useRef({id: last?.study.id, at: last?.study.created ?? 0});
  const capture = useCallback(() => {
    if (!study || !active) return;
    if (created.current.id !== study.id) created.current = {id: study.id, at: Date.now()};
    const snapshot: LastPractice = {version: 1, study: {...study, created: created.current.at}, position: Math.round(getPosition() * 100) / 100};
    const signature = JSON.stringify(snapshot);
    if (signature === written.current) return;
    const saved = store.write(snapshot);
    if (saved) written.current = signature;
    setStorageWarning(!saved);
    // Even with blocked storage, returning to the home screen can resume this session.
    setLast(snapshot);
  }, [study, active, getPosition, store]);
  useEffect(() => {
    if (!active || !study) return;
    capture();
    const timer = window.setInterval(capture, 1000);
    window.addEventListener('pagehide', capture);
    document.addEventListener('visibilitychange', capture);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('pagehide', capture);
      document.removeEventListener('visibilitychange', capture);
    };
  }, [active, study, capture]);
  return {last, capture, storageWarning};
}
