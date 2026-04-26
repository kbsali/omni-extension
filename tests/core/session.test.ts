import { describe, it, expect, beforeEach } from 'vitest';
import { setPendingTab, consumePendingTab } from '../../src/core/session';

// sinon-chrome doesn't ship chrome.storage.session. The project's `tests/setup.ts`
// provides `chrome.storage.sync` only. We stub storage.session inline here.
const sessionStore = new Map<string, unknown>();

beforeEach(() => {
  sessionStore.clear();
  // Minimal stub of the three methods `session.ts` uses; cast away the
  // overloaded StorageArea signature since sinon-chrome doesn't ship
  // chrome.storage.session and we only need our helpers' happy path.
  chrome.storage.session = {
    get: async (key: string) => (sessionStore.has(key) ? { [key]: sessionStore.get(key) } : {}),
    set: async (obj: Record<string, unknown>) => {
      for (const [k, v] of Object.entries(obj)) sessionStore.set(k, v);
    },
    remove: async (key: string) => {
      sessionStore.delete(key);
    },
  } as unknown as typeof chrome.storage.session;
});

describe('core/session — pendingTab', () => {
  it('round-trips a value', async () => {
    await setPendingTab('emoji');
    expect(await consumePendingTab()).toBe('emoji');
  });

  it('clears the value after consume (returns undefined on second call)', async () => {
    await setPendingTab('cookies');
    await consumePendingTab();
    expect(await consumePendingTab()).toBeUndefined();
  });

  it('returns undefined when no value was set', async () => {
    expect(await consumePendingTab()).toBeUndefined();
  });
});
