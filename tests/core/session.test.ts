import { describe, it, expect, beforeEach } from 'vitest';
import { setPendingTab, consumePendingTab } from '../../src/core/session';

// sinon-chrome has no chrome.storage.session, and @types/chrome marks it
// read-only: install a stub through a mutable cast.
const sessionStore = new Map<string, unknown>();

beforeEach(() => {
  sessionStore.clear();
  (chrome.storage as { session: typeof chrome.storage.session }).session = {
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
