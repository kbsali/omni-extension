# Emoji Picker Module — Design Spec

**Date:** 2026-04-24
**Status:** Approved design
**Author:** Kevin Saliou (via brainstorming session)

## 1. Purpose

A keyboard-driven emoji picker module for the Omni Extension popup. Open the popup, focus lands in a search input, typing fuzzy-filters an emoji grid, arrow keys move a selection highlight, Enter copies the selected emoji to the clipboard and closes the popup. Escape clears the query (or closes when already empty). Recently copied emojis are remembered across sessions and shown above the main grid when the query is empty.

This is the module referenced as "Smiley keyboard" in `2026-04-21-omni-extension-design.md` § 11 Future Modules.

## 2. Scope (v1)

**In scope:**

- New module `src/modules/emoji/` plugging into the existing `OmniModule` contract.
- Emoji dataset sourced from the `emojibase-data` package (`en/compact.json`), ~1800 entries with per-emoji `annotation` (name) and `tags` (keywords). Mapped once at module load into `EmojiEntry[]`. English only in v1.
- Pure fuzzy filter / scoring service, unit-testable without DOM or `chrome.*`.
- Svelte 5 popup UI: autofocused search input, 8-col grid, recents row, status line.
- Full keyboard flow: typing filters, arrows move selection, Enter copies + closes, Escape clears or closes, Backspace edits.
- Persistent recents (max 16) stored in `chrome.storage.sync` under `omni.modules.emoji.recents`.
- Vitest unit tests for service + storage; registry test updated.

**Out of scope for v1:**

- Skin-tone modifiers.
- Categorised/tabbed browsing.
- User-pinned favourites beyond the auto-maintained recents list.
- Localised (non-English) names/keywords.
- Emoji dataset beyond what `emojibase-data/en/compact.json` ships (covers full standard set at time of writing).
- E2E tests (per project preference for personal projects).

## 3. Architecture

### 3.1 File Structure

```
src/modules/emoji/
├── README.md         # module spec (~15 lines)
├── index.ts          # OmniModule export
├── Popup.svelte      # UI + keyboard handlers
├── service.ts        # pure: fuzzyFilter, pushRecent
├── storage.ts        # EmojiStorage type + defaults
└── data.ts           # EMOJIS: readonly EmojiEntry[]
tests/modules/emoji/
├── service.test.ts
└── storage.test.ts
```

Cross-cutting touches (mirrors the pattern used when `cookies` was added):

- `src/core/types.ts` — add `emoji: EmojiStorage` to `OmniStorage.modules`.
- `src/core/registry.ts` — import + append `emoji`.
- `tests/core/registry.test.ts` — assert `emoji` module is present; the "at least 2" lower bound becomes "at least 3".

### 3.2 Module Export

```ts
// src/modules/emoji/index.ts
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

### 3.3 Permissions

No new manifest permissions. The popup is a user-gesture context, so `navigator.clipboard.writeText()` works without the `clipboardWrite` permission. `chrome.storage.sync` is already requested.

## 4. Data

### 4.1 Entry shape & source

```ts
// src/modules/emoji/data.ts
import compact from 'emojibase-data/en/compact.json';

export interface EmojiEntry {
  char: string; // e.g. "😀"
  name: string; // primary display name, lowercase, e.g. "grinning face"
  keywords: string[]; // from emojibase `tags`, lowercased
}

// Skip skin-tone / regional indicator variants (out of scope for v1).
// emojibase-data's compact shape: { annotation, hexcode, tags?, emoji, order, group, ... }
export const EMOJIS: readonly EmojiEntry[] = compact
  .filter((e) => e.group !== undefined) // drops no-group entries like component skin tones
  .sort((a, b) => a.order - b.order)
  .map((e) => ({
    char: e.emoji,
    name: e.annotation.toLowerCase(),
    keywords: (e.tags ?? []).map((t) => t.toLowerCase()),
  }));
```

`emojibase-data/en/compact.json` ships ~1800 entries. The dataset is imported as a static JSON bundle (Vite resolves it at build time), adds ~80-100KB gzipped to the popup chunk — acceptable for an on-click popup.

Default display order is emojibase's `order` field (keeps related emojis adjacent, e.g. all "grinning" faces together). No sorting at runtime except by score during filtering.

### 4.2 Storage slice

```ts
// src/modules/emoji/storage.ts
export interface EmojiStorage {
  recents: string[]; // emoji chars, most-recent-first, length ≤ RECENTS_MAX
}

