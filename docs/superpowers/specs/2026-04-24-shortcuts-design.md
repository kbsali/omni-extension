# Keyboard Shortcuts — Design Spec

**Date:** 2026-04-24
**Status:** Approved design
**Author:** Kevin Saliou (via brainstorming session)

## 1. Purpose

Per-module keyboard shortcuts for the Omni Extension. Each module declares its own command binding and action; the background service worker routes Chrome's `commands` events to the right module. The user never has to click the extension icon to trigger a module's primary action.

Default bindings:

| Module  | Shortcut      | Action                                             |
| ------- | ------------- | -------------------------------------------------- |
| Emoji   | `Alt+Shift+E` | Open popup on Emoji tab, search input auto-focused |
| Cookies | `Alt+Shift+K` | Open popup on Cookies tab                          |
| Dark    | `Alt+Shift+D` | Toggle dark mode for the current site (no popup)   |

Per-module actions (not uniform popup-opening) are chosen so that high-frequency actions — toggling dark mode — don't require a UI roundtrip.

## 2. Scope (v1)

**In scope:**

- New optional `shortcut: OmniShortcut` field on the `OmniModule` contract.
- New `src/background/shortcuts.ts` that registers a single `chrome.commands.onCommand` listener and dispatches to modules via a registry-derived `commandName → OmniShortcut` map.
- New `src/core/session.ts` helper for the popup handoff (`setPendingTab` / `consumePendingTab` against `chrome.storage.session`).
- Manifest `commands` entries for the three modules, declared in `manifest.config.ts`.
- Popup reads `pendingTab` on mount and activates the matching tab.
- Dark module's toggle logic extracted to a pure helper (`nextSiteValueOnToggle`) so both the popup button and the shortcut share a single implementation.
- Vitest unit tests for the new helpers and the shortcut dispatcher.

**Out of scope for v1:**

- User-facing remap UI inside the popup — Chrome already provides `chrome://extensions/shortcuts`.
- Chord / multi-key shortcuts (Chrome doesn't support).
- Global (always-available) shortcuts (`global: true` in manifest commands) — defer until there is a concrete need.
- Showing each module's shortcut as a hint in its tab UI.
- E2E tests.

## 3. Architecture

### 3.1 File Structure

```
src/
├── background/
│   ├── index.ts              # existing; calls wireShortcuts() at module-load
│   └── shortcuts.ts          # NEW — dispatcher + ShortcutCtx factory
├── core/
│   ├── session.ts            # NEW — typed chrome.storage.session helpers
│   ├── storage.ts            # unchanged
│   ├── registry.ts           # unchanged
│   └── types.ts              # EXTENDED — adds OmniShortcut, ShortcutCtx
├── modules/
│   ├── dark/
│   │   ├── index.ts          # adds shortcut (calls toggle helper below)
│   │   ├── service.ts        # adds nextSiteValueOnToggle export
│   │   └── Popup.svelte      # refactored to use nextSiteValueOnToggle
│   ├── cookies/index.ts      # adds shortcut (open popup on its tab)
│   └── emoji/index.ts        # adds shortcut (open popup on its tab)
├── popup/
│   └── App.svelte            # reads pendingTab on mount
manifest.config.ts             # extended — commands map
tests/
├── background/
│   └── shortcuts.test.ts     # NEW — dispatcher
├── core/
│   ├── session.test.ts       # NEW
│   └── registry.test.ts      # extended — asserts shortcut command uniqueness + manifest parity
└── modules/dark/service.test.ts  # extended — nextSiteValueOnToggle cases
```

### 3.2 Contract extension

```ts
// src/core/types.ts (appended)

export interface ShortcutCtx {
  getStorage: () => Promise<OmniStorage>;
  writeStorage: (next: OmniStorage) => Promise<void>;
  getActiveTab: () => Promise<chrome.tabs.Tab | undefined>;
  openPopupFocusedOn: (moduleId: string) => Promise<void>;
}

export interface OmniShortcut {
  commandName: string; // must equal a key in manifest `commands`
  description: string; // surfaced in chrome://extensions/shortcuts
  suggestedKey: string; // e.g. 'Alt+Shift+E' — documentation, cross-checked against manifest
  onInvoke: (ctx: ShortcutCtx) => Promise<void> | void;
}

export interface OmniModule {
  id: string;
  label: string;
  icon: string;
  Popup: Component;
  onBackground?: (ctx: BackgroundCtx) => void;
  storageDefaults: Record<string, unknown>;
  shortcut?: OmniShortcut; // NEW
}
```

`suggestedKey` is duplicated from `manifest.config.ts` on purpose so a unit test can assert the two stay in sync. Chrome reads the real binding from the manifest, not from this field.

### 3.3 Session storage helper

```ts
// src/core/session.ts
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

Atomicity: the popup is the only reader and clears on read, so a second read (in a future popup open) correctly sees `undefined`. The session area survives tab/popup close but clears on browser restart — exactly the right lifetime for "pending navigation intent".

### 3.4 Background dispatcher

```ts
// src/background/shortcuts.ts
import { modules } from '../core/registry';
import { readStorage, writeStorage } from '../core/storage';
import { setPendingTab } from '../core/session';
import type { ShortcutCtx } from '../core/types';

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
    // required user gesture, so this should only fail on version mismatch.
    console.warn('[omni/shortcuts] openPopup failed:', err);
  }
}

