import type { Component } from 'svelte';
import type { CookiesStorage } from '../modules/cookies/storage';
import type { EmojiStorage } from '../modules/emoji/storage';

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
    cookies: CookiesStorage;
    emoji: EmojiStorage;
  };
}

export interface BackgroundCtx {
  getStorage: () => Promise<OmniStorage>;
  onStorageChange: (cb: (next: OmniStorage, prev: OmniStorage) => void) => void;
}

export interface ShortcutCtx {
  getStorage: () => Promise<OmniStorage>;
  writeStorage: (next: OmniStorage) => Promise<void>;
  getActiveTab: () => Promise<chrome.tabs.Tab | undefined>;
  openPopupFocusedOn: (moduleId: string) => Promise<void>;
}

export interface OmniShortcut {
  commandName: string;
  description: string;
  suggestedKey: string;
  onInvoke: (ctx: ShortcutCtx) => Promise<void> | void;
}

export interface OmniModule {
  id: string;
  label: string;
  icon: string;
  Popup: Component;
  onBackground?: (ctx: BackgroundCtx) => void;
  storageDefaults: Record<string, unknown>;
  shortcut?: OmniShortcut;
}
