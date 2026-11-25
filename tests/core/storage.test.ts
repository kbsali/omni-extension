import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_STORAGE,
  migrateSites,
  onStorageChange,
  readStorage,
  SITES_KEY,
  writeStorage,
} from '../../src/core/storage';

declare const chrome: any;

let synced: Record<string, unknown>;
let local: Record<string, unknown>;

const area = (store: () => Record<string, unknown>) => ({
  get: (key: string) =>
    Promise.resolve(key in store() ? { [key]: store()[key] } : {}),
  set: (obj: Record<string, unknown>) => {
    Object.assign(store(), obj);
    return Promise.resolve();
  },
});

beforeEach(() => {
  synced = {};
  local = {};
  for (const [name, store] of [
    ['sync', () => synced],
    ['local', () => local],
  ] as const) {
    const a = area(store);
    chrome.storage[name].get.callsFake(a.get);
    chrome.storage[name].set.callsFake(a.set);
  }
});

const darkOnly = (dark: object) => ({ version: 1, modules: { dark } });

const listen = () => {
  const cb = vi.fn();
  onStorageChange(cb);
  return {
    cb,
    listener: chrome.storage.onChanged.addListener.firstCall.args[0],
  };
};

describe('core/storage', () => {
  describe('readStorage', () => {
    it('returns DEFAULT_STORAGE when nothing stored', async () => {
      expect(await readStorage()).toEqual(DEFAULT_STORAGE);
    });

    it('fills fields missing from an older stored module', async () => {
      synced.omni = darkOnly({ brightness: 0.9 });
      const storage = await readStorage();
      expect(storage.modules.dark).toEqual({
        ...DEFAULT_STORAGE.modules.dark,
        brightness: 0.9,
      });
      expect(storage.modules.emoji).toEqual(DEFAULT_STORAGE.modules.emoji);
    });

    it('takes sites from storage.local', async () => {
      synced.omni = darkOnly({
        defaultMode: 'dark',
        sites: { 'old.com': 'dark' },
      });
      local[SITES_KEY] = { 'a.com': 'light' };
      const { dark } = (await readStorage()).modules;
      expect(dark.sites).toEqual({ 'a.com': 'light' });
      expect(dark.defaultMode).toBe('dark');
    });

    it('falls back to sites an older version synced', async () => {
      synced.omni = darkOnly({ sites: { 'old.com': 'dark' } });
      expect((await readStorage()).modules.dark.sites).toEqual({
        'old.com': 'dark',
      });
    });
  });

  it('repairs emoji recents an older version saved as {}', async () => {
    synced.omni = { version: 1, modules: { emoji: { recents: {} } } };
    expect((await readStorage()).modules.emoji.recents).toEqual([]);
  });

  describe('writeStorage', () => {
    it('writes sites to storage.local and the rest to sync', async () => {
      const storage = structuredClone(DEFAULT_STORAGE);
      storage.modules.dark.sites = { 'a.com': 'dark' };
      await writeStorage(storage);
      expect(local[SITES_KEY]).toEqual({ 'a.com': 'dark' });
      expect(synced.omni).toEqual({
        ...DEFAULT_STORAGE,
        modules: {
          ...DEFAULT_STORAGE.modules,
          dark: { defaultMode: 'light', brightness: 1 },
        },
      });
      expect(await readStorage()).toEqual(storage);
    });

    it('writes plain arrays, not the proxies a Svelte $state holds', async () => {
      const storage = structuredClone(DEFAULT_STORAGE);
      const recents = new Proxy(['😀'], {});
      storage.modules.emoji.recents = recents;
      await writeStorage(storage);
      const saved = (synced.omni as typeof storage).modules.emoji.recents;
      expect(saved).not.toBe(recents);
      expect(saved).toEqual(['😀']);
    });
  });

  describe('migrateSites', () => {
    it('copies synced sites to storage.local and leaves sync untouched', async () => {
      synced.omni = darkOnly({ sites: { 'old.com': 'dark' } });
      await migrateSites();
      expect(local[SITES_KEY]).toEqual({ 'old.com': 'dark' });
      expect(synced.omni).toEqual(darkOnly({ sites: { 'old.com': 'dark' } }));
    });

    it('keeps existing local sites', async () => {
      synced.omni = darkOnly({ sites: { 'old.com': 'dark' } });
      local[SITES_KEY] = { 'a.com': 'light' };
      await migrateSites();
      expect(local[SITES_KEY]).toEqual({ 'a.com': 'light' });
    });
  });

  describe('onStorageChange', () => {
    it('re-reads the whole state on a sync change', async () => {
      const { cb, listener } = listen();
      synced.omni = darkOnly({ brightness: 0.8 });
      listener({ omni: {} }, 'sync');
      await vi.waitFor(() => expect(cb).toHaveBeenCalled());
      expect(cb.mock.lastCall![0].modules.dark.brightness).toBe(0.8);
    });

    it('re-reads the whole state on a local sites change', async () => {
      const { cb, listener } = listen();
      local[SITES_KEY] = { 'a.com': 'dark' };
      listener({ [SITES_KEY]: {} }, 'local');
      await vi.waitFor(() => expect(cb).toHaveBeenCalled());
      expect(cb.mock.lastCall![0].modules.dark.sites).toEqual({
        'a.com': 'dark',
      });
    });

    it('ignores unrelated keys and areas', async () => {
      const { cb, listener } = listen();
      listener({ otherKey: {} }, 'sync');
      listener({ omni: {} }, 'local');
      listener({ [SITES_KEY]: {} }, 'sync');
      await Promise.resolve();
      expect(cb).not.toHaveBeenCalled();
    });
  });
});
