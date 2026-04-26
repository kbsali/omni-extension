import { modules } from '../core/registry';
import { readStorage, writeStorage, onStorageChange, DEFAULT_STORAGE } from '../core/storage';
import { wireShortcuts } from './shortcuts';
import type { BackgroundCtx, OmniStorage } from '../core/types';

console.log('[omni/bg] service worker started');

async function ensureDefaults(): Promise<OmniStorage> {
  const existing = await readStorage();
  // readStorage returns the literal DEFAULT_STORAGE reference when storage is empty.
  // This identity check is intentional — do not change readStorage to return a copy
  // without also updating this condition.
  if (existing === DEFAULT_STORAGE) {
    console.log('[omni/bg] seeding default storage');
    await writeStorage(DEFAULT_STORAGE);
  }
  return existing;
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
