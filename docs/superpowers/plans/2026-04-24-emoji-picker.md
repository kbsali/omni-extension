# Emoji Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a keyboard-driven emoji picker module to the Omni Extension. Open popup → type to fuzzy-filter a grid of emojis from `emojibase-data` → arrow-key navigate → Enter copies to clipboard & closes the popup → recents persist across sessions.

**Architecture:** New module at `src/modules/emoji/` following the existing `OmniModule` contract (see the `dark` and `cookies` modules for the pattern). Pure service (`fuzzyFilter`, `pushRecent`) tested with Vitest. Svelte 5 `Popup.svelte` owns the UI/keyboard. Storage slice `emoji: { recents: string[] }` under the single `omni` root in `chrome.storage.sync`.

**Tech Stack:** TypeScript strict, Svelte 5 runes, Vitest, `emojibase-data/en/compact.json` (new runtime dep), `chrome.storage.sync`, `navigator.clipboard`.

**Reference spec:** `docs/superpowers/specs/2026-04-24-emoji-picker-design.md`.

---

## Task 0: Create feature branch

**Files:** none (git only).

- [ ] **Step 1: Confirm clean working tree on main**

```bash
git status
git log --oneline -3
```

Expected: On `main`, clean (or only untracked `.claude/`). Latest commit is the emojibase-data spec revision `b76bdd8`.

- [ ] **Step 2: Create and switch to the feature branch**

```bash
git switch -c feat/emoji-picker
```

Expected: `Switched to a new branch 'feat/emoji-picker'`.

---

## Task 1: Install `emojibase-data` dependency

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Install the package**

```bash
pnpm add emojibase-data
```

Expected: added as a dependency (not devDependency). Note the pinned version pnpm chose.

- [ ] **Step 2: Sanity-check the JSON is importable**

```bash
node -e "const c = require('emojibase-data/en/compact.json'); console.log(c.length, c[0])"
```

Expected: a number around `1800` and an object with `emoji`, `annotation`, `tags`, `order`, `group` fields. Confirm the real field names match what the plan assumes. If the shape differs (e.g. compact renamed `annotation` to `name`), note it and adjust Tasks 5 and 2 accordingly before continuing.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add emojibase-data dependency"
```

---

## Task 2: Storage slice + tests

The emoji storage is a single `recents: string[]` plus a cap constant. Types + defaults live in `src/modules/emoji/storage.ts`. Tests assert defaults are correct and that `DEFAULT_STORAGE` wires the slice in.

**Files:**
- Create: `src/modules/emoji/storage.ts`
- Modify: `src/core/types.ts`
- Modify: `src/core/storage.ts`
- Create: `tests/modules/emoji/storage.test.ts`

- [ ] **Step 1: Write the failing storage test**

Create `tests/modules/emoji/storage.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { EMOJI_DEFAULTS, RECENTS_MAX } from '../../../src/modules/emoji/storage';
import { DEFAULT_STORAGE } from '../../../src/core/storage';

