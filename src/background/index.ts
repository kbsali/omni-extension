import { writeStorage, DEFAULT_STORAGE, STORAGE_KEY } from '../core/storage';
import { wireShortcuts } from './shortcuts';

console.log('[omni/bg] service worker started');

// Raw read: readStorage() would mask a missing key with DEFAULT_STORAGE.
async function ensureDefaults(): Promise<void> {
  const stored = (await chrome.storage.sync.get(STORAGE_KEY))[STORAGE_KEY];
  if (stored) return;
  console.log('[omni/bg] seeding default storage');
  await writeStorage(DEFAULT_STORAGE);
}

wireShortcuts();

chrome.runtime.onInstalled.addListener(() => {
  console.log('[omni/bg] onInstalled fired');
  void ensureDefaults();
});
