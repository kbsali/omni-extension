import { buildDarkCss, STYLE_ELEMENT_ID } from './css';
import { extractETLD1 } from '../../core/domain';
import { resolveMode } from './service';
import { DEFAULT_STORAGE, STORAGE_KEY, onStorageChange } from '../../core/storage';
import type { OmniStorage } from '../../core/types';

// Runs on every page: no console output here, it would land in the site's console.

export function applyDarkFilter(brightness: number): void {
  document.documentElement.style.setProperty('--omni-brightness', String(brightness));
  if (document.getElementById(STYLE_ELEMENT_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ELEMENT_ID;
  style.textContent = buildDarkCss();
  (document.head ?? document.documentElement).appendChild(style);
}

export function removeDarkFilter(): void {
  document.getElementById(STYLE_ELEMENT_ID)?.remove();
  document.documentElement.style.removeProperty('--omni-brightness');
}

function reconcileFromStorage(storage: OmniStorage): void {
  const domain = extractETLD1(location.href);
  if (!domain) return;
  const mode = resolveMode(storage, domain);
  if (mode === 'dark') {
    applyDarkFilter(storage.modules.dark.brightness);
  } else {
    removeDarkFilter();
  }
}

// Side-effect setup, runs at document_start in real Chrome. The thenable check
// skips it under sinon-chrome, whose stubbed get() returns undefined.
if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
  const initial = chrome.storage.sync.get(STORAGE_KEY) as unknown;
  if (initial && typeof (initial as Promise<unknown>).then === 'function') {
    void (initial as Promise<Record<string, OmniStorage | undefined>>).then((result) => {
      reconcileFromStorage(result[STORAGE_KEY] ?? DEFAULT_STORAGE);
    });
  }
  onStorageChange(reconcileFromStorage);
}