export const RECENTS_MAX = 16;
export const EMOJI_DEFAULTS: EmojiStorage = { recents: [] };
```

Living under the existing root key `omni` → `omni.modules.emoji.recents`. Existing installs without the key get defaults merged on first read, same mechanism already used for `cookies` and `dark`.

## 5. Service (pure logic)

```ts
// src/modules/emoji/service.ts
export interface ScoredEmoji {
  entry: EmojiEntry;
  score: number;
}

// Empty / whitespace-only query → all entries in original order.
// Otherwise: scored matches, sorted by score desc, ties broken by original index.
export function fuzzyFilter(query: string, entries: readonly EmojiEntry[]): EmojiEntry[];

// Immutable update: move `char` to front, dedupe, cap at `max`.
export function pushRecent(recents: readonly string[], char: string, max: number): string[];
```

### 5.1 Scoring rules

Query is trimmed and lowercased. For each entry, compute the best score across `name` and each `keyword`, then take the entry's max. Score ≤ 0 means "no match" and the entry is filtered out.

| Match kind                                               | Score |
| -------------------------------------------------------- | ----- |
| `name === query`                                         | 1000  |
| `name.startsWith(query)`                                 | 500   |
| a word in `name` starts with query (split on whitespace) | 300   |
| `keyword === query`                                      | 250   |
| `keyword.startsWith(query)`                              | 150   |
| `name.includes(query)`                                   | 100   |
| `keyword.includes(query)`                                | 50    |
| subsequence match on `name` (all query chars in order)   | 10    |
| no match                                                 | -1    |

**Tie-break:** stable sort preserving original array order (implemented by decorating with index, sorting by `[-score, index]`).

### 5.2 `pushRecent` behaviour

- `pushRecent(['b','c'], 'a', 3)` → `['a','b','c']`.
- `pushRecent(['a','b','c'], 'b', 3)` → `['b','a','c']` (dedup + move to front).
- `pushRecent(['a','b','c'], 'd', 3)` → `['d','a','b']` (cap drops oldest).
- Input array is never mutated.

## 6. UI & Keyboard Flow (`Popup.svelte`)

### 6.1 Layout

```
┌─────────────────────────────────────┐
│ [🔍 search input — autofocused] [×] │  search bar (× clears query)
├─────────────────────────────────────┤
│ Recent                               │  shown only if recents.length > 0
│ 😀 🎉 👍 🔥 ❤️ ...                   │  AND query is empty
├─────────────────────────────────────┤
│ 😀 😃 😄 😁 😆 😅 🤣 😂             │  main grid, 8 columns
│ 🙂 🙃 🫠 😉 😊 😇 🥰 😍             │
│ ...                                  │
├─────────────────────────────────────┤
│ grinning face                        │  status line: name of selected entry
└─────────────────────────────────────┘
```

Width follows the existing popup width. Scroll only the grid region; search bar and status line stay fixed. Grid cell: roughly 28×28px, 4px gap.

### 6.2 Visible list & selection

The **visible list** is the flattened row-major sequence the user navigates:

- Query empty AND recents non-empty → `[...recentEntries, ...EMOJIS]`.
- Query empty AND recents empty → `EMOJIS`.
- Query non-empty → `fuzzyFilter(query, EMOJIS)`. Recents are not shown while filtering.

`recentEntries` is derived by looking up each stored char in `EMOJIS`; chars no longer in the dataset are skipped.

A single `selected: number` indexes into the visible list. It resets to `0` on:

- Popup mount.
- Every change to `query`.

Clamped to `[0, visible.length - 1]`. When the visible list is empty, no selection.

### 6.3 Keyboard bindings

All bindings listen at the search input (the input keeps focus for the entire popup lifetime).

| Key                   | Action                                                                              |
| --------------------- | ----------------------------------------------------------------------------------- |
| printable / Backspace | updates `query`, re-filters, resets `selected` to 0                                 |
| ArrowRight            | `selected = min(selected + 1, last)`                                                |
| ArrowLeft             | `selected = max(selected - 1, 0)`                                                   |
| ArrowDown             | `selected = min(selected + 8, last)`                                                |
| ArrowUp               | `selected = max(selected - 8, 0)`                                                   |
| Enter                 | copy visible[selected].char → update recents → close popup                          |
| Escape                | if `query` non-empty → clear `query` (selection resets to 0); else `window.close()` |

Mouse click on an emoji cell = same as Enter on it.

When `selected` moves, the highlighted cell is scrolled into view via `scrollIntoView({ block: 'nearest' })`.

### 6.4 Copy action

```ts
async function copyAndClose(char: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(char);
  } catch (err) {
    copyError = describeError(err);
    return; // keep popup open so the error is visible
  }
  try {
    await persistRecent(char); // fire-and-forget semantics: failure is swallowed silently
  } catch {
    /* best-effort */
  }
  window.close();
}
```

### 6.5 No-results state

When `fuzzyFilter` returns `[]`, render `No emoji for "<query>"` in the grid region. Arrow keys and Enter are no-ops in that state; Escape still clears the query.

### 6.6 Errors

Only one failure surface: clipboard write. On failure show an inline `Copy failed — <message>` line between the grid and the status line; clear it on next query change or on next successful copy. The popup stays open so the message is actually visible.

## 7. Storage Lifecycle

Read in `onMount`:

```ts
const root = await chrome.storage.sync.get('omni');
recents = root.omni?.modules?.emoji?.recents ?? [];
```

Write on copy, via a shallow-merge that preserves sibling module slices:

```ts
async function persistRecent(char: string): Promise<void> {
  const root = (await chrome.storage.sync.get('omni')).omni ?? {};
  const next = {
    ...root,
    modules: {
      ...(root.modules ?? {}),
      emoji: {
        recents: pushRecent(root.modules?.emoji?.recents ?? [], char, RECENTS_MAX),
      },
    },
  };
  await chrome.storage.sync.set({ omni: next });
}
```

This follows the same shape used by the `dark` module when persisting its slice. No migration is required: adding the `emoji` slice is additive.

## 8. Testing

Vitest unit tests only (no E2E in v1, per project preference for personal projects). Coverage target: 80%+ on `service.ts` and `storage.ts`.

### 8.1 `tests/modules/emoji/service.test.ts`

- `fuzzyFilter('', EMOJIS)` → same length, same order.
- `fuzzyFilter('   ', EMOJIS)` → treated as empty.
- `fuzzyFilter('grin', ...)` → exact-word-start beats pure subsequence.
- Case-insensitive: `'GRIN'` and `'grin'` return identical results.
- Keyword-only hit (query hits a keyword but not the name).
- Subsequence fallback: `'gnf'` matches `"grinning face"` with score 10.
- No match → `[]`.
- Tie-break preserves original array order when scores are equal.

### 8.2 `tests/modules/emoji/storage.test.ts`

- `pushRecent([], '😀', 16)` → `['😀']`.
- Dedup + move-to-front: `pushRecent(['a','b','c'], 'b', 3)` → `['b','a','c']`.
- Cap drops oldest: `pushRecent(['a','b','c'], 'd', 3)` → `['d','a','b']`.
- Immutability: input array is not mutated.

### 8.3 `tests/core/registry.test.ts`

Update to assert the `emoji` module is present alongside `dark` and `cookies`. Lower-bound length becomes ≥ 3.

## 9. Integration Checklist

The implementation plan will translate this into tasks. The touch points are:

1. `package.json` — add `emojibase-data` as a runtime dependency (pinned major version).
2. `tsconfig.json` — confirm `resolveJsonModule: true` (already enabled by the svelte preset); verify the import from `emojibase-data/en/compact.json` type-checks.
3. New files under `src/modules/emoji/` and `tests/modules/emoji/`.
4. `src/core/types.ts` — add `emoji: EmojiStorage` (import `EmojiStorage` from the new module).
5. `src/core/registry.ts` — import + append `emoji`.
6. `tests/core/registry.test.ts` — assert emoji module is registered.
7. `README.md` (root) — list Emoji under Features.

No changes required in `src/background/`, `src/popup/App.svelte`, or `manifest.config.ts` — the module registry pattern handles UI mounting and the popup-context `navigator.clipboard` avoids new permissions.

## 10. Open Questions Deferred to Plan Phase

- Whether rendering ~1800 grid cells at once is fast enough on modest hardware. If not, the escape hatch is `content-visibility: auto` on grid rows (zero structural change) or switching to a windowed renderer (Svelte virtual list) in a follow-up. Decide empirically during implementation.
- Final `EmojiEntry` filter: confirm during implementation whether the `group !== undefined` filter correctly drops component/skin-tone entries without losing wanted emojis. Adjust the filter predicate if emojibase's schema has shifted.
- Grid cell size / gap / highlight styling — pick during implementation to match existing popup styling language (`dark` / `cookies`).
- Whether the status line also shows the Unicode codepoint (like joypixels' `(1f603)`) — deferred; small nice-to-have.
