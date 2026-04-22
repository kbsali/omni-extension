import { buildDarkCss, STYLE_ELEMENT_ID } from './css';
import { extractETLD1 } from '../../core/domain';
import { resolveMode } from './service';
import { DEFAULT_STORAGE } from '../../core/storage';
import type { OmniStorage } from '../../core/types';

console.log('[omni/dark/content] script loaded on', location.href);

export function applyDarkFilter(brightness: number): void {
  document.documentElement.style.setProperty('--omni-brightness', String(brightness));
  if (document.getElementById(STYLE_ELEMENT_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ELEMENT_ID;
  style.textContent = buildDarkCss();
  (document.head ?? document.documentElement).appendChild(style);
  console.log('[omni/dark/content] applying filter', brightness);
}

export function removeDarkFilter(): void {
  document.getElementById(STYLE_ELEMENT_ID)?.remove();
  document.documentElement.style.removeProperty('--omni-brightness');
}

export function updateBrightness(brightness: number): void {
  document.documentElement.style.setProperty('--omni-brightness', String(brightness));
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

// Side-effect setup — runs at document_start in real Chrome.
if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
  // Initial application from current storage.
  const initial = chrome.storage.sync.get('omni') as unknown;
  if (initial && typeof (initial as Promise<unknown>).then === 'function') {
    (initial as Promise<{ omni?: OmniStorage }>).then((result) => {
      const storage = result.omni ?? DEFAULT_STORAGE;
      reconcileFromStorage(storage);
    });
  }

  // React to storage changes (popup toggle, brightness slider, default flip).
  if (chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'sync') return;
      const change = changes['omni'];
      if (!change) return;
      const next = (change.newValue as OmniStorage | undefined) ?? DEFAULT_STORAGE;
      reconcileFromStorage(next);
    });
  }
}
