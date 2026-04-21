import { describe, it, expect } from 'vitest';
import { setSiteMode, setDefaultMode, setBrightness, cycleSiteMode, DARK_DEFAULTS } from '../../../src/modules/dark/storage';
import { DEFAULT_STORAGE } from '../../../src/core/storage';

describe('modules/dark/storage', () => {
  describe('DARK_DEFAULTS', () => {
    it('matches DEFAULT_STORAGE.modules.dark', () => {
      expect(DARK_DEFAULTS).toEqual(DEFAULT_STORAGE.modules.dark);
    });
  });

  describe('setSiteMode', () => {
    it('returns new storage with updated site entry', () => {
      const next = setSiteMode(DEFAULT_STORAGE, 'github.com', 'dark');
      expect(next.modules.dark.sites['github.com']).toBe('dark');
      expect(next).not.toBe(DEFAULT_STORAGE);
    });

    it('removes the site when mode is "default"', () => {
      const withSite = setSiteMode(DEFAULT_STORAGE, 'github.com', 'dark');
      const cleared = setSiteMode(withSite, 'github.com', 'default');
      expect(cleared.modules.dark.sites).not.toHaveProperty('github.com');
    });

    it('does not mutate input', () => {
      const original = structuredClone(DEFAULT_STORAGE);
      setSiteMode(DEFAULT_STORAGE, 'github.com', 'dark');
      expect(DEFAULT_STORAGE).toEqual(original);
    });
  });

  describe('setDefaultMode', () => {
    it('flips the global default', () => {
      const next = setDefaultMode(DEFAULT_STORAGE, 'dark');
      expect(next.modules.dark.defaultMode).toBe('dark');
    });
  });

  describe('setBrightness', () => {
    it('clamps to [0.5, 1.0]', () => {
      expect(setBrightness(DEFAULT_STORAGE, 0.3).modules.dark.brightness).toBe(0.5);
      expect(setBrightness(DEFAULT_STORAGE, 1.5).modules.dark.brightness).toBe(1.0);
      expect(setBrightness(DEFAULT_STORAGE, 0.75).modules.dark.brightness).toBe(0.75);
    });
  });

  describe('cycleSiteMode', () => {
    it('cycles default → dark → light → default', () => {
      let s = DEFAULT_STORAGE;
      s = cycleSiteMode(s, 'example.com');
      expect(s.modules.dark.sites['example.com']).toBe('dark');
      s = cycleSiteMode(s, 'example.com');
      expect(s.modules.dark.sites['example.com']).toBe('light');
      s = cycleSiteMode(s, 'example.com');
      expect(s.modules.dark.sites).not.toHaveProperty('example.com');
    });
  });
});
