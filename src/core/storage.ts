import type { OmniStorage } from './types';

const STORAGE_KEY = 'omni';

export const DEFAULT_STORAGE: OmniStorage = {
  version: 1,
  modules: {
    dark: {
      defaultMode: 'light',
      brightness: 1.0,
      sites: {},
    },
  },
};

export async function readStorage(): Promise<OmniStorage> {
  const result = await chrome.storage.sync.get(STORAGE_KEY);
  return (result[STORAGE_KEY] as OmniStorage | undefined) ?? DEFAULT_STORAGE;
}

export async function writeStorage(storage: OmniStorage): Promise<void> {
  await chrome.storage.sync.set({ [STORAGE_KEY]: storage });
}

export function onStorageChange(
  cb: (next: OmniStorage, prev: OmniStorage) => void,
): void {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'sync') return;
    const change = changes[STORAGE_KEY];
    if (!change) return;
    cb(change.newValue as OmniStorage, change.oldValue as OmniStorage);
  });
}
