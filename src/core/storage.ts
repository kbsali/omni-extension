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

type StoredOmni = { modules?: Partial<OmniStorage['modules']> } | undefined;

// Fills modules and fields missing from what an older version stored.
export function withDefaults(stored: StoredOmni): OmniStorage {
  const m = stored?.modules;
  return {
    version: 1,
    modules: {
      dark: { ...DEFAULT_STORAGE.modules.dark, ...m?.dark },
      cookies: { ...DEFAULT_STORAGE.modules.cookies, ...m?.cookies },
      emoji: { ...DEFAULT_STORAGE.modules.emoji, ...m?.emoji },
    },
  };
}

export async function readStorage(): Promise<OmniStorage> {
  const result = await chrome.storage.sync.get(STORAGE_KEY);
  return withDefaults(result[STORAGE_KEY] as StoredOmni);
}

// ponytail: the whole state is 1 sync item, capped at 8 KB (QUOTA_BYTES_PER_ITEM);
// the dark `sites` map hits it after roughly 250 sites and set() then rejects.
// Upgrade path: move `sites` to storage.local, or shard it over several sync keys.
export async function writeStorage(storage: OmniStorage): Promise<void> {
  await chrome.storage.sync.set({ [STORAGE_KEY]: storage });
}

export function onStorageChange(cb: (next: OmniStorage) => void): void {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'sync') return;
    const change = changes[STORAGE_KEY];
    if (!change) return;
    cb(withDefaults(change.newValue as StoredOmni));
  });
}
