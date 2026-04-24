import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  readStorage,
  writeStorage,
  onStorageChange,
  DEFAULT_STORAGE,
} from '../../src/core/storage';

declare const chrome: any;

describe('core/storage', () => {
  beforeEach(() => {
    chrome.flush();
  });

  describe('readStorage', () => {
    it('returns DEFAULT_STORAGE when nothing stored', async () => {
      chrome.storage.sync.get.callsFake(() => Promise.resolve({}));
      const storage = await readStorage();
      expect(storage).toEqual(DEFAULT_STORAGE);
    });

    it('returns stored value under the "omni" key', async () => {
      const stored = {
        version: 1,
        modules: {
          dark: { defaultMode: 'dark', brightness: 0.9, sites: { 'github.com': 'dark' } },
        },
      };
      chrome.storage.sync.get.callsFake(() => Promise.resolve({ omni: stored }));
      const storage = await readStorage();
      expect(storage).toEqual(stored);
    });
  });

  describe('writeStorage', () => {
    it('writes the object under the "omni" key', async () => {
      chrome.storage.sync.set.callsFake(() => Promise.resolve());
      await writeStorage(DEFAULT_STORAGE);
      expect(chrome.storage.sync.set.calledOnce).toBe(true);
      expect(chrome.storage.sync.set.firstCall.args[0]).toEqual({ omni: DEFAULT_STORAGE });
    });
  });

  describe('onStorageChange', () => {
    it('invokes callback with parsed new/old storage on change', () => {
      const cb = vi.fn();
      onStorageChange(cb);

      expect(chrome.storage.onChanged.addListener.calledOnce).toBe(true);
      const listener = chrome.storage.onChanged.addListener.firstCall.args[0];

      const newValue = { ...DEFAULT_STORAGE };
      const oldValue = {
        ...DEFAULT_STORAGE,
        modules: { dark: { ...DEFAULT_STORAGE.modules.dark, brightness: 0.8 } },
      };
      listener({ omni: { newValue, oldValue } }, 'sync');

      expect(cb).toHaveBeenCalledWith(newValue, oldValue);
    });

    it('ignores unrelated storage keys', () => {
      const cb = vi.fn();
      onStorageChange(cb);
      const listener = chrome.storage.onChanged.addListener.firstCall.args[0];

      listener({ otherKey: { newValue: 'x', oldValue: 'y' } }, 'sync');
      expect(cb).not.toHaveBeenCalled();
    });

    it('ignores non-sync storage changes', () => {
      const cb = vi.fn();
      onStorageChange(cb);
      const listener = chrome.storage.onChanged.addListener.firstCall.args[0];

      listener({ omni: { newValue: DEFAULT_STORAGE, oldValue: DEFAULT_STORAGE } }, 'local');
      expect(cb).not.toHaveBeenCalled();
    });
  });
});
