import type { DarkStorage, Mode, OmniStorage } from '../../core/types';

export const DARK_DEFAULTS: DarkStorage = {
  defaultMode: 'light',
  brightness: 1.0,
  sites: {},
};

export function setSiteMode(storage: OmniStorage, domain: string, mode: Mode): OmniStorage {
  const sites = { ...storage.modules.dark.sites };
  if (mode === 'default') {
    delete sites[domain];
  } else {
    sites[domain] = mode;
  }
  return {
    ...storage,
    modules: {
      ...storage.modules,
      dark: { ...storage.modules.dark, sites },
    },
  };
}

export function setDefaultMode(storage: OmniStorage, mode: 'dark' | 'light'): OmniStorage {
  return {
    ...storage,
    modules: {
      ...storage.modules,
      dark: { ...storage.modules.dark, defaultMode: mode },
    },
  };
}

export function setBrightness(storage: OmniStorage, value: number): OmniStorage {
  const clamped = Math.min(1.0, Math.max(0.5, value));
  return {
    ...storage,
    modules: {
      ...storage.modules,
      dark: { ...storage.modules.dark, brightness: clamped },
    },
  };
}

export function cycleSiteMode(storage: OmniStorage, domain: string): OmniStorage {
  const current = storage.modules.dark.sites[domain];
  const next: Mode = current === undefined ? 'dark' : current === 'dark' ? 'light' : 'default';
  return setSiteMode(storage, domain, next);
}
