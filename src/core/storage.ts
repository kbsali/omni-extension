import type { OmniStorage } from './types';
import { COOKIES_DEFAULTS } from '../modules/cookies/storage';
import { DARK_DEFAULTS } from '../modules/dark/storage';
import { EMOJI_DEFAULTS } from '../modules/emoji/storage';

export const STORAGE_KEY = 'omni';

export const DEFAULT_STORAGE: OmniStorage = {
  version: 1,
  modules: {
    dark: { ...DARK_DEFAULTS },
    cookies: { ...COOKIES_DEFAULTS },
    emoji: { ...EMOJI_DEFAULTS },
  },
};

export async function readStorage(): Promise<OmniStorage> {
  const result = await chrome.storage.sync.get(STORAGE_KEY);
  return (result[STORAGE_KEY] as OmniStorage | undefined) ?? DEFAULT_STORAGE;
}

export async function writeStorage(storage: OmniStorage): Promise<void> {
  await chrome.storage.sync.set({ [STORAGE_KEY]: storage });
}

// A cleared key (storage wiped) reports newValue undefined: fall back to defaults.
export function onStorageChange(cb: (next: OmniStorage) => void): void {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'sync') return;
    const change = changes[STORAGE_KEY];
    if (!change) return;
    cb((change.newValue as OmniStorage | undefined) ?? DEFAULT_STORAGE);
  });
}
