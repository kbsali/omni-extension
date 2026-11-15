import { extractETLD1 } from '../../core/domain';
import type { OmniModule, ShortcutCtx } from '../../core/types';
import Popup from './Popup.svelte';
import { nextSiteValueOnToggle } from './service';
import { setSiteMode } from './storage';

async function toggleDarkForCurrentSite(ctx: ShortcutCtx): Promise<void> {
  const tab = await ctx.getActiveTab();
  if (!tab?.url) return;
  const domain = extractETLD1(tab.url);
  if (!domain) return;
  const storage = await ctx.getStorage();
  const current = storage.modules.dark.sites[domain] ?? 'default';
  const siteValue = nextSiteValueOnToggle(
    current,
    storage.modules.dark.defaultMode
  );
  await ctx.writeStorage(setSiteMode(storage, domain, siteValue));
}

const dark: OmniModule = {
  id: 'dark',
  label: 'Dark',
  icon: '🌙',
  Popup,
  shortcut: {
    commandName: 'toggle-dark',
    description: 'Toggle dark mode for current site',
    suggestedKey: 'Ctrl+Shift+Period',
    onInvoke: toggleDarkForCurrentSite,
  },
};

export default dark;