export function wireShortcuts(): void {
  const ctx: ShortcutCtx = {
    getStorage: readStorage,
    writeStorage,
    getActiveTab,
    openPopupFocusedOn,
  };

  const byCommand = new Map(
    modules
      .filter((m) => m.shortcut !== undefined)
      .map((m) => [m.shortcut!.commandName, m.shortcut!]),
  );

  chrome.commands.onCommand.addListener(async (command) => {
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
  });
}
```

`src/background/index.ts` calls `wireShortcuts()` after the existing `onBackground` loop. Order doesn't matter — the listener fires on user action, not at load time.

## 4. Per-module wiring

### 4.1 Emoji & Cookies

Both delegate to the generic helper.

```ts
// src/modules/emoji/index.ts (addition inside the default export)
shortcut: {
  commandName: 'open-emoji',
  description: 'Open emoji picker',
  suggestedKey: 'Alt+Shift+E',
  onInvoke: (ctx) => ctx.openPopupFocusedOn('emoji'),
}

// src/modules/cookies/index.ts (same pattern)
shortcut: {
  commandName: 'open-cookies',
  description: 'Open cookies editor',
  suggestedKey: 'Alt+Shift+K',
  onInvoke: (ctx) => ctx.openPopupFocusedOn('cookies'),
}
```

### 4.2 Dark — direct toggle

Extract the toggle math to a pure helper so popup + shortcut share the logic.

```ts
// src/modules/dark/service.ts (addition)
import type { Mode } from '../../core/types';

export function nextSiteValueOnToggle(current: Mode, defaultMode: 'dark' | 'light'): Mode {
  const effective = current === 'dark' || current === 'light' ? current : defaultMode;
  const nextEffective = effective === 'dark' ? 'light' : 'dark';
  return nextEffective === defaultMode ? 'default' : nextEffective;
}
```

```ts
// src/modules/dark/index.ts
import { extractETLD1 } from '../../core/domain';
import { nextSiteValueOnToggle } from './service';
import { setSiteMode } from './storage';
import type { ShortcutCtx } from '../../core/types';

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

// ...existing const dark: OmniModule = { ... } gains:
shortcut: {
  commandName: 'toggle-dark',
  description: 'Toggle dark mode for current site',
  suggestedKey: 'Alt+Shift+D',
  onInvoke: toggleDarkForCurrentSite,
}
```

### 4.3 Popup (`src/popup/App.svelte`)

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
```

No other changes to the popup shell. Each module's `Popup.svelte` handles its own on-mount focus (e.g. Emoji focuses its search input).

## 5. Manifest

`manifest.config.ts` adds:

```ts
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
```

Explicit `mac:` avoids Chrome's default auto-substitution of `Alt` to `Command+Shift` on macOS. Both platforms use the same binding.

## 6. Edge cases

| Scenario                                                           | Behaviour                                                                                                                                                                               |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shortcut pressed on `chrome://`, `about:`, or `file://` tab (dark) | `tab.url` is absent or `extractETLD1` returns null → `onInvoke` no-ops silently.                                                                                                        |
| `chrome.action.openPopup()` fails (Chrome <127, no focused window) | Logged to console. `pendingTab` remains set; cleared on the next popup open via any path. Minor UX glitch, acceptable for v1.                                                           |
| User spam-presses the shortcut                                     | Each press re-sets `pendingTab` to the same value; idempotent.                                                                                                                          |
| Popup is already open when shortcut fires                          | `openPopup()` is a no-op on already-open popups. The existing mounted `App.svelte` has already run `onMount` — the new `pendingTab` will be consumed on the _next_ open. v1-acceptable. |
| Unknown command fired (dead manifest entry or removed module)      | Warn, no throw.                                                                                                                                                                         |
| `onInvoke` throws                                                  | Caught and logged. The extension stays functional.                                                                                                                                      |

