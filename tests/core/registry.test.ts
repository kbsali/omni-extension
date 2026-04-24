import { describe, it, expect } from 'vitest';
import { modules } from '../../src/core/registry';
import manifest from '../../manifest.config';

describe('core/registry', () => {
  it('exports the dark, cookies, and emoji modules', () => {
    expect(modules.length).toBeGreaterThanOrEqual(3);
    expect(modules.find((m) => m.id === 'dark')).toBeDefined();
    expect(modules.find((m) => m.id === 'cookies')).toBeDefined();
    expect(modules.find((m) => m.id === 'emoji')).toBeDefined();
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

describe('core/registry — shortcut / manifest parity', () => {
  const manifestCommands = (manifest.commands ?? {}) as Record<
    string,
    { suggested_key?: { default?: string }; description?: string }
  >;

  const modulesWithShortcut = modules.filter((m) => m.shortcut !== undefined);

  it('every module shortcut has a unique commandName', () => {
    const names = modulesWithShortcut.map((m) => m.shortcut!.commandName);
    expect(new Set(names).size).toBe(names.length);
  });

  it('every module shortcut has a matching manifest command with the same suggestedKey', () => {
    for (const m of modulesWithShortcut) {
      const sc = m.shortcut!;
      const cmd = manifestCommands[sc.commandName];
      expect(cmd, `manifest.commands missing entry for ${sc.commandName}`).toBeDefined();
      expect(cmd!.suggested_key?.default).toBe(sc.suggestedKey);
      expect(cmd!.description).toBe(sc.description);
    }
  });

  it('every manifest command is owned by exactly one module', () => {
    for (const commandName of Object.keys(manifestCommands)) {
      const owners = modulesWithShortcut.filter(
        (m) => m.shortcut!.commandName === commandName,
      );
      expect(
        owners.length,
        `orphan or duplicate owner for manifest command ${commandName}`,
      ).toBe(1);
    }
  });
});
