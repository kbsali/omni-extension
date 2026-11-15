import { modules } from '../core/registry';
import { writeStorage, onStorageChange, DEFAULT_STORAGE, STORAGE_KEY } from '../core/storage';
import { wireShortcuts } from './shortcuts';
import type { BackgroundCtx, OmniStorage } from '../core/types';

console.log('[omni/bg] service worker started');

async function ensureDefaults(): Promise<OmniStorage> {
  const stored = (await chrome.storage.sync.get(STORAGE_KEY))[STORAGE_KEY] as
    OmniStorage | undefined;
  if (stored) return stored;
  console.log('[omni/bg] seeding default storage');
  await writeStorage(DEFAULT_STORAGE);
  return DEFAULT_STORAGE;
}

const ctx: BackgroundCtx = {
  getStorage: ensureDefaults,
  onStorageChange,
};

for (const mod of modules) {
  mod.onBackground?.(ctx);
}

wireShortcuts();

chrome.runtime.onInstalled.addListener(() => {
  console.log('[omni/bg] onInstalled fired');
  void ensureDefaults();
});
