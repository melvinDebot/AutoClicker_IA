import { Storage } from 'expo-sqlite/kv-store';
import { useSyncExternalStore } from 'react';

import { parseSettings } from '@/engine/settings';
import type { Settings } from '@/engine/types';

const KEY = 'settings.v1';
const listeners = new Set<() => void>();
let cache: Settings = parseSettings(Storage.getItemSync(KEY));

export function getSettings(): Settings {
  return cache;
}

export function updateSettings(patch: Partial<Settings>): void {
  cache = parseSettings(JSON.stringify({ ...cache, ...patch }));
  Storage.setItemSync(KEY, JSON.stringify(cache));
  listeners.forEach((l) => l());
}

export function resetSettings(): void {
  Storage.removeItemSync(KEY);
  cache = parseSettings(null);
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, getSettings, getSettings);
}
