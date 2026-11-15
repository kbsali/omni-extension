import { COOKIES_DEFAULTS } from '../modules/cookies/storage';
import { DARK_DEFAULTS } from '../modules/dark/storage';
import { EMOJI_DEFAULTS } from '../modules/emoji/storage';
import type { DarkStorage, OmniStorage } from './types';

export const STORAGE_KEY = 'omni';
// The dark per-site map grows with use: it lives in storage.local (10 MB) on
// this device, not in the 8 KB sync item with the rest of the settings.
export const SITES_KEY = 'omni.darkSites';

export const DEFAULT_STORAGE: OmniStorage = {
  version: 1,
  modules: {
    dark: { ...DARK_DEFAULTS },
    cookies: { ...COOKIES_DEFAULTS },
    emoji: { ...EMOJI_DEFAULTS },
  },
};

type StoredOmni = { modules?: Partial<OmniStorage['modules']> } | undefined;
type Sites = DarkStorage['sites'];

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

// Until a device has local sites, the ones an older version kept in the sync
// item still apply; the first write moves them to storage.local.
export async function readStorage(): Promise<OmniStorage> {
  const [synced, local] = await Promise.all([
    chrome.storage.sync.get(STORAGE_KEY),
    chrome.storage.local.get(SITES_KEY),
  ]);
  const storage = withDefaults(synced[STORAGE_KEY] as StoredOmni);
  const sites = local[SITES_KEY] as Sites | undefined;
  if (!sites) return storage;
  return {
    ...storage,
    modules: { ...storage.modules, dark: { ...storage.modules.dark, sites } },
  };
}

export async function writeStorage(storage: OmniStorage): Promise<void> {
  const { sites, ...dark } = storage.modules.dark;
  await Promise.all([
    chrome.storage.sync.set({
      [STORAGE_KEY]: { ...storage, modules: { ...storage.modules, dark } },
    }),
    chrome.storage.local.set({ [SITES_KEY]: sites }),
  ]);
}

// Copies the sites an older version synced into storage.local, without
// removing them from sync, so every device migrates its own copy.
// ponytail: a device that updates after another one already wrote (and so
// dropped the synced sites) starts with an empty site list.
export async function migrateSites(): Promise<void> {
  const local = await chrome.storage.local.get(SITES_KEY);
  if (local[SITES_KEY]) return;
  const synced = await chrome.storage.sync.get(STORAGE_KEY);
  const sites = (synced[STORAGE_KEY] as StoredOmni)?.modules?.dark?.sites;
  if (sites) await chrome.storage.local.set({ [SITES_KEY]: sites });
}

// Re-reads both areas on a change to either, so callers always get the
// whole state.
export function onStorageChange(cb: (next: OmniStorage) => void): void {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    const relevant =
      (areaName === 'sync' && STORAGE_KEY in changes) ||
      (areaName === 'local' && SITES_KEY in changes);
    if (relevant) void readStorage().then(cb);
  });
}
