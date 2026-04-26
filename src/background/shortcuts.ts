import { modules as registryModules } from '../core/registry';
import { readStorage, writeStorage } from '../core/storage';
import { setPendingTab } from '../core/session';
import type { OmniModule, ShortcutCtx } from '../core/types';

async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function openPopupFocusedOn(moduleId: string): Promise<void> {
  console.log('[omni/shortcuts] openPopupFocusedOn:', moduleId);
  await setPendingTab(moduleId);
  if (typeof chrome.action?.openPopup !== 'function') {
    console.error(
      '[omni/shortcuts] chrome.action.openPopup is not available in this Chrome build. ' +
        'Needs Chrome 127+.',
    );
    return;
  }
  try {
    await chrome.action.openPopup();
    console.log('[omni/shortcuts] openPopup resolved');
  } catch (err) {
    console.error('[omni/shortcuts] openPopup threw:', err);
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
