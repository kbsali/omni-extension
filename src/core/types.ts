import type { Component } from 'svelte';

export type Mode = 'dark' | 'light' | 'default';

export interface DarkStorage {
  defaultMode: 'dark' | 'light';
  brightness: number; // 0.5..1.0
  sites: Record<string, Mode>; // eTLD+1 → explicit override
}

export interface OmniStorage {
  version: 1;
  modules: {
    dark: DarkStorage;
  };
}

export interface BackgroundCtx {
  getStorage: () => Promise<OmniStorage>;
  onStorageChange: (cb: (next: OmniStorage, prev: OmniStorage) => void) => void;
}

export interface OmniModule {
  id: string;
  label: string;
  icon: string;
  Popup: Component;
  onBackground?: (ctx: BackgroundCtx) => void;
  storageDefaults: Record<string, unknown>;
}
