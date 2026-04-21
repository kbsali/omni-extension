import type { OmniModule, BackgroundCtx } from '../../core/types';
import Popup from './Popup.svelte';
import { DARK_DEFAULTS } from './storage';
import { computeEnrolledDomains, diffRegistrations, type EnrolledSet } from './service';

const CONTENT_SCRIPT_FILE = 'src/modules/dark/content.ts';

async function reconcile(prev: EnrolledSet, next: EnrolledSet): Promise<EnrolledSet> {
  const diff = diffRegistrations(prev, next);

  if (diff.fullReregister || diff.toUnregister.length > 0) {
    const existing = await chrome.scripting.getRegisteredContentScripts();
    const darkIds = existing.filter((s) => s.id.startsWith('omni-dark')).map((s) => s.id);
    if (darkIds.length > 0) {
      await chrome.scripting.unregisterContentScripts({ ids: darkIds });
    }
  }

  if (next.mode === 'global') {
    const excludeMatches = next.excludeDomains.map((d) => `*://*.${d}/*`);
    await chrome.scripting.registerContentScripts([
      {
        id: 'omni-dark-global',
        js: [CONTENT_SCRIPT_FILE],
        matches: ['<all_urls>'],
        excludeMatches,
        runAt: 'document_start',
      },
    ]);
  } else {
    const toRegister = diff.fullReregister ? next.domains : diff.toRegister.mode === 'per-site' ? diff.toRegister.domains : [];
    if (toRegister.length > 0) {
      await chrome.scripting.registerContentScripts(
        toRegister.map((domain) => ({
          id: `omni-dark-${domain}`,
          js: [CONTENT_SCRIPT_FILE],
          matches: [`*://*.${domain}/*`, `*://${domain}/*`],
          runAt: 'document_start' as const,
        })),
      );
    }
  }

  // Broadcast removals to matching live tabs (best-effort).
  for (const removed of diff.toUnregister) {
    const tabs = await chrome.tabs.query({ url: [`*://*.${removed}/*`, `*://${removed}/*`] });
    for (const tab of tabs) {
      if (tab.id !== undefined) {
        chrome.tabs.sendMessage(tab.id, { type: 'omni-dark/remove' }).catch(() => {});
      }
    }
  }

  return next;
}

const dark: OmniModule = {
  id: 'dark',
  label: 'Dark',
  icon: '🌙',
  Popup,
  storageDefaults: { ...DARK_DEFAULTS },
  onBackground(ctx: BackgroundCtx) {
    let current: EnrolledSet = { mode: 'per-site', domains: [] };

    ctx.getStorage().then((storage) => {
      const initial = computeEnrolledDomains(storage);
      reconcile(current, initial).then((applied) => {
        current = applied;
      });
    });

    ctx.onStorageChange((next) => {
      const nextSet = computeEnrolledDomains(next);
      reconcile(current, nextSet).then((applied) => {
        current = applied;
      });
    });
  },
};

export default dark;
