import {useSyncExternalStore} from 'react';
import {COMPANION_DESIGN_KEY, createCompanionDesignStore} from './companionDesign';

const store = createCompanionDesignStore(() => typeof window === 'undefined' ? undefined : window.localStorage);
function subscribe(listener: () => void) {
  const unsubscribe = store.subscribe(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === COMPANION_DESIGN_KEY || event.key === null) store.refresh();
  };
  window.addEventListener('storage', onStorage);
  return () => { unsubscribe(); window.removeEventListener('storage', onStorage); };
}
export function useCompanionDesign() {
  const design = useSyncExternalStore(subscribe, store.getSnapshot, () => 'classic' as const);
  return {design, setDesign: store.set};
}