describe('modules/emoji/storage', () => {
  it('EMOJI_DEFAULTS has an empty recents array', () => {
    expect(EMOJI_DEFAULTS).toEqual({ recents: [] });
  });

  it('RECENTS_MAX is 16', () => {
    expect(RECENTS_MAX).toBe(16);
  });

  it('DEFAULT_STORAGE.modules.emoji matches EMOJI_DEFAULTS', () => {
    expect(DEFAULT_STORAGE.modules.emoji).toEqual(EMOJI_DEFAULTS);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test -- tests/modules/emoji/storage.test.ts
```

Expected: FAIL — module `src/modules/emoji/storage` not found.

- [ ] **Step 3: Create `src/modules/emoji/storage.ts`**

```ts
export interface EmojiStorage {
  recents: string[];
}

export const RECENTS_MAX = 16;

export const EMOJI_DEFAULTS: EmojiStorage = {
  recents: [],
};
```

- [ ] **Step 4: Add the slice type to `src/core/types.ts`**

Open `src/core/types.ts`. Add the import near the existing `CookiesStorage` import, and add the `emoji` field to `OmniStorage.modules`:

```ts
import type { Component } from 'svelte';
import type { CookiesStorage } from '../modules/cookies/storage';
import type { EmojiStorage } from '../modules/emoji/storage';

export type Mode = 'dark' | 'light' | 'default';

export interface DarkStorage {
  defaultMode: 'dark' | 'light';
  brightness: number;
  sites: Record<string, Mode>;
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

export interface OmniModule {
  id: string;
  label: string;
  icon: string;
  Popup: Component;
  onBackground?: (ctx: BackgroundCtx) => void;
  storageDefaults: Record<string, unknown>;
}
```

- [ ] **Step 5: Wire the slice into `DEFAULT_STORAGE`**

Edit `src/core/storage.ts`:

```ts
import type { OmniStorage } from './types';
import { COOKIES_DEFAULTS } from '../modules/cookies/storage';
import { EMOJI_DEFAULTS } from '../modules/emoji/storage';

const STORAGE_KEY = 'omni';

export const DEFAULT_STORAGE: OmniStorage = {
  version: 1,
  modules: {
    dark: {
      defaultMode: 'light',
      brightness: 1.0,
      sites: {},
    },
    cookies: { ...COOKIES_DEFAULTS },
    emoji: { ...EMOJI_DEFAULTS },
  },
};

export async function readStorage(): Promise<OmniStorage> {
  const result = await chrome.storage.sync.get(STORAGE_KEY);
  return (result[STORAGE_KEY] as OmniStorage | undefined) ?? DEFAULT_STORAGE;
}

export async function writeStorage(storage: OmniStorage): Promise<void> {
  await chrome.storage.sync.set({ [STORAGE_KEY]: storage });
}

export function onStorageChange(cb: (next: OmniStorage, prev: OmniStorage) => void): void {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'sync') return;
    const change = changes[STORAGE_KEY];
    if (!change) return;
    cb(change.newValue as OmniStorage, change.oldValue as OmniStorage);
  });
}
```

- [ ] **Step 6: Run tests to verify green**

```bash
pnpm test -- tests/modules/emoji/storage.test.ts
pnpm test -- tests/modules/cookies/storage.test.ts  # sanity check existing test still green
```

Expected: both PASS.

- [ ] **Step 7: Commit**

```bash
git add src/modules/emoji/storage.ts src/core/types.ts src/core/storage.ts tests/modules/emoji/storage.test.ts
git commit -m "feat(emoji): add storage slice and defaults"
```

---

## Task 3: `pushRecent` service function (TDD)

Pure immutable update helper. No chrome deps. Lives in `service.ts` (spec §5). Tests in `service.test.ts`.

**Files:**
- Create: `src/modules/emoji/service.ts`
- Create: `tests/modules/emoji/service.test.ts`

- [ ] **Step 1: Write failing tests for `pushRecent`**

Create `tests/modules/emoji/service.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { pushRecent } from '../../../src/modules/emoji/service';

describe('modules/emoji/service — pushRecent', () => {
  it('prepends to an empty list', () => {
    expect(pushRecent([], '😀', 16)).toEqual(['😀']);
  });

  it('prepends a new entry', () => {
    expect(pushRecent(['b', 'c'], 'a', 3)).toEqual(['a', 'b', 'c']);
  });

  it('dedupes and moves an existing entry to the front', () => {
    expect(pushRecent(['a', 'b', 'c'], 'b', 3)).toEqual(['b', 'a', 'c']);
  });

  it('caps the length by dropping the oldest', () => {
    expect(pushRecent(['a', 'b', 'c'], 'd', 3)).toEqual(['d', 'a', 'b']);
  });

  it('is noop-returning when the char is already at the front', () => {
    expect(pushRecent(['a', 'b', 'c'], 'a', 3)).toEqual(['a', 'b', 'c']);
  });

  it('does not mutate the input array', () => {
    const input: string[] = ['a', 'b', 'c'];
    pushRecent(input, 'd', 3);
    expect(input).toEqual(['a', 'b', 'c']);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

```bash
pnpm test -- tests/modules/emoji/service.test.ts
```

Expected: FAIL — cannot import from `src/modules/emoji/service`.

- [ ] **Step 3: Create `src/modules/emoji/service.ts` with just `pushRecent`**

```ts
export function pushRecent(
  recents: readonly string[],
  char: string,
  max: number,
): string[] {
  const withoutChar = recents.filter((c) => c !== char);
  const next = [char, ...withoutChar];
  return next.slice(0, max);
}
```

- [ ] **Step 4: Run tests to verify green**

```bash
pnpm test -- tests/modules/emoji/service.test.ts
```

Expected: all 6 `pushRecent` tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/emoji/service.ts tests/modules/emoji/service.test.ts
git commit -m "feat(emoji): add pushRecent helper"
```

---

## Task 4: `fuzzyFilter` service function (TDD)

Ranked filter over `EmojiEntry[]`. Defines the `EmojiEntry` interface (consumed later by `data.ts`).

**Files:**
- Modify: `src/modules/emoji/service.ts`
- Modify: `tests/modules/emoji/service.test.ts`

- [ ] **Step 1: Append failing tests to `service.test.ts`**

Append the following to `tests/modules/emoji/service.test.ts` (after the existing `describe` block — keep the `pushRecent` tests above it):

```ts
import { fuzzyFilter } from '../../../src/modules/emoji/service';
import type { EmojiEntry } from '../../../src/modules/emoji/service';

// Merge this import with the existing `import { pushRecent ...` line at the top
// if your editor has auto-combined; otherwise two imports from the same module
// are fine, just keep a single combined one for cleanliness.

const grinning: EmojiEntry = { char: '😀', name: 'grinning face', keywords: ['smile', 'happy'] };
const grin:     EmojiEntry = { char: '😬', name: 'grimacing face', keywords: ['grin', 'awkward'] };
const cat:      EmojiEntry = { char: '🐱', name: 'cat face', keywords: ['kitten', 'pet'] };
const pizza:    EmojiEntry = { char: '🍕', name: 'pizza', keywords: ['food', 'italian'] };

const ALL: readonly EmojiEntry[] = [grinning, grin, cat, pizza];

describe('modules/emoji/service — fuzzyFilter', () => {
  it('returns all entries in original order for empty query', () => {
    expect(fuzzyFilter('', ALL)).toEqual([...ALL]);
  });

  it('treats whitespace-only query as empty', () => {
    expect(fuzzyFilter('   ', ALL)).toEqual([...ALL]);
  });

  it('is case-insensitive', () => {
    const upper = fuzzyFilter('GRIN', ALL);
    const lower = fuzzyFilter('grin', ALL);
    expect(upper).toEqual(lower);
    expect(upper.length).toBeGreaterThan(0);
  });

  it('ranks name startsWith above keyword match', () => {
    // "grin" starts the name "grinning face" → high score
    // "grin" is a keyword on the grimacing entry → lower score
    const result = fuzzyFilter('grin', ALL);
    expect(result[0]).toBe(grinning);
    expect(result).toContain(grin);
  });

  it('matches keyword-only hits', () => {
    const result = fuzzyFilter('kitten', ALL);
    expect(result).toEqual([cat]);
  });

  it('falls back to subsequence match on name', () => {
    // "gnf" is a subsequence of "grinning face"
    const result = fuzzyFilter('gnf', ALL);
    expect(result).toContain(grinning);
  });

  it('returns empty array for no match', () => {
    expect(fuzzyFilter('xyzzy', ALL)).toEqual([]);
  });

  it('breaks ties by original array index (stable)', () => {
    // Two entries both match "face" via name.includes → same score.
    // Expected order: grinning, grin, cat (each contains "face" in name),
    // preserving original array order.
    const result = fuzzyFilter('face', ALL);
    expect(result).toEqual([grinning, grin, cat]);
  });
});
```

After adding, make sure there's only ONE `import` line for `service`. Final import header should look like:

```ts
import { describe, it, expect } from 'vitest';
import { pushRecent, fuzzyFilter } from '../../../src/modules/emoji/service';
import type { EmojiEntry } from '../../../src/modules/emoji/service';
```

- [ ] **Step 2: Run tests to verify failure**

```bash
pnpm test -- tests/modules/emoji/service.test.ts
```

Expected: the 8 new fuzzy tests FAIL with "fuzzyFilter is not a function" (or similar); pushRecent tests still PASS.

- [ ] **Step 3: Implement `fuzzyFilter` in `src/modules/emoji/service.ts`**

Replace the contents of `src/modules/emoji/service.ts` with:

```ts
export interface EmojiEntry {
  char: string;
  name: string;
  keywords: string[];
}

export interface ScoredEmoji {
  entry: EmojiEntry;
  score: number;
  index: number;
}

function scoreString(target: string, query: string, exactBonus: number, startsWithBonus: number, includesBonus: number): number {
  if (target === query) return exactBonus;
  if (target.startsWith(query)) return startsWithBonus;
  if (target.includes(query)) return includesBonus;
  return 0;
}

function isSubsequence(haystack: string, needle: string): boolean {
  let i = 0;
  for (const ch of haystack) {
    if (ch === needle[i]) i++;
    if (i === needle.length) return true;
  }
  return i === needle.length;
}

function scoreEntry(entry: EmojiEntry, query: string): number {
  let best = 0;

  // Exact / startsWith / includes on the name.
  const nameScore = scoreString(entry.name, query, 1000, 500, 100);
  if (nameScore > best) best = nameScore;

  // Word-in-name startsWith (e.g. query "face" matches "grinning face").
  for (const word of entry.name.split(/\s+/)) {
    if (word !== entry.name && word.startsWith(query)) {
      if (300 > best) best = 300;
      break;
    }
  }

  // Keyword matches.
  for (const keyword of entry.keywords) {
    const kwScore = scoreString(keyword, query, 250, 150, 50);
    if (kwScore > best) best = kwScore;
  }

  // Subsequence fallback on name, only if nothing matched yet.
  if (best === 0 && isSubsequence(entry.name, query)) {
    best = 10;
  }

  return best;
}

export function pushRecent(
  recents: readonly string[],
  char: string,
  max: number,
): string[] {
  const withoutChar = recents.filter((c) => c !== char);
  const next = [char, ...withoutChar];
  return next.slice(0, max);
}

export function fuzzyFilter(
  query: string,
  entries: readonly EmojiEntry[],
): EmojiEntry[] {
  const q = query.trim().toLowerCase();
  if (q === '') return [...entries];

  const scored: ScoredEmoji[] = [];
  entries.forEach((entry, index) => {
    const score = scoreEntry(entry, q);
    if (score > 0) scored.push({ entry, score, index });
  });

  // Sort by score desc, ties broken by original index (stable).
  scored.sort((a, b) => (b.score - a.score) || (a.index - b.index));
  return scored.map((s) => s.entry);
}
```

- [ ] **Step 4: Run tests to verify green**

```bash
pnpm test -- tests/modules/emoji/service.test.ts
```

Expected: all 14 tests PASS (6 pushRecent + 8 fuzzyFilter).

- [ ] **Step 5: Commit**

```bash
git add src/modules/emoji/service.ts tests/modules/emoji/service.test.ts
git commit -m "feat(emoji): add fuzzyFilter with scored ranking"
```

---

## Task 5: `data.ts` — map emojibase-data into `EmojiEntry[]`

Imports `emojibase-data/en/compact.json`, drops Component (skin-tone) entries, sorts by emojibase's `order`, and projects to our `EmojiEntry` shape.

**Files:**
- Create: `src/modules/emoji/data.ts`

- [ ] **Step 1: Create `src/modules/emoji/data.ts`**

```ts
import type { EmojiEntry } from './service';
import compactRaw from 'emojibase-data/en/compact.json';

// Minimal local shape — avoids depending on the `emojibase` types package.
// If the emojibase-data shape drifts (rare), `pnpm typecheck` will flag it.
interface CompactEmojiRaw {
  emoji: string;
  annotation: string;
  tags?: string[];
  order?: number;
  group?: number;
}

// group === 2 is the "Component" group (skin-tone swatches, hair modifiers).
// We drop those since v1 has no skin-tone picker.
const COMPONENT_GROUP = 2;

const raw = compactRaw as unknown as CompactEmojiRaw[];

export const EMOJIS: readonly EmojiEntry[] = raw
  .filter((e) => e.group !== undefined && e.group !== COMPONENT_GROUP)
  .slice()
  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  .map((e) => ({
    char: e.emoji,
    name: e.annotation.toLowerCase(),
    keywords: (e.tags ?? []).map((t) => t.toLowerCase()),
  }));
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors. If TypeScript complains that it cannot resolve the JSON module, confirm `resolveJsonModule: true` is in `tsconfig.json` (it already is per the current config) and retry.

- [ ] **Step 3: Smoke-check the dataset at runtime**

```bash
node --input-type=module -e "const m = await import('./src/modules/emoji/data.ts'); console.log(m.EMOJIS.length, m.EMOJIS[0]);"
```

If `node` refuses to import `.ts` directly, skip this step — the build in Task 9 will catch issues. A quicker alternative:

```bash
pnpm vitest run --reporter=verbose tests/modules/emoji/ 2>&1 | head -40
```

Confirms the existing tests still pass with the new module in the tree.

- [ ] **Step 4: Commit**

```bash
git add src/modules/emoji/data.ts
git commit -m "feat(emoji): load emojibase-data into EMOJIS array"
```

---

## Task 6: Module export + registry wiring

Add `index.ts` for the module, register it in `src/core/registry.ts`, and update the registry test.

**Files:**
- Create: `src/modules/emoji/index.ts`
- Modify: `src/core/registry.ts`
- Modify: `tests/core/registry.test.ts`

- [ ] **Step 1: Update the failing registry test**

Replace `tests/core/registry.test.ts` with:

```ts
import { describe, it, expect } from 'vitest';
import { modules } from '../../src/core/registry';

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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test -- tests/core/registry.test.ts
```

Expected: FAIL — the emoji module is not yet registered.

- [ ] **Step 3: Create `src/modules/emoji/index.ts`**

Note: `Popup` is imported from a `.svelte` file that we haven't created yet. Create a placeholder first so the module type-checks, then fill it in fully in Task 7.

Create `src/modules/emoji/Popup.svelte` as a minimal placeholder:

```svelte
<script lang="ts">
  // placeholder — full implementation in Task 7
</script>

<div>Emoji picker (wip)</div>
```

Create `src/modules/emoji/index.ts`:

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
};

export default emoji;
```

- [ ] **Step 4: Register in `src/core/registry.ts`**

Replace the file:

```ts
import type { OmniModule } from './types';
import dark from '../modules/dark';
import cookies from '../modules/cookies';
import emoji from '../modules/emoji';

export const modules: OmniModule[] = [dark, cookies, emoji];
```

- [ ] **Step 5: Run all tests to verify green**

```bash
pnpm test
```

Expected: all tests PASS (core, cookies, dark, emoji).

- [ ] **Step 6: Commit**

```bash
git add src/modules/emoji/Popup.svelte src/modules/emoji/index.ts src/core/registry.ts tests/core/registry.test.ts
git commit -m "feat(emoji): register module in core registry"
```

---

## Task 7: `Popup.svelte` — search UI with keyboard-driven flow

Full implementation of the popup component. Replaces the placeholder from Task 6. No unit tests for the Svelte component; verify manually in the browser after Task 9's build.

**Files:**
- Modify: `src/modules/emoji/Popup.svelte`

- [ ] **Step 1: Write the full component**

Replace the contents of `src/modules/emoji/Popup.svelte` with:

```svelte
<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { EMOJIS } from './data';
  import { fuzzyFilter, pushRecent, type EmojiEntry } from './service';
  import { RECENTS_MAX } from './storage';

  const COLS = 8;
  const STORAGE_KEY = 'omni';

  let searchInput: HTMLInputElement | undefined = $state();
  let gridContainer: HTMLDivElement | undefined = $state();
  let query = $state('');
  let recents: string[] = $state([]);
  let selected = $state(0);
  let copyError: string | null = $state(null);

  // Built once; emoji dataset is static.
  const byChar = new Map<string, EmojiEntry>(EMOJIS.map((e) => [e.char, e]));

  // Look up EmojiEntry for each recent char; skip any that vanished from the dataset.
  const recentEntries: EmojiEntry[] = $derived.by(() => {
    if (query.trim() !== '') return [];
    return recents.flatMap((char) => {
      const entry = byChar.get(char);
      return entry ? [entry] : [];
    });
  });

  const mainList: EmojiEntry[] = $derived(
    query.trim() === '' ? [...EMOJIS] : fuzzyFilter(query, EMOJIS),
  );

  // Flattened list the user navigates. Recents come first when not searching.
  const visible: EmojiEntry[] = $derived([...recentEntries, ...mainList]);

  const recentsEnd = $derived(recentEntries.length);

  // Reset selection when query changes. Uses an effect on query only.
  $effect(() => {
    // touch `query` to register the dep
    query;
    selected = 0;
  });

  // Keep selection within bounds.
  $effect(() => {
    if (visible.length === 0) {
      selected = 0;
    } else if (selected > visible.length - 1) {
      selected = visible.length - 1;
    } else if (selected < 0) {
      selected = 0;
    }
  });

  onMount(async () => {
    try {
      const root = await chrome.storage.sync.get(STORAGE_KEY);
      const slice = (root[STORAGE_KEY] as { modules?: { emoji?: { recents?: string[] } } } | undefined)?.modules?.emoji;
      recents = slice?.recents ?? [];
    } catch {
      recents = [];
    }
    await tick();
    searchInput?.focus();
  });

  async function persistRecent(char: string): Promise<void> {
    try {
      const root = (await chrome.storage.sync.get(STORAGE_KEY))[STORAGE_KEY] as
        | Record<string, unknown>
        | undefined;
      const rootObj = (root ?? {}) as { modules?: Record<string, unknown> };
      const modulesObj = (rootObj.modules ?? {}) as Record<string, unknown>;
      const emojiSlice = (modulesObj.emoji ?? {}) as { recents?: string[] };
      const nextRecents = pushRecent(emojiSlice.recents ?? [], char, RECENTS_MAX);

      const next = {
        ...rootObj,
        modules: {
          ...modulesObj,
          emoji: { recents: nextRecents },
        },
      };
      await chrome.storage.sync.set({ [STORAGE_KEY]: next });
    } catch {
      // best-effort: copy already succeeded
    }
  }

  async function copyAndClose(char: string): Promise<void> {
    copyError = null;
    try {
      await navigator.clipboard.writeText(char);
    } catch (err) {
      copyError = err instanceof Error ? `Copy failed — ${err.message}` : 'Copy failed';
      return;
    }
    await persistRecent(char);
    window.close();
  }

  async function scrollSelectedIntoView(): Promise<void> {
    await tick();
    const cell = gridContainer?.querySelector<HTMLElement>(`[data-index="${selected}"]`);
    cell?.scrollIntoView({ block: 'nearest' });
  }

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      const entry = visible[selected];
      if (entry) void copyAndClose(entry.char);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      if (query.length > 0) {
        query = '';
      } else {
        window.close();
      }
      return;
    }
    if (visible.length === 0) return;
    const last = visible.length - 1;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      selected = Math.min(selected + 1, last);
      void scrollSelectedIntoView();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      selected = Math.max(selected - 1, 0);
      void scrollSelectedIntoView();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      selected = Math.min(selected + COLS, last);
      void scrollSelectedIntoView();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selected = Math.max(selected - COLS, 0);
      void scrollSelectedIntoView();
    }
  }

  function onCellClick(index: number): void {
    selected = index;
    const entry = visible[index];
    if (entry) void copyAndClose(entry.char);
  }

  function clearQuery(): void {
    query = '';
    searchInput?.focus();
  }
</script>

<div class="emoji-popup">
  <div class="search">
    <input
      bind:this={searchInput}
      bind:value={query}
      onkeydown={onKeydown}
      placeholder="Search emoji…"
      type="text"
      aria-label="Search emoji"
    />
    {#if query.length > 0}
      <button class="clear" onclick={clearQuery} aria-label="Clear search">×</button>
    {/if}
  </div>

  <div class="grid" bind:this={gridContainer}>
    {#if visible.length === 0}
      <div class="empty">No emoji for "{query}"</div>
    {:else}
      {#if recentEntries.length > 0}
        <div class="section-label">Recent</div>
      {/if}
      <div class="cells">
        {#each visible as entry, index (entry.char + '@' + index)}
          {#if index === recentsEnd && recentEntries.length > 0}
            <div class="divider"></div>
          {/if}
          <button
            type="button"
            class="cell"
            class:selected={index === selected}
            data-index={index}
            onclick={() => onCellClick(index)}
            aria-label={entry.name}
            title={entry.name}
          >
            {entry.char}
          </button>
        {/each}
      </div>
    {/if}
  </div>

  {#if copyError}
    <div class="copy-error">{copyError}</div>
  {/if}

  <div class="status">
    {visible[selected]?.name ?? ''}
  </div>
</div>

<style>
  .emoji-popup {
    display: flex;
    flex-direction: column;
    height: 100%;
    color: #eee;
    font-family: system-ui, sans-serif;
    font-size: 13px;
  }
  .search {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 8px 12px;
    border-bottom: 1px solid #2a2a30;
  }
  .search input {
    flex: 1;
    padding: 6px 8px;
    background: #0f0f12;
    color: #eee;
    border: 1px solid #2a2a30;
    border-radius: 4px;
    font-size: 13px;
  }
  .search input:focus {
    outline: none;
    border-color: #e4205f;
  }
  .clear {
    background: transparent;
    border: none;
    color: #aaa;
    cursor: pointer;
    font-size: 16px;
    padding: 0 6px;
    line-height: 1;
  }
  .clear:hover { color: #fff; }

  .grid {
    flex: 1;
    overflow-y: auto;
    padding: 6px 8px;
    min-height: 220px;
    max-height: 320px;
  }
  .section-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    opacity: 0.5;
    padding: 4px 2px;
  }
  .cells {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: 2px;
  }
  .divider {
    grid-column: 1 / -1;
    height: 1px;
    background: #2a2a30;
    margin: 4px 0;
  }
  .cell {
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    cursor: pointer;
    font-size: 18px;
    line-height: 1;
    color: inherit;
    padding: 0;
  }
  .cell:hover { background: #1b1b20; }
  .cell.selected { border-color: #e4205f; background: #1b1b20; }
  .empty {
    padding: 32px 12px;
    text-align: center;
    opacity: 0.6;
  }

  .copy-error {
    padding: 6px 12px;
    color: #f77;
    font-size: 12px;
    border-top: 1px solid #3a1a1a;
    background: #1a0f12;
  }
  .status {
    padding: 6px 12px;
    border-top: 1px solid #2a2a30;
    opacity: 0.7;
    font-size: 12px;
    min-height: 18px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
```

- [ ] **Step 2: Typecheck and test**

```bash
pnpm check
pnpm test
```

Expected: no type errors; all existing tests still PASS.

- [ ] **Step 3: Manual smoke test (dev server)**

```bash
pnpm build
```

Expected: `dist/` produced without errors. Load the unpacked extension in `chrome://extensions` (or reload if already loaded), click the popup, switch to the **Emoji** tab.

Verify:
- Search input is focused on popup open.
- Typing `grin` filters to grinning faces; first result highlighted.
- Arrow keys (Left/Right/Up/Down) move the highlight.
- Enter copies the highlighted emoji and closes the popup.
- Paste anywhere — the emoji is on the clipboard.
- Reopen the popup — the emoji just copied appears under "Recent".
- Escape clears a non-empty search; Escape on empty search closes the popup.

If any of these fail, fix before committing.

- [ ] **Step 4: Commit**

```bash
git add src/modules/emoji/Popup.svelte
git commit -m "feat(emoji): implement search UI with keyboard flow"
```

---

## Task 8: Module README + root README update

**Files:**
- Create: `src/modules/emoji/README.md`
- Modify: `README.md` (root)

- [ ] **Step 1: Create `src/modules/emoji/README.md`**

```markdown
# Emoji Module

Keyboard-driven emoji picker. Search, arrow-navigate, Enter to copy, Escape to clear/close.

## Storage shape

`emoji: { recents: string[] }` under the root `omni` key. Most-recent-first, capped at `RECENTS_MAX = 16`.

## Data source

`emojibase-data/en/compact.json`. Loaded at module init and filtered to exclude the Component group (skin-tone swatches). See `./data.ts`.

## Known limitations

- English names/keywords only.
- No skin-tone picker.
- No categories / tabs — everything is searchable as one flat grid.
- Rendering ~1800 grid cells at once. Performance is fine on modern hardware; if it becomes a problem on low-end devices, a windowed renderer or `content-visibility: auto` on grid rows are the escape hatches.
```

- [ ] **Step 2: Update the root `README.md`**

Replace the file's contents with:

```markdown
# Omni Extension

Multi-tool browser extension (Manifest V3).

## Install (dev)

```bash
pnpm install
pnpm build
```

Then in Chrome:

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `dist/` folder

## Develop

```bash
pnpm dev
```

HMR-enabled. Reload the extension in Chrome when `manifest.json` changes.

## Test

```bash
pnpm test
pnpm test:coverage
```

## Features

### Dark Mode

Per-site (eTLD+1) dark mode via CSS filter inversion.

- Toggle current site — click `This site only`
- Flip global default — click `All sites`
- Adjust brightness 50%–100%
- Settings sync via `chrome.storage.sync`

### Cookies

Lightweight cookie viewer/editor scoped to the current tab's eTLD+1. See [`src/modules/cookies/README.md`](src/modules/cookies/README.md).

### Emoji

Keyboard-driven emoji picker. Type to fuzzy-filter ~1800 emojis, arrow-key to navigate, Enter to copy. Recently used emojis are remembered and shown first. See [`src/modules/emoji/README.md`](src/modules/emoji/README.md).

### Known limitations

- Dark mode uses `filter: invert(1) hue-rotate(180deg)` — not a color-aware dark mode.
- Dark mode per-site rules use eTLD+1 granularity.
- No E2E tests yet.

## Architecture

See [`docs/superpowers/specs/2026-04-21-omni-extension-design.md`](docs/superpowers/specs/2026-04-21-omni-extension-design.md).

Adding a new module:

1. Create `src/modules/<name>/` with `index.ts` exporting an `OmniModule`
2. Import + register in `src/core/registry.ts`

No shell code changes required.

## License

MIT
```

- [ ] **Step 3: Commit**

```bash
git add src/modules/emoji/README.md README.md
git commit -m "docs(emoji): add module readme and feature entry"
```

---

## Task 9: Full validation sweep

Catches anything prior tasks missed: typecheck, lint, format, full test, build.

- [ ] **Step 1: Typecheck (Svelte + TS)**

```bash
pnpm check
pnpm typecheck
```

Expected: 0 errors, 0 warnings. Fix anything that surfaces before continuing.

- [ ] **Step 2: Lint**

```bash
pnpm lint
```

Expected: no new oxlint errors. If something flags inside the new module, fix it (or `pnpm lint:fix` for auto-fixable issues).

- [ ] **Step 3: Format**

```bash
pnpm format:check
```

If files differ from oxfmt:

```bash
pnpm format
git add -u
git commit -m "chore: oxfmt emoji module"
```

- [ ] **Step 4: Full test suite with coverage**

```bash
pnpm test:coverage
```

Expected: all tests PASS; coverage ≥ 80% on `src/modules/emoji/service.ts` and `src/modules/emoji/storage.ts`.

- [ ] **Step 5: Production build**

```bash
pnpm build
```

Expected: `dist/` written with no errors. Note the popup chunk size — the emojibase-data JSON should add roughly 80-120KB gzipped to the popup bundle. If it ships as a separate chunk, that's also fine.

- [ ] **Step 6: Manual QA re-check (if any code changed since Task 7)**

Reload the unpacked extension in Chrome and re-run the Task 7 step-3 checklist. Any regression → fix and re-run.

- [ ] **Step 7: Commit fixes (only if any were required)**

```bash
git add -u
git commit -m "chore: post-validation fixes"
```

---

## Task 10: Push branch and open PR

**Files:** none (git / gh only).

- [ ] **Step 1: Push the branch**

```bash
git push -u origin feat/emoji-picker
```

- [ ] **Step 2: Open the PR**

```bash
gh pr create --title "feat: add emoji picker module" --body "$(cat <<'EOF'
## Summary
- New `emoji` module: keyboard-driven emoji picker with fuzzy search, arrow navigation, and Enter-to-copy.
- Dataset from `emojibase-data/en/compact.json` (~1800 entries, Component group skipped).
- Persistent recents (max 16) under `omni.modules.emoji` in `chrome.storage.sync`.

## Implementation notes
- Follows the existing `OmniModule` contract (see `dark` and `cookies` modules).
- Pure `fuzzyFilter` / `pushRecent` in `service.ts`, unit-tested.
- No new manifest permissions: `navigator.clipboard.writeText` works inside the popup's user-gesture context.

## Spec
`docs/superpowers/specs/2026-04-24-emoji-picker-design.md`

## Test plan
- [ ] `pnpm test` green
- [ ] `pnpm build` green
- [ ] Load unpacked in Chrome: popup opens with search focused
- [ ] Typing filters emojis per-keystroke
- [ ] Arrow keys move highlight; Enter copies and closes popup
- [ ] Escape clears non-empty query; Escape on empty query closes popup
- [ ] Recents appear on next popup open, most-recent-first
EOF
)"
```

- [ ] **Step 3: Confirm PR URL**

```bash
gh pr view --web
```

(or just note the URL from the previous command's output)

---

## Notes for the implementer

- **Module contract:** See `src/core/types.ts` → `OmniModule`. Do not change the shell (`src/popup/App.svelte`), background (`src/background/index.ts`), or manifest.
- **Test runner:** Vitest (`pnpm test`). Chrome APIs are stubbed via `sinon-chrome` at `tests/setup.ts`. No chrome.scripting mocks needed for this module.
- **Svelte version:** 5 with runes mode (`$state`, `$derived`, `$effect`). Don't import from `svelte/store` for this module.
- **Storage write:** Task 7's `persistRecent` does a read-merge-write. If the module ever grows additional writes, consider extracting a helper to `src/core/storage.ts` — for v1, inlining is fine (matches the pattern in `dark/service.ts`).
- **Clipboard:** `navigator.clipboard.writeText` works in the popup without `clipboardWrite` permission because the popup opens under a user gesture. Do not add the permission.
