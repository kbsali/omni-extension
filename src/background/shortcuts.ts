import { modules as registryModules } from '../core/registry';
import { readStorage, writeStorage } from '../core/storage';
import { setPendingTab } from '../core/session';
import type { OmniModule, ShortcutCtx } from '../core/types';

async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// Vivaldi accepts chrome.action.openPopup() but silently no-ops — its action
// button lives in a custom toolbar. UA-sniff it and open the popup page in a
// window instead.
// ponytail: UA sniff; if another Chromium fork shows the same no-op, add it here.
function actionPopupUnsupported(): boolean {
  return navigator.userAgent.includes('Vivaldi');
}

async function openPopupWindow(sourceUrl: string | undefined): Promise<void> {
  const popupPath = chrome.runtime.getManifest().action?.default_popup;
  if (!popupPath) {
    console.error('[omni/shortcuts] no default_popup in manifest; cannot open window');
    return;
  }
  // A detached window's currentWindow is itself, so popups that need the active
  // site (cookies) can't query it. Pass the source tab URL through the query
  // string; the popup uses it when present and falls back to currentWindow.
  const base = chrome.runtime.getURL(popupPath);
  const url = sourceUrl ? `${base}?sourceUrl=${encodeURIComponent(sourceUrl)}` : base;
  await chrome.windows.create({ url, type: 'popup', width: 360, height: 480, focused: true });
}

async function openPopupFocusedOn(moduleId: string): Promise<void> {
  console.log('[omni/shortcuts] openPopupFocusedOn:', moduleId);
  await setPendingTab(moduleId);

  if (!actionPopupUnsupported() && typeof chrome.action?.openPopup === 'function') {
    try {
      await chrome.action.openPopup();
      console.log('[omni/shortcuts] openPopup resolved');
      return;
    } catch (err) {
      console.error('[omni/shortcuts] openPopup threw, falling back to window:', err);
    }
  }
  const tab = await getActiveTab();
  await openPopupWindow(tab?.url);
}

export function makeCtx(): ShortcutCtx {
  return {
    getStorage: readStorage,
    writeStorage,
    getActiveTab,
    openPopupFocusedOn,
  };
}

export function buildDispatcher(
  modules: readonly OmniModule[],
  ctx: ShortcutCtx,
): (command: string) => Promise<void> {
  const byCommand = new Map(
    modules
      .filter(
        (m): m is OmniModule & { shortcut: NonNullable<OmniModule['shortcut']> } =>
          m.shortcut !== undefined,
      )
      .map((m) => [m.shortcut.commandName, m.shortcut]),
  );

  return async (command: string) => {
    console.log('[omni/shortcuts] onCommand received:', command);
    const shortcut = byCommand.get(command);
    if (!shortcut) {
      console.warn('[omni/shortcuts] unknown command:', command);
      return;
    }
    try {
      await shortcut.onInvoke(ctx);
      console.log('[omni/shortcuts] onInvoke completed:', command);
    } catch (err) {
      console.error(`[omni/shortcuts] ${command} onInvoke threw:`, err);
    }
  };
}

export function wireShortcuts(): void {
  const dispatch = buildDispatcher(registryModules, makeCtx());
  chrome.commands.onCommand.addListener(dispatch);
}
