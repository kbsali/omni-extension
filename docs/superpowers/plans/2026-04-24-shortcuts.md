# Keyboard Shortcuts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add keyboard shortcuts for each module. `Alt+Shift+E` opens popup on Emoji tab, `Alt+Shift+K` opens popup on Cookies tab, `Alt+Shift+D` toggles dark mode for the current site directly (no popup).

**Architecture:** Extend `OmniModule` with an optional `shortcut: OmniShortcut` field. A background dispatcher registers a single `chrome.commands.onCommand` listener and routes the command name to the owning module's `onInvoke`. Popup-opening modules (emoji, cookies) write a `pendingTab` value to `chrome.storage.session` then call `chrome.action.openPopup()`. The popup reads and clears the key on mount and activates the matching tab. Dark's shortcut directly mutates storage using a new pure `nextSiteValueOnToggle` helper that the existing popup also consumes (single source of truth for toggle math).

**Tech Stack:** TypeScript strict, Svelte 5 runes, Vitest, `sinon-chrome` test stubs, `@crxjs/vite-plugin`, Chrome `commands` / `action.openPopup` / `storage.session` APIs.

**Reference spec:** `docs/superpowers/specs/2026-04-24-shortcuts-design.md`.

**Branch context:** this plan is implemented on the already-checked-out `feat/shortcuts` branch, which is stacked on top of `feat/emoji-picker` (PR #4). Do not switch to `main` — it lacks the emoji module files that some tasks touch. When `feat/emoji-picker` merges, this branch will be rebased onto the new `main`.

---

## Task 1: `src/core/session.ts` — session storage helpers (TDD)

The popup handoff uses `chrome.storage.session` so the signal doesn't survive a browser restart. Atomic "read-and-clear" is part of the contract.

**Files:**
- Create: `src/core/session.ts`
- Create: `tests/core/session.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/core/session.test.ts` with exactly:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { setPendingTab, consumePendingTab } from '../../src/core/session';

// sinon-chrome doesn't ship chrome.storage.session. The project's `tests/setup.ts`
// provides `chrome.storage.sync` only. We stub storage.session inline here.
const sessionStore = new Map<string, unknown>();

beforeEach(() => {
  sessionStore.clear();
  // @ts-expect-error — augmenting the sinon-chrome mock at runtime
  chrome.storage.session = {
    get: async (key: string) =>
      sessionStore.has(key) ? { [key]: sessionStore.get(key) } : {},
    set: async (obj: Record<string, unknown>) => {
      for (const [k, v] of Object.entries(obj)) sessionStore.set(k, v);
    },
    remove: async (key: string) => {
      sessionStore.delete(key);
    },
  };
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/kevin/workspace/perso/omni-extension && pnpm test -- tests/core/session.test.ts
```

Expected: FAIL — `src/core/session` not found.

- [ ] **Step 3: Create `src/core/session.ts`**

```ts
const PENDING_TAB_KEY = 'omni.pendingTab';

export async function setPendingTab(moduleId: string): Promise<void> {
  await chrome.storage.session.set({ [PENDING_TAB_KEY]: moduleId });
}

export async function consumePendingTab(): Promise<string | undefined> {
  const result = await chrome.storage.session.get(PENDING_TAB_KEY);
  const value = result[PENDING_TAB_KEY] as string | undefined;
  if (value !== undefined) await chrome.storage.session.remove(PENDING_TAB_KEY);
  return value;
}
```

- [ ] **Step 4: Run tests to verify green**

```bash
cd /home/kevin/workspace/perso/omni-extension && pnpm test -- tests/core/session.test.ts
```

Expected: all 3 PASS.

- [ ] **Step 5: Commit**

```bash
cd /home/kevin/workspace/perso/omni-extension && git add src/core/session.ts tests/core/session.test.ts && git commit -m "feat(core): add session storage helpers for popup handoff"
```

---

## Task 2: `nextSiteValueOnToggle` helper (TDD)

Pure function shared by the dark popup button and the new keyboard shortcut.

**Files:**
- Modify: `src/modules/dark/service.ts`
- Modify: `tests/modules/dark/service.test.ts`

- [ ] **Step 1: Append failing tests to `tests/modules/dark/service.test.ts`**

Open the file. At the bottom, append:

```ts
import { nextSiteValueOnToggle } from '../../../src/modules/dark/service';

describe('dark/service — nextSiteValueOnToggle', () => {
  it('forces dark when currently default on a light default', () => {
    expect(nextSiteValueOnToggle('default', 'light')).toBe('dark');
  });

  it('clears override when explicit dark flipped to light on a light default', () => {
    // effective dark → next effective light; since light === defaultMode, store 'default'
    expect(nextSiteValueOnToggle('dark', 'light')).toBe('default');
  });

  it('forces dark when explicit light on a light default', () => {
    // effective light → next effective dark; store the override
    expect(nextSiteValueOnToggle('light', 'light')).toBe('dark');
  });

  it('forces light when currently default on a dark default', () => {
    expect(nextSiteValueOnToggle('default', 'dark')).toBe('light');
  });

  it('clears override when explicit light flipped to dark on a dark default', () => {
    expect(nextSiteValueOnToggle('light', 'dark')).toBe('default');
  });

  it('forces light when explicit dark on a dark default', () => {
    expect(nextSiteValueOnToggle('dark', 'dark')).toBe('light');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/kevin/workspace/perso/omni-extension && pnpm test -- tests/modules/dark/service.test.ts
```

Expected: the 6 new tests FAIL — `nextSiteValueOnToggle` not exported.

- [ ] **Step 3: Add the helper to `src/modules/dark/service.ts`**

Open `src/modules/dark/service.ts`. Add this import-line adjustment at the top:

```ts
import type { Mode, OmniStorage } from '../../core/types';
```

(Replace the existing first line — it was `import type { OmniStorage } from '../../core/types';`.)

Then append this function at the end of the file:

```ts
export function nextSiteValueOnToggle(
  current: Mode,
  defaultMode: 'dark' | 'light',
): Mode {
  const effective = current === 'dark' || current === 'light' ? current : defaultMode;
  const nextEffective = effective === 'dark' ? 'light' : 'dark';
  return nextEffective === defaultMode ? 'default' : nextEffective;
}
```

- [ ] **Step 4: Run tests to verify green**

```bash
cd /home/kevin/workspace/perso/omni-extension && pnpm test -- tests/modules/dark/service.test.ts
```

Expected: all tests PASS (existing + 6 new).

- [ ] **Step 5: Commit**

```bash
cd /home/kevin/workspace/perso/omni-extension && git add src/modules/dark/service.ts tests/modules/dark/service.test.ts && git commit -m "feat(dark): add nextSiteValueOnToggle pure helper"
```

---

## Task 3: `OmniShortcut` + `ShortcutCtx` types

Type-only extension; no tests.

**Files:**
- Modify: `src/core/types.ts`

- [ ] **Step 1: Replace the contents of `src/core/types.ts`**

```ts
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
```

- [ ] **Step 2: Typecheck**

```bash
cd /home/kevin/workspace/perso/omni-extension && pnpm check 2>&1 | tail -20
```

Expected: only the pre-existing `toSorted` errors in `src/modules/cookies/service.ts` and `src/modules/dark/service.ts` (documented as out-of-scope in the project). No new errors.

- [ ] **Step 3: Full test suite (no regressions from type change)**

```bash
cd /home/kevin/workspace/perso/omni-extension && pnpm test 2>&1 | tail -10
```

Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
cd /home/kevin/workspace/perso/omni-extension && git add src/core/types.ts && git commit -m "feat(core): add OmniShortcut and ShortcutCtx types"
```

---

## Task 4: Background dispatcher (TDD)

The dispatcher is split into two exports: `buildDispatcher` is pure (takes a module list + a ctx, returns an `async (command) => void`), and `wireShortcuts` is glue that constructs the real ctx and registers a `chrome.commands.onCommand` listener. Tests cover `buildDispatcher` directly.

**Files:**
- Create: `src/background/shortcuts.ts`
- Create: `tests/background/shortcuts.test.ts`

- [ ] **Step 1: Create the test directory and failing test**

```bash
cd /home/kevin/workspace/perso/omni-extension && mkdir -p tests/background
```

Create `tests/background/shortcuts.test.ts` with exactly:

```ts
import { describe, it, expect, vi } from 'vitest';
import { buildDispatcher } from '../../src/background/shortcuts';
import type { OmniModule, OmniShortcut, ShortcutCtx } from '../../src/core/types';

function makeCtx(): ShortcutCtx {
  return {
    getStorage: vi.fn(),
    writeStorage: vi.fn(),
    getActiveTab: vi.fn(),
    openPopupFocusedOn: vi.fn(),
  } as unknown as ShortcutCtx;
}

function makeModule(id: string, shortcut: OmniShortcut | undefined): OmniModule {
  return {
    id,
    label: id,
    icon: '?',
    // @ts-expect-error — Component type not needed for dispatcher tests
    Popup: null,
    storageDefaults: {},
    shortcut,
  };
}

describe('background/shortcuts — buildDispatcher', () => {
  it('routes a known command to the matching module onInvoke', async () => {
    const onInvokeA = vi.fn();
    const onInvokeB = vi.fn();
    const modules = [
      makeModule('a', {
        commandName: 'cmd-a',
        description: 'a',
        suggestedKey: 'Alt+Shift+A',
        onInvoke: onInvokeA,
      }),
      makeModule('b', {
        commandName: 'cmd-b',
        description: 'b',
        suggestedKey: 'Alt+Shift+B',
        onInvoke: onInvokeB,
      }),
    ];
    const ctx = makeCtx();
    const dispatch = buildDispatcher(modules, ctx);

    await dispatch('cmd-b');
    expect(onInvokeB).toHaveBeenCalledWith(ctx);
    expect(onInvokeA).not.toHaveBeenCalled();
  });

  it('ignores modules without a shortcut', async () => {
    const onInvoke = vi.fn();
    const modules = [
      makeModule('no-shortcut', undefined),
      makeModule('with-shortcut', {
        commandName: 'cmd',
        description: 'x',
        suggestedKey: 'Alt+Shift+X',
        onInvoke,
      }),
    ];
    const dispatch = buildDispatcher(modules, makeCtx());

    await dispatch('cmd');
    expect(onInvoke).toHaveBeenCalledTimes(1);
  });

  it('warns and does not throw on unknown commands', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const dispatch = buildDispatcher([], makeCtx());

    await expect(dispatch('nope')).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('catches errors thrown by onInvoke and logs them', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const failing = vi.fn().mockRejectedValue(new Error('boom'));
    const modules = [
      makeModule('a', {
        commandName: 'cmd',
        description: 'a',
        suggestedKey: 'Alt+Shift+A',
        onInvoke: failing,
      }),
    ];
    const dispatch = buildDispatcher(modules, makeCtx());

    await expect(dispatch('cmd')).resolves.toBeUndefined();
    expect(failing).toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/kevin/workspace/perso/omni-extension && pnpm test -- tests/background/shortcuts.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/background/shortcuts.ts`**

```ts
import { modules as registryModules } from '../core/registry';
import { readStorage, writeStorage } from '../core/storage';
import { setPendingTab } from '../core/session';
import type { OmniModule, ShortcutCtx } from '../core/types';

async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function openPopupFocusedOn(moduleId: string): Promise<void> {
  await setPendingTab(moduleId);
  try {
    await chrome.action.openPopup();
  } catch (err) {
    // Chrome <127 or no focused window. A shortcut press satisfies the
    // user-gesture requirement, so failure here is rare.
    console.warn('[omni/shortcuts] openPopup failed:', err);
  }
}

export function makeCtx(): ShortcutCtx {
  return {
    getStorage: readStorage,
    writeStorage,
    getActiveTab,
    openPopupFocusedOn,
  };
}

export function buildDispatcher(
  modules: readonly OmniModule[],
  ctx: ShortcutCtx,
): (command: string) => Promise<void> {
  const byCommand = new Map(
    modules
      .filter((m): m is OmniModule & { shortcut: NonNullable<OmniModule['shortcut']> } =>
        m.shortcut !== undefined,
      )
      .map((m) => [m.shortcut.commandName, m.shortcut]),
  );

  return async (command: string) => {
    const shortcut = byCommand.get(command);
    if (!shortcut) {
      console.warn('[omni/shortcuts] unknown command:', command);
      return;
    }
    try {
      await shortcut.onInvoke(ctx);
    } catch (err) {
      console.warn(`[omni/shortcuts] ${command} failed:`, err);
    }
  };
}

export function wireShortcuts(): void {
  const dispatch = buildDispatcher(registryModules, makeCtx());
  chrome.commands.onCommand.addListener(dispatch);
}
```

- [ ] **Step 4: Run tests to verify green**

```bash
cd /home/kevin/workspace/perso/omni-extension && pnpm test -- tests/background/shortcuts.test.ts
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /home/kevin/workspace/perso/omni-extension && git add src/background/shortcuts.ts tests/background/shortcuts.test.ts && git commit -m "feat(bg): add shortcut command dispatcher"
```

---

## Task 5: Dark module — toggle integration + Popup refactor

Adds `toggleDarkForCurrentSite` + `shortcut` to `dark/index.ts`. Refactors `dark/Popup.svelte`'s `onToggleSite` to call the new `nextSiteValueOnToggle` helper so both paths share identical logic.

**Files:**
- Modify: `src/modules/dark/index.ts`
- Modify: `src/modules/dark/Popup.svelte`

- [ ] **Step 1: Update `src/modules/dark/index.ts`**

Replace the full contents with:

```ts
import type { OmniModule, ShortcutCtx } from '../../core/types';
import { extractETLD1 } from '../../core/domain';
import Popup from './Popup.svelte';
import { DARK_DEFAULTS, setSiteMode } from './storage';
import { nextSiteValueOnToggle } from './service';

async function toggleDarkForCurrentSite(ctx: ShortcutCtx): Promise<void> {
  const tab = await ctx.getActiveTab();
  if (!tab?.url) return;
  const domain = extractETLD1(tab.url);
  if (!domain) return;
  const storage = await ctx.getStorage();
  const current = storage.modules.dark.sites[domain] ?? 'default';
  const siteValue = nextSiteValueOnToggle(current, storage.modules.dark.defaultMode);
  await ctx.writeStorage(setSiteMode(storage, domain, siteValue));
}

const dark: OmniModule = {
  id: 'dark',
  label: 'Dark',
  icon: '🌙',
  Popup,
  storageDefaults: { ...DARK_DEFAULTS },
  onBackground() {
    console.log('[omni/dark] background hook installed (no-op — content script self-manages)');
  },
  shortcut: {
    commandName: 'toggle-dark',
    description: 'Toggle dark mode for current site',
    suggestedKey: 'Alt+Shift+D',
    onInvoke: toggleDarkForCurrentSite,
  },
};

export default dark;
```

- [ ] **Step 2: Refactor `src/modules/dark/Popup.svelte` to use the shared helper**

Open `src/modules/dark/Popup.svelte`. Find the `onToggleSite` function:

```ts
  function onToggleSite() {
    if (!currentDomain) return;
    const current = resolveMode(storage, currentDomain);
    const next = current === 'dark' ? 'light' : 'dark';
    const defaultMode = storage.modules.dark.defaultMode;
    const siteValue = next === defaultMode ? 'default' : next;
    update(setSiteMode(storage, currentDomain, siteValue));
  }
```

Replace it with:

```ts
  function onToggleSite() {
    if (!currentDomain) return;
    const current = storage.modules.dark.sites[currentDomain] ?? 'default';
    const siteValue = nextSiteValueOnToggle(current, storage.modules.dark.defaultMode);
    update(setSiteMode(storage, currentDomain, siteValue));
  }
```

Then add the import at the top of the script block, next to the existing `resolveMode` import:

```ts
  import { resolveMode, nextSiteValueOnToggle } from './service';
```

(The `resolveMode` import should already exist; combine the two exports onto one import line. Remove it if it's now unused — `resolveMode` is still used below for `effectiveMode`, so keep it.)

- [ ] **Step 3: Verify tests and svelte-check**

```bash
cd /home/kevin/workspace/perso/omni-extension && pnpm test -- tests/modules/dark/ 2>&1 | tail -15
cd /home/kevin/workspace/perso/omni-extension && pnpm check 2>&1 | tail -15
```

Expected: dark tests PASS (all existing including the 6 new `nextSiteValueOnToggle` cases from Task 2); svelte-check shows no new errors.

- [ ] **Step 4: Commit**

```bash
cd /home/kevin/workspace/perso/omni-extension && git add src/modules/dark/index.ts src/modules/dark/Popup.svelte && git commit -m "feat(dark): wire toggle-dark shortcut and share toggle math with popup"
```

---

## Task 6: Emoji + Cookies shortcut declarations

Both delegate to `ctx.openPopupFocusedOn`. Two small changes.

**Files:**
- Modify: `src/modules/emoji/index.ts`
- Modify: `src/modules/cookies/index.ts`

- [ ] **Step 1: Update `src/modules/emoji/index.ts`**

Replace the full contents with:

```ts
import type { OmniModule } from '../../core/types';
import Popup from './Popup.svelte';
import { EMOJI_DEFAULTS } from './storage';

const emoji: OmniModule = {
  id: 'emoji',
  label: 'Emoji',
  icon: '😀',
  Popup,
  storageDefaults: { ...EMOJI_DEFAULTS },
  shortcut: {
    commandName: 'open-emoji',
    description: 'Open emoji picker',
    suggestedKey: 'Alt+Shift+E',
    onInvoke: (ctx) => ctx.openPopupFocusedOn('emoji'),
  },
};

export default emoji;
```

- [ ] **Step 2: Update `src/modules/cookies/index.ts`**

Replace the full contents with:

```ts
import type { OmniModule } from '../../core/types';
import Popup from './Popup.svelte';
import { COOKIES_DEFAULTS } from './storage';

const cookies: OmniModule = {
  id: 'cookies',
  label: 'Cookies',
  icon: '🍪',
  Popup,
  storageDefaults: { ...COOKIES_DEFAULTS },
  shortcut: {
    commandName: 'open-cookies',
    description: 'Open cookies editor',
    suggestedKey: 'Alt+Shift+K',
    onInvoke: (ctx) => ctx.openPopupFocusedOn('cookies'),
  },
};

export default cookies;
```

- [ ] **Step 3: Run tests + typecheck**

```bash
cd /home/kevin/workspace/perso/omni-extension && pnpm test 2>&1 | tail -10
cd /home/kevin/workspace/perso/omni-extension && pnpm check 2>&1 | tail -10
```

Expected: all tests PASS; no new type errors.

- [ ] **Step 4: Commit**

```bash
cd /home/kevin/workspace/perso/omni-extension && git add src/modules/emoji/index.ts src/modules/cookies/index.ts && git commit -m "feat(emoji,cookies): declare open-popup shortcuts"
```

---

## Task 7: Manifest commands + background wiring

Declares the 3 manifest commands so Chrome registers the shortcuts, then wires the dispatcher listener from the background service worker.

**Files:**
- Modify: `manifest.config.ts`
- Modify: `src/background/index.ts`

- [ ] **Step 1: Update `manifest.config.ts`**

Replace the full contents with:

```ts
import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json' with { type: 'json' };

export default defineManifest({
  manifest_version: 3,
  name: 'Omni Extension',
  version: pkg.version,
  description: 'Multi-tool browser extension (Dark Mode + future modules)',
  permissions: ['storage', 'scripting', 'activeTab', 'tabs', 'cookies'],
  host_permissions: ['<all_urls>'],
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/modules/dark/content.ts'],
      run_at: 'document_start',
      all_frames: false,
    },
  ],
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  action: {
    default_popup: 'src/popup/index.html',
  },
  commands: {
    'open-emoji': {
      suggested_key: { default: 'Alt+Shift+E', mac: 'Alt+Shift+E' },
      description: 'Open emoji picker',
    },
    'open-cookies': {
      suggested_key: { default: 'Alt+Shift+K', mac: 'Alt+Shift+K' },
      description: 'Open cookies editor',
    },
    'toggle-dark': {
      suggested_key: { default: 'Alt+Shift+D', mac: 'Alt+Shift+D' },
      description: 'Toggle dark mode for current site',
    },
  },
});
```

- [ ] **Step 2: Wire dispatcher in `src/background/index.ts`**

Replace the full contents with:

```ts
import { modules } from '../core/registry';
import { readStorage, writeStorage, onStorageChange, DEFAULT_STORAGE } from '../core/storage';
import { wireShortcuts } from './shortcuts';
import type { BackgroundCtx, OmniStorage } from '../core/types';

console.log('[omni/bg] service worker started');

async function ensureDefaults(): Promise<OmniStorage> {
  const existing = await readStorage();
  // readStorage returns the literal DEFAULT_STORAGE reference when storage is empty.
  // This identity check is intentional — do not change readStorage to return a copy
  // without also updating this condition.
  if (existing === DEFAULT_STORAGE) {
    console.log('[omni/bg] seeding default storage');
    await writeStorage(DEFAULT_STORAGE);
  }
  return existing;
}

const ctx: BackgroundCtx = {
  getStorage: ensureDefaults,
  onStorageChange,
};

for (const mod of modules) {
  mod.onBackground?.(ctx);
}

wireShortcuts();

chrome.runtime.onInstalled.addListener(() => {
  console.log('[omni/bg] onInstalled fired');
  void ensureDefaults();
});
```

- [ ] **Step 3: Verify build succeeds**

```bash
cd /home/kevin/workspace/perso/omni-extension && pnpm build 2>&1 | tail -20
```

Expected: build succeeds, `dist/manifest.json` is produced. Verify manifest commands:

```bash
cd /home/kevin/workspace/perso/omni-extension && cat dist/manifest.json | grep -A 20 '"commands"'
```

Expected: three `open-emoji` / `open-cookies` / `toggle-dark` entries with the `Alt+Shift+*` keys and descriptions.

- [ ] **Step 4: Commit**

```bash
cd /home/kevin/workspace/perso/omni-extension && git add manifest.config.ts src/background/index.ts && git commit -m "feat(bg): declare commands in manifest and register dispatcher"
```

---

## Task 8: Popup `pendingTab` handoff

The popup reads the session-storage signal on mount and activates the matching module tab.

**Files:**
- Modify: `src/popup/App.svelte`

- [ ] **Step 1: Replace the contents of `src/popup/App.svelte`**

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { modules } from '../core/registry';
  import { consumePendingTab } from '../core/session';

  let active = $state(modules[0]?.id ?? '');
  const activeModule = $derived(modules.find((m) => m.id === active));

  onMount(async () => {
    const pending = await consumePendingTab();
    if (pending && modules.some((m) => m.id === pending)) {
      active = pending;
    }
  });
</script>

<nav class="tabs">
  {#each modules as mod (mod.id)}
    <button class:active={mod.id === active} onclick={() => (active = mod.id)}>
      <span class="icon">{mod.icon}</span>
      <span class="label">{mod.label}</span>
    </button>
  {/each}
</nav>

<section class="panel">
  {#if activeModule}
    {@const Component = activeModule.Popup}
    <Component />
  {/if}
</section>

<style>
  .tabs { display: flex; border-bottom: 1px solid #2a2a30; }
  .tabs button {
    flex: 1; padding: 10px 4px; background: transparent; border: none;
    color: #ccc; cursor: pointer; font-size: 12px; border-bottom: 2px solid transparent;
  }
  .tabs button.active { color: #fff; border-bottom-color: #e4205f; }
  .tabs .icon { display: block; font-size: 16px; }
  .panel { min-height: 240px; }
</style>
```

- [ ] **Step 2: svelte-check + tests**

```bash
cd /home/kevin/workspace/perso/omni-extension && pnpm check 2>&1 | tail -10
cd /home/kevin/workspace/perso/omni-extension && pnpm test 2>&1 | tail -10
```

Expected: no new errors; all tests pass.

- [ ] **Step 3: Commit**

```bash
cd /home/kevin/workspace/perso/omni-extension && git add src/popup/App.svelte && git commit -m "feat(popup): activate pending tab on mount"
```

---

## Task 9: Registry parity test

Assert that every module's `shortcut.suggestedKey` matches the manifest's `suggested_key.default`, and every manifest command has a matching module. Prevents module/manifest drift.

**Files:**
- Modify: `tests/core/registry.test.ts`

- [ ] **Step 1: Replace `tests/core/registry.test.ts`**

```ts
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
```

- [ ] **Step 2: Run the test**

```bash
cd /home/kevin/workspace/perso/omni-extension && pnpm test -- tests/core/registry.test.ts
```

Expected: all tests PASS.

If Vitest fails to import `manifest.config.ts` because `@crxjs/vite-plugin` isn't available at test time, fix by mocking `defineManifest` at the top of the test file:

```ts
vi.mock('@crxjs/vite-plugin', () => ({
  defineManifest: (m: unknown) => m,
}));
```

Place the mock BEFORE any other imports and re-run the test.

- [ ] **Step 3: Commit**

```bash
cd /home/kevin/workspace/perso/omni-extension && git add tests/core/registry.test.ts && git commit -m "test(registry): assert manifest/shortcut parity"
```

---

## Task 10: README documentation

Document the shortcuts and the 4-command cap in the root README.

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update `README.md`**

Open `README.md`. Find the `## Features` section. Right before `### Known limitations`, insert a new subsection:

```markdown
### Keyboard shortcuts

Each module ships a keyboard shortcut. Chrome lets you remap them at `chrome://extensions/shortcuts`.

| Shortcut | Action |
| --- | --- |
| `Alt+Shift+E` | Open popup on Emoji tab, search focused |
| `Alt+Shift+K` | Open popup on Cookies tab |
| `Alt+Shift+D` | Toggle dark mode for current site (no popup) |

Chrome caps user-configurable shortcuts at 4 per extension. One slot is free for a future module.
```

Then in the `### Known limitations` section, append one bullet:

```markdown
- If `chrome.action.openPopup()` is unavailable (Chrome <127), keyboard shortcuts for `Alt+Shift+E` and `Alt+Shift+K` won't open the popup. Click the extension icon instead.
```

- [ ] **Step 2: Commit**

```bash
cd /home/kevin/workspace/perso/omni-extension && git add README.md && git commit -m "docs: document keyboard shortcuts"
```

---

## Task 11: Validation sweep

Run the full validation pipeline before pushing. Fix any new issues; the 5 pre-existing `toSorted` errors in cookies/dark service remain out of scope.

- [ ] **Step 1: svelte-check**

```bash
cd /home/kevin/workspace/perso/omni-extension && pnpm check 2>&1 | tail -20
```

Expected: only the pre-existing 5 `toSorted` errors. Any new errors in files created by this plan → fix.

- [ ] **Step 2: TypeScript**

```bash
cd /home/kevin/workspace/perso/omni-extension && pnpm typecheck 2>&1 | tail -20
```

Expected: same — only pre-existing errors.

- [ ] **Step 3: Lint**

```bash
cd /home/kevin/workspace/perso/omni-extension && pnpm lint 2>&1 | tail -30
```

If auto-fixable, run `pnpm lint:fix` and commit. Otherwise fix manually.

- [ ] **Step 4: Format check + fix**

```bash
cd /home/kevin/workspace/perso/omni-extension && pnpm format:check
```

If any file differs:

```bash
cd /home/kevin/workspace/perso/omni-extension && pnpm format && git add -u && git commit -m "chore: oxfmt shortcuts feature"
```

- [ ] **Step 5: Full test suite + coverage**

```bash
cd /home/kevin/workspace/perso/omni-extension && pnpm test:coverage 2>&1 | tail -40
```

Expected: all PASS; coverage ≥ 80% on `src/background/shortcuts.ts`, `src/core/session.ts`, and `src/modules/dark/service.ts` (the new `nextSiteValueOnToggle`).

- [ ] **Step 6: Production build**

```bash
cd /home/kevin/workspace/perso/omni-extension && pnpm build 2>&1 | tail -20
```

Expected: `dist/` written. Verify `dist/manifest.json` shows the three commands entries.

- [ ] **Step 7: Manual smoke test**

Load the unpacked `dist/` in Chrome (`chrome://extensions` → Developer mode → Load unpacked → select `dist/`).

Verify on a regular web page (e.g. `https://example.com`):

- `Alt+Shift+E` opens the popup on the Emoji tab with the search input focused.
- `Alt+Shift+K` opens the popup on the Cookies tab.
- `Alt+Shift+D` toggles dark mode for the current site (no popup). Press again to toggle back.
- On a `chrome://extensions` tab, `Alt+Shift+D` should no-op (not crash). Open the service worker console to confirm no uncaught errors.
- Open `chrome://extensions/shortcuts` and verify the three shortcuts appear under "Omni Extension" with the expected descriptions.

If any fails, fix in a scoped commit and re-run validation from Step 1.

- [ ] **Step 8: Commit any validation fixes (only if required)**

```bash
cd /home/kevin/workspace/perso/omni-extension && git add -u && git commit -m "chore: post-validation fixes for shortcuts"
```

---

## Task 12: Push + open PR

The branch is stacked on `feat/emoji-picker`. GitHub's PR compare base must therefore be `feat/emoji-picker`, NOT `main` — otherwise the diff will also include all the emoji-picker commits.

- [ ] **Step 1: Push**

```bash
cd /home/kevin/workspace/perso/omni-extension && git push -u origin feat/shortcuts
```

- [ ] **Step 2: Open PR with base `feat/emoji-picker`**

```bash
cd /home/kevin/workspace/perso/omni-extension && gh pr create --base feat/emoji-picker --title "feat: per-module keyboard shortcuts" --body "$(cat <<'EOF'
## Summary

Per-module keyboard shortcuts. Default bindings (remappable at `chrome://extensions/shortcuts`):

- `Alt+Shift+E` — Open popup on Emoji tab
- `Alt+Shift+K` — Open popup on Cookies tab
- `Alt+Shift+D` — Toggle dark mode for current site (no popup)

Stacked on **#4 (feat/emoji-picker)**. Please merge #4 first, then rebase this branch onto `main` before merging.

## Implementation

- New optional `shortcut: OmniShortcut` on the `OmniModule` contract. Background dispatcher (`src/background/shortcuts.ts`) registers one `chrome.commands.onCommand` listener and routes to the owning module.
- Popup-opening modules (emoji, cookies) write a `pendingTab` to `chrome.storage.session` and call `chrome.action.openPopup()`. The popup (`src/popup/App.svelte`) consumes the key on mount and activates the matching tab.
- Dark's shortcut directly mutates storage via a new pure `nextSiteValueOnToggle` helper — the dark popup's `This site only` button now shares the same helper (single source of truth).
- Registry test (`tests/core/registry.test.ts`) cross-checks module `shortcut.suggestedKey` against `manifest.config.ts` commands so manifest/module drift is caught at test time.

## Spec + plan

- Spec: `docs/superpowers/specs/2026-04-24-shortcuts-design.md`
- Plan: `docs/superpowers/plans/2026-04-24-shortcuts.md`

## Test plan

- [x] `pnpm test` green (including new `buildDispatcher`, `session`, and `nextSiteValueOnToggle` cases)
- [x] `pnpm check` clean (pre-existing `toSorted` errors unchanged)
- [x] `pnpm build` produces manifest with all 3 commands
- [ ] Manual smoke: Alt+Shift+E opens Emoji tab with search focused
- [ ] Manual smoke: Alt+Shift+K opens Cookies tab
- [ ] Manual smoke: Alt+Shift+D toggles dark for current site; no-op on `chrome://` pages (no crash)
- [ ] `chrome://extensions/shortcuts` shows all three with the expected descriptions
EOF
)"
```

- [ ] **Step 3: Confirm PR URL**

```bash
cd /home/kevin/workspace/perso/omni-extension && gh pr view --web
```

---

## Notes for the implementer

- **Branch stacking.** This branch is stacked on `feat/emoji-picker`. Do not rebase onto `main` until PR #4 merges. Keep the PR base as `feat/emoji-picker`.
- **Pre-existing errors.** `pnpm check` and `pnpm typecheck` report 5 `toSorted` errors in `src/modules/cookies/service.ts` and `src/modules/dark/service.ts`. These exist on `main` and are out of scope for this branch — do not touch them.
- **Test environment.** `tests/setup.ts` uses `sinon-chrome` which does NOT stub `chrome.storage.session`, `chrome.action.openPopup`, or `chrome.commands`. The new tests either avoid those APIs (`buildDispatcher` is injected) or stub them inline (`session.test.ts`). Don't refactor this into `tests/setup.ts` unless you have a concrete need in a third test.
- **Chrome version.** `chrome.action.openPopup()` requires Chrome 127+. Gracefully logged on failure; users on older Chrome fall back to clicking the extension icon.
- **Svelte 5 runes.** Continue using `$state`, `$derived`, `$effect`. Don't introduce Svelte stores for this feature.