## 7. Testing

### 7.1 `tests/modules/dark/service.test.ts` (extend)

- `nextSiteValueOnToggle('default', 'light')` → `'dark'` (force dark from neutral).
- `nextSiteValueOnToggle('dark', 'light')` → `'default'` (explicit dark on light default → clear override, since new effective is light which equals default).
- `nextSiteValueOnToggle('light', 'light')` → `'dark'` (force dark even though defaults match).
- `nextSiteValueOnToggle('default', 'dark')` → `'light'`.
- `nextSiteValueOnToggle('light', 'dark')` → `'default'`.
- `nextSiteValueOnToggle('dark', 'dark')` → `'light'`.

### 7.2 `tests/core/session.test.ts` (new)

- `setPendingTab('emoji')` then `consumePendingTab()` → `'emoji'`.
- `consumePendingTab()` called twice → second returns `undefined`.
- `consumePendingTab()` with no prior set → `undefined`.

### 7.3 `tests/core/registry.test.ts` (extend)

- Every module with a `shortcut` has a unique `commandName` (no two modules share).
- For each module with `shortcut`, import `manifest.config.ts` and assert `commands[shortcut.commandName].suggested_key.default === shortcut.suggestedKey`. This prevents manifest/module drift.
- Every `commandName` declared in the manifest is owned by exactly one registered module (no orphans).

### 7.4 `tests/background/shortcuts.test.ts` (new)

- Mock `chrome.commands.onCommand` via `sinon-chrome` (stub the listener registry).
- Inject a fake registry of 2 modules with `shortcut` definitions that capture invocations.
- Call `wireShortcuts()`, then trigger the listener with a known command — assert the right module's `onInvoke` ran with a `ctx` object whose helpers are functions.
- Trigger with an unknown command — assert it logs a warning and doesn't throw.
- Have `onInvoke` throw — assert the thrown error is caught and logged.

Coverage target: 80%+ on `src/background/shortcuts.ts`, `src/core/session.ts`, and the new `nextSiteValueOnToggle`.

## 8. Integration checklist

1. `src/core/types.ts` — add `ShortcutCtx`, `OmniShortcut`, extend `OmniModule`.
2. `src/core/session.ts` — new file.
3. `src/background/shortcuts.ts` — new file.
4. `src/background/index.ts` — import + call `wireShortcuts()`.
5. `src/modules/dark/service.ts` — add `nextSiteValueOnToggle`.
6. `src/modules/dark/Popup.svelte` — refactor `onToggleSite` to use the new helper (keeps single source of truth).
7. `src/modules/dark/index.ts` — add `shortcut` + `toggleDarkForCurrentSite`.
8. `src/modules/cookies/index.ts` — add `shortcut`.
9. `src/modules/emoji/index.ts` — add `shortcut`.
10. `src/popup/App.svelte` — read `pendingTab` on mount.
11. `manifest.config.ts` — add `commands` block.
12. Tests per §7.
13. `README.md` — document the three shortcuts and the 4-command limit note.

No new permissions required (`storage` already grants `chrome.storage.session` access).

## 9. Known limitations

- Chrome hard-caps user-configurable shortcuts at 4 per extension. We use 3; one slot is free for a future module. Beyond that, modules must share or skip.
- If the user rebinds a shortcut in `chrome://extensions/shortcuts`, `OmniShortcut.suggestedKey` becomes a stale documentation string. The registry test validates only the manifest-declared default, which is what we ship.
- When the popup is already open, a shortcut press won't re-route its active tab until the next open. Fixing this requires cross-context messaging, deferred.

## 10. Open questions deferred to plan phase

- Whether the popup should render a small `[Alt+Shift+E]` hint next to each tab label — nice UX polish, not blocking.
- Whether `openPopupFocusedOn` should also focus a specific tab within the target module's UI (not applicable today; emoji already auto-focuses its search).
