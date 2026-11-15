import { migrateSites } from '../core/storage';
import { wireShortcuts } from './shortcuts';

console.log('[omni/bg] service worker started');

wireShortcuts();

// No seeding: readStorage() fills defaults, and writing them here on a fresh
// install could overwrite settings still arriving through sync.
chrome.runtime.onInstalled.addListener(() => {
  void migrateSites();
});
