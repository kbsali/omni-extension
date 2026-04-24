import type { OmniModule, ShortcutCtx } from '../../core/types';
import { extractETLD1 } from '../../core/domain';
import Popup from './Popup.svelte';
import { DARK_DEFAULTS, setSiteMode } from './storage';
import { nextSiteValueOnToggle } from './service';

async function toggleDarkForCurrentSite(ctx: ShortcutCtx): Promise<void> {
  const tab = await ctx.getActiveTab();
  if (!tab?.url) return;
  const domain = extractETLD1(tab.url);
  if (!domain) return;
  const storage = await ctx.getStorage();
  const current = storage.modules.dark.sites[domain] ?? 'default';
  const siteValue = nextSiteValueOnToggle(current, storage.modules.dark.defaultMode);
  await ctx.writeStorage(setSiteMode(storage, domain, siteValue));
}

const dark: OmniModule = {
  id: 'dark',
  label: 'Dark',
  icon: '🌙',
  Popup,
  storageDefaults: { ...DARK_DEFAULTS },
  onBackground() {
    console.log('[omni/dark] background hook installed (no-op — content script self-manages)');
  },
  shortcut: {
    commandName: 'toggle-dark',
    description: 'Toggle dark mode for current site',
    suggestedKey: 'Alt+Shift+D',
    onInvoke: toggleDarkForCurrentSite,
  },
};

export default dark;
