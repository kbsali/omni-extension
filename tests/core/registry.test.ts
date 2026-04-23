import { describe, it, expect } from 'vitest';
import { modules } from '../../src/core/registry';

describe('core/registry', () => {
  it('exports the dark and cookies modules', () => {
    expect(modules.length).toBeGreaterThanOrEqual(2);
    expect(modules.find((m) => m.id === 'dark')).toBeDefined();
    expect(modules.find((m) => m.id === 'cookies')).toBeDefined();
  });

  it('all module ids are unique', () => {
    const ids = modules.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all modules have required fields', () => {
    for (const m of modules) {
      expect(m.id).toBeTruthy();
      expect(m.label).toBeTruthy();
      expect(m.icon).toBeTruthy();
      expect(m.Popup).toBeDefined();
      expect(m.storageDefaults).toBeDefined();
    }
  });
});
