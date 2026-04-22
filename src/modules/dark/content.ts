import { buildDarkCss, STYLE_ELEMENT_ID } from './css';
import { MSG_REMOVE, MSG_UPDATE_BRIGHTNESS, type ContentMessage } from './messages';

console.log('[omni/dark/content] script loaded on', location.href);

export function applyDarkFilter(brightness: number): void {
  document.documentElement.style.setProperty('--omni-brightness', String(brightness));
  if (document.getElementById(STYLE_ELEMENT_ID)) return;
  console.log('[omni/dark/content] applying filter', brightness);
  const style = document.createElement('style');
  style.id = STYLE_ELEMENT_ID;
  style.textContent = buildDarkCss();
  (document.head ?? document.documentElement).appendChild(style);
}

export function removeDarkFilter(): void {
  document.getElementById(STYLE_ELEMENT_ID)?.remove();
  document.documentElement.style.removeProperty('--omni-brightness');
}

export function updateBrightness(brightness: number): void {
  document.documentElement.style.setProperty('--omni-brightness', String(brightness));
}

// Wire up at module load (runs at document_start in the injected context).
if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((msg: ContentMessage) => {
    if (msg.type === MSG_UPDATE_BRIGHTNESS) {
      updateBrightness(msg.brightness);
    } else if (msg.type === MSG_REMOVE) {
      removeDarkFilter();
    }
  });
}

// Read brightness from storage and apply immediately.
if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
  const result = chrome.storage.sync.get('omni') as unknown;
  if (result && typeof (result as Promise<unknown>).then === 'function') {
    (result as Promise<{ omni?: { modules?: { dark?: { brightness?: number } } } }>).then((r) => {
      const brightness = r?.omni?.modules?.dark?.brightness ?? 1.0;
      applyDarkFilter(brightness);
    });
  }
}
