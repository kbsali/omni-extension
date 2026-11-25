import { migrateSites } from '../core/storage';
import { wireShortcuts } from './shortcuts';

console.log('[omni/bg] service worker started');

wireShortcuts();

// No seeding: readStorage() fills defaults, and writing them here on a fresh
// install could overwrite settings still arriving through sync.
chrome.runtime.onInstalled.addListener(() => {
  void migrateSites();
  void injectIntoOpenTabs();
});

// Chrome injects content scripts only into pages loaded after an install,
// update or reload: without this, dark mode does nothing in the tabs already
// open until each one is reloaded.
async function injectIntoOpenTabs(): Promise<void> {
  const scripts = chrome.runtime.getManifest().content_scripts ?? [];
  const files = scripts.flatMap((s) => s.js ?? []);
  const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
  await Promise.all(
    tabs.map((tab) =>
      tab.id === undefined
        ? null
        : chrome.scripting
            .executeScript({ target: { tabId: tab.id }, files })
            // Pages Chrome keeps off limits (web store, error pages) refuse.
            .catch(() => null)
    )
  );
}
