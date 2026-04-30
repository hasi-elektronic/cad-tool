import { useSyncExternalStore } from 'react';
import { store } from './store';
import type { AppState } from './store';

export function useStore<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(
    (cb) => store.subscribe(cb),
    () => selector(store.get()),
    () => selector(store.get()),
  );
}

export { store };
