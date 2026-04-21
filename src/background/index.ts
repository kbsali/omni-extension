import { modules } from '../core/registry';
import { readStorage, writeStorage, onStorageChange, DEFAULT_STORAGE } from '../core/storage';
import type { BackgroundCtx, OmniStorage } from '../core/types';

async function ensureDefaults(): Promise<OmniStorage> {
  const existing = await readStorage();
  if (existing === DEFAULT_STORAGE) {
    await writeStorage(DEFAULT_STORAGE);
    return DEFAULT_STORAGE;
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

chrome.runtime.onInstalled.addListener(() => {
  void ensureDefaults();
});
