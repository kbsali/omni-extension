import { modules as registryModules } from '../core/registry';
import { readStorage, writeStorage } from '../core/storage';
import { setPendingTab } from '../core/session';
import type { OmniModule, ShortcutCtx } from '../core/types';

async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function openPopupFocusedOn(moduleId: string): Promise<void> {
  await setPendingTab(moduleId);
  try {
    await chrome.action.openPopup();
  } catch (err) {
    // Chrome <127 or no focused window. A shortcut press satisfies the
    // user-gesture requirement, so failure here is rare.
    console.warn('[omni/shortcuts] openPopup failed:', err);
  }
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
      .filter((m): m is OmniModule & { shortcut: NonNullable<OmniModule['shortcut']> } =>
        m.shortcut !== undefined,
      )
      .map((m) => [m.shortcut.commandName, m.shortcut]),
  );

  return async (command: string) => {
    const shortcut = byCommand.get(command);
    if (!shortcut) {
      console.warn('[omni/shortcuts] unknown command:', command);
      return;
    }
    try {
      await shortcut.onInvoke(ctx);
    } catch (err) {
      console.warn(`[omni/shortcuts] ${command} failed:`, err);
    }
  };
}

export function wireShortcuts(): void {
  const dispatch = buildDispatcher(registryModules, makeCtx());
  chrome.commands.onCommand.addListener(dispatch);
}
