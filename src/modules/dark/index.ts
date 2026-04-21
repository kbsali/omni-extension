import type { OmniModule, BackgroundCtx } from '../../core/types';
import Popup from './Popup.svelte';
import { DARK_DEFAULTS } from './storage';
import { computeEnrolledDomains, diffRegistrations, type EnrolledSet } from './service';
import { MSG_REMOVE } from './messages';

const CONTENT_SCRIPT_FILE = 'src/modules/dark/content.js';

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
  const removeMsg = { type: MSG_REMOVE };

  if (diff.fullReregister && prev.mode === 'global') {
    // Leaving global-dark mode: every tab potentially has the filter applied.
    const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
    for (const tab of tabs) {
      if (tab.id !== undefined) {
        chrome.tabs.sendMessage(tab.id, removeMsg).catch(() => {});
      }
    }
  } else {
    for (const removed of diff.toUnregister) {
      if (removed === '__global__') continue; // handled above
      const tabs = await chrome.tabs.query({ url: [`*://*.${removed}/*`, `*://${removed}/*`] });
      for (const tab of tabs) {
        if (tab.id !== undefined) {
          chrome.tabs.sendMessage(tab.id, removeMsg).catch(() => {});
        }
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

    const run = (next: EnrolledSet) => {
      reconcile(current, next)
        .then((applied) => {
          current = applied;
        })
        .catch((err) => {
          console.error('[omni-dark] reconcile failed:', err);
          current = next; // avoid re-attempting failed ops on next diff
        });
    };

    ctx
      .getStorage()
      .then((storage) => run(computeEnrolledDomains(storage)))
      .catch((err) => console.error('[omni-dark] initial storage read failed:', err));

    ctx.onStorageChange((next) => run(computeEnrolledDomains(next)));
  },
};

export default dark;
