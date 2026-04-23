# Cookies Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Cookies Editor module to the Omni Extension — second module after Dark Mode — letting the user view, edit (value + expires), delete, add, and export cookies for the current tab's eTLD+1, all scoped to one folder under `src/modules/cookies/`.

**Architecture:** Plugs into the existing `OmniModule` registry. Popup reads/writes `chrome.cookies.*` directly (no background hook). Pure logic (URL construction, JSON export, date parsing) lives in `service.ts` with 80%+ Vitest coverage. Svelte 5 runes popup is tested manually per the spec (no component tests).

**Tech Stack:** Chrome MV3, Svelte 5 (runes), TypeScript strict, Vitest + sinon-chrome, `chrome.cookies` API, `tldts` (already in project via `core/domain.ts`).

**Spec:** `docs/superpowers/specs/2026-04-22-cookies-editor-design.md`

---

## File Structure

**Create:**
- `src/modules/cookies/README.md` — 10-line module spec
- `src/modules/cookies/storage.ts` — `CookiesStorage` + `COOKIES_DEFAULTS`
- `src/modules/cookies/service.ts` — pure helpers (`buildCookieUrl`, `parseExpires`, `formatExpiresInput`, `toExportFilename`, `toExportJson`)
- `src/modules/cookies/index.ts` — `OmniModule` export
- `src/modules/cookies/Popup.svelte` — full UI (list, accordion editor, footer actions)
- `tests/modules/cookies/storage.test.ts`
- `tests/modules/cookies/service.test.ts`

**Modify:**
- `src/core/types.ts` — extend `OmniStorage.modules` with `cookies: CookiesStorage`
- `src/core/storage.ts` — extend `DEFAULT_STORAGE.modules` with `cookies: {}`
- `src/core/registry.ts` — import + append `cookies` module
- `manifest.config.ts` — add `'cookies'` to `permissions`
- `tests/core/registry.test.ts` — extend assertion to include `cookies`

## Plan-phase resolutions (were deferred in spec)

- **Draft row representation:** Svelte-local `draft` state (`{ name, value, expires } | null`), rendered above the fetched cookie list when present. Not mixed into the cookies array.
- **Draft row action button:** shows `Cancel` instead of `Delete`. On Save → `chrome.cookies.set` → on success, clear draft and reload list.
- **Error copy:** single red line under the row. Format: `Failed: <message>` where message is `chrome.runtime.lastError?.message ?? err.message ?? 'unknown error'`. If `set` resolves to `null` with no error, show `Chrome refused this cookie (flag mismatch?)`.

---

## Task 1: Storage slice (type + defaults + tests)

**Files:**
- Create: `src/modules/cookies/storage.ts`
- Create: `tests/modules/cookies/storage.test.ts`
- Modify: `src/core/types.ts`
- Modify: `src/core/storage.ts`

- [ ] **Step 1: Write the failing storage test**

Create `tests/modules/cookies/storage.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { COOKIES_DEFAULTS } from '../../../src/modules/cookies/storage';
import { DEFAULT_STORAGE } from '../../../src/core/storage';

describe('modules/cookies/storage', () => {
  it('COOKIES_DEFAULTS is an empty object', () => {
    expect(COOKIES_DEFAULTS).toEqual({});
  });

  it('DEFAULT_STORAGE.modules.cookies exists and equals {}', () => {
    expect(DEFAULT_STORAGE.modules.cookies).toEqual({});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/modules/cookies/storage.test.ts`
Expected: FAIL — `Cannot find module ...cookies/storage` and/or `modules.cookies` undefined.

- [ ] **Step 3: Create the cookies storage module**

Create `src/modules/cookies/storage.ts`:

```typescript
export type CookiesStorage = Record<string, never>;

export const COOKIES_DEFAULTS: CookiesStorage = {};
```

- [ ] **Step 4: Extend OmniStorage type**

Edit `src/core/types.ts` — add the `CookiesStorage` import reference inline and extend the `OmniStorage.modules` shape:

```typescript
import type { Component } from 'svelte';
import type { CookiesStorage } from '../modules/cookies/storage';

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

- [ ] **Step 5: Extend DEFAULT_STORAGE**

Edit `src/core/storage.ts` — add `cookies` slice (import `COOKIES_DEFAULTS` at top):

```typescript
import type { OmniStorage } from './types';
import { COOKIES_DEFAULTS } from '../modules/cookies/storage';

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
  },
};

export async function readStorage(): Promise<OmniStorage> {
  const result = await chrome.storage.sync.get(STORAGE_KEY);
  return (result[STORAGE_KEY] as OmniStorage | undefined) ?? DEFAULT_STORAGE;
}

export async function writeStorage(storage: OmniStorage): Promise<void> {
  await chrome.storage.sync.set({ [STORAGE_KEY]: storage });
}

export function onStorageChange(
  cb: (next: OmniStorage, prev: OmniStorage) => void,
): void {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'sync') return;
    const change = changes[STORAGE_KEY];
    if (!change) return;
    cb(change.newValue as OmniStorage, change.oldValue as OmniStorage);
  });
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm test tests/modules/cookies/storage.test.ts`
Expected: PASS (2 tests).

Run: `pnpm typecheck`
Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add src/modules/cookies/storage.ts src/core/types.ts src/core/storage.ts tests/modules/cookies/storage.test.ts
git commit -m "feat(cookies): add storage slice scaffolding"
```

---

## Task 2: Service — buildCookieUrl

**Files:**
- Create: `src/modules/cookies/service.ts`
- Create: `tests/modules/cookies/service.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/modules/cookies/service.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildCookieUrl } from '../../../src/modules/cookies/service';

describe('modules/cookies/service — buildCookieUrl', () => {
  it('uses https when secure=true', () => {
    expect(buildCookieUrl({ domain: 'x.com', path: '/', secure: true }))
      .toBe('https://x.com/');
  });

  it('uses http when secure=false', () => {
    expect(buildCookieUrl({ domain: 'x.com', path: '/', secure: false }))
      .toBe('http://x.com/');
  });

  it('strips a leading dot from the domain', () => {
    expect(buildCookieUrl({ domain: '.x.com', path: '/', secure: true }))
      .toBe('https://x.com/');
  });

  it('defaults path to "/" when empty', () => {
    expect(buildCookieUrl({ domain: 'x.com', path: '', secure: true }))
      .toBe('https://x.com/');
  });

  it('preserves non-root paths', () => {
    expect(buildCookieUrl({ domain: 'x.com', path: '/api', secure: true }))
      .toBe('https://x.com/api');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/modules/cookies/service.test.ts`
Expected: FAIL — `Cannot find module ...cookies/service`.

- [ ] **Step 3: Implement buildCookieUrl**

Create `src/modules/cookies/service.ts`:

```typescript
export function buildCookieUrl(
  c: Pick<chrome.cookies.Cookie, 'domain' | 'path' | 'secure'>,
): string {
  const scheme = c.secure ? 'https' : 'http';
  const host = c.domain.startsWith('.') ? c.domain.slice(1) : c.domain;
  const path = c.path || '/';
  return `${scheme}://${host}${path}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/modules/cookies/service.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/modules/cookies/service.ts tests/modules/cookies/service.test.ts
git commit -m "feat(cookies): add buildCookieUrl helper"
```

---

## Task 3: Service — parseExpires & formatExpiresInput

These two are inverses of each other (datetime-local string ↔ unix seconds). Implement together so the round-trip test is meaningful.

**Files:**
- Modify: `src/modules/cookies/service.ts`
- Modify: `tests/modules/cookies/service.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `tests/modules/cookies/service.test.ts`:

```typescript
import { parseExpires, formatExpiresInput } from '../../../src/modules/cookies/service';

describe('modules/cookies/service — parseExpires', () => {
  it('returns undefined for empty string', () => {
    expect(parseExpires('')).toBeUndefined();
  });

  it('returns undefined for whitespace', () => {
    expect(parseExpires('   ')).toBeUndefined();
  });

  it('returns undefined for invalid input', () => {
    expect(parseExpires('not-a-date')).toBeUndefined();
  });

  it('returns unix seconds for a valid datetime-local string', () => {
    // 2030-01-15T12:00 local → Date(2030, 0, 15, 12, 0).getTime()/1000
    const expected = Math.floor(new Date(2030, 0, 15, 12, 0).getTime() / 1000);
    expect(parseExpires('2030-01-15T12:00')).toBe(expected);
  });
});

describe('modules/cookies/service — formatExpiresInput', () => {
  it('returns empty string for undefined (session cookie)', () => {
    expect(formatExpiresInput(undefined)).toBe('');
  });

  it('formats unix seconds back to a datetime-local string', () => {
    const seconds = Math.floor(new Date(2030, 0, 15, 12, 0).getTime() / 1000);
    expect(formatExpiresInput(seconds)).toBe('2030-01-15T12:00');
  });

  it('round-trips parseExpires → formatExpiresInput', () => {
    const input = '2030-01-15T12:00';
    const seconds = parseExpires(input);
    expect(seconds).toBeDefined();
    expect(formatExpiresInput(seconds)).toBe(input);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test tests/modules/cookies/service.test.ts`
Expected: FAIL — `parseExpires is not a function` / `formatExpiresInput is not a function`.

- [ ] **Step 3: Implement both helpers**

Append to `src/modules/cookies/service.ts`:

```typescript
function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

export function parseExpires(datetimeLocal: string): number | undefined {
  if (!datetimeLocal.trim()) return undefined;
  const ms = new Date(datetimeLocal).getTime();
  if (Number.isNaN(ms)) return undefined;
  return Math.floor(ms / 1000);
}

export function formatExpiresInput(expirationDate: number | undefined): string {
  if (expirationDate === undefined) return '';
  const d = new Date(expirationDate * 1000);
  if (Number.isNaN(d.getTime())) return '';
  return (
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` +
    `T${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test tests/modules/cookies/service.test.ts`
Expected: PASS (12 tests total: 5 prior + 7 new).

- [ ] **Step 5: Commit**

```bash
git add src/modules/cookies/service.ts tests/modules/cookies/service.test.ts
git commit -m "feat(cookies): add parseExpires/formatExpiresInput helpers"
```

---

## Task 4: Service — toExportFilename

**Files:**
- Modify: `src/modules/cookies/service.ts`
- Modify: `tests/modules/cookies/service.test.ts`

- [ ] **Step 1: Add failing test**

Append to `tests/modules/cookies/service.test.ts`:

```typescript
import { toExportFilename } from '../../../src/modules/cookies/service';

describe('modules/cookies/service — toExportFilename', () => {
  it('formats as cookies-<domain>-<YYYY-MM-DD>.json', () => {
    const date = new Date(2026, 3, 22, 9, 30); // 22 April 2026 local
    expect(toExportFilename('x.com', date)).toBe('cookies-x.com-2026-04-22.json');
  });

  it('zero-pads month and day', () => {
    const date = new Date(2026, 0, 5); // 5 January 2026
    expect(toExportFilename('example.org', date)).toBe('cookies-example.org-2026-01-05.json');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/modules/cookies/service.test.ts`
Expected: FAIL — `toExportFilename is not a function`.

- [ ] **Step 3: Implement toExportFilename**

Append to `src/modules/cookies/service.ts`:

```typescript
export function toExportFilename(domain: string, date: Date): string {
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  return `cookies-${domain}-${y}-${m}-${d}.json`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test tests/modules/cookies/service.test.ts`
Expected: PASS (14 tests).

- [ ] **Step 5: Commit**

```bash
git add src/modules/cookies/service.ts tests/modules/cookies/service.test.ts
git commit -m "feat(cookies): add toExportFilename helper"
```

---

## Task 5: Service — toExportJson

**Files:**
- Modify: `src/modules/cookies/service.ts`
- Modify: `tests/modules/cookies/service.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `tests/modules/cookies/service.test.ts`:

```typescript
import { toExportJson } from '../../../src/modules/cookies/service';

describe('modules/cookies/service — toExportJson', () => {
  const makeCookie = (name: string): chrome.cookies.Cookie => ({
    name,
    value: 'v-' + name,
    domain: 'x.com',
    path: '/',
    secure: true,
    httpOnly: false,
    session: true,
    sameSite: 'lax',
    storeId: '0',
    hostOnly: true,
  });

  it('returns pretty-printed JSON', () => {
    const out = toExportJson([makeCookie('a')]);
    expect(out).toContain('\n');
    expect(out).toContain('  ');
    expect(JSON.parse(out)).toEqual([makeCookie('a')]);
  });

  it('sorts cookies alphabetically by name', () => {
    const cookies = [makeCookie('zeta'), makeCookie('alpha'), makeCookie('mid')];
    const parsed = JSON.parse(toExportJson(cookies)) as chrome.cookies.Cookie[];
    expect(parsed.map((c) => c.name)).toEqual(['alpha', 'mid', 'zeta']);
  });

  it('returns "[]" for empty input', () => {
    expect(toExportJson([])).toBe('[]');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/modules/cookies/service.test.ts`
Expected: FAIL — `toExportJson is not a function`.

- [ ] **Step 3: Implement toExportJson**

Append to `src/modules/cookies/service.ts`:

```typescript
export function toExportJson(cookies: readonly chrome.cookies.Cookie[]): string {
  const sorted = [...cookies].sort((a, b) => a.name.localeCompare(b.name));
  return JSON.stringify(sorted, null, 2);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test tests/modules/cookies/service.test.ts`
Expected: PASS (17 tests).

- [ ] **Step 5: Verify coverage on service.ts**

Run: `pnpm test:coverage -- tests/modules/cookies/service.test.ts`
Expected: `src/modules/cookies/service.ts` at ≥80% line coverage.

- [ ] **Step 6: Commit**

```bash
git add src/modules/cookies/service.ts tests/modules/cookies/service.test.ts
git commit -m "feat(cookies): add toExportJson helper"
```

---

## Task 6: Popup.svelte (complete UI)

No component tests (per spec — manual smoke test only). Write the full file in one step.

**Files:**
- Create: `src/modules/cookies/Popup.svelte`

- [ ] **Step 1: Create Popup.svelte**

Create `src/modules/cookies/Popup.svelte`:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { extractETLD1 } from '../../core/domain';
  import {
    buildCookieUrl,
    parseExpires,
    formatExpiresInput,
    toExportFilename,
    toExportJson,
  } from './service';

  type Draft = { name: string; value: string; expires: string };

  let domain = $state<string | null>(null);
  let tabUrl = $state<string | null>(null);
  let cookies = $state<chrome.cookies.Cookie[]>([]);
  let expanded = $state<Record<string, boolean>>({});
  let edits = $state<Record<string, { value: string; expires: string }>>({});
  let errors = $state<Record<string, string>>({});
  let draft = $state<Draft | null>(null);
  let draftError = $state<string | null>(null);
  let loading = $state(false);

  function cookieKey(c: chrome.cookies.Cookie): string {
    return `${c.domain}|${c.path}|${c.name}`;
  }

  function sortCookies(list: chrome.cookies.Cookie[]): chrome.cookies.Cookie[] {
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }

  async function loadCookies(): Promise<void> {
    if (!domain) return;
    loading = true;
    try {
      const all = await chrome.cookies.getAll({ domain });
      cookies = sortCookies(all);
      errors = {};
    } finally {
      loading = false;
    }
  }

  onMount(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    tabUrl = tab?.url ?? null;
    domain = tab?.url ? extractETLD1(tab.url) : null;
    if (domain) {
      await loadCookies();
    }
  });

  function toggle(key: string): void {
    expanded = { ...expanded, [key]: !expanded[key] };
  }

  function onValueInput(key: string, current: chrome.cookies.Cookie, next: string): void {
    edits = {
      ...edits,
      [key]: {
        value: next,
        expires: edits[key]?.expires ?? formatExpiresInput(current.expirationDate),
      },
    };
  }

  function onExpiresInput(key: string, current: chrome.cookies.Cookie, next: string): void {
    edits = {
      ...edits,
      [key]: {
        value: edits[key]?.value ?? current.value,
        expires: next,
      },
    };
  }

  function isDirty(c: chrome.cookies.Cookie): boolean {
    const e = edits[cookieKey(c)];
    if (!e) return false;
    return e.value !== c.value || e.expires !== formatExpiresInput(c.expirationDate);
  }

  function describeError(err: unknown): string {
    const runtimeErr = chrome.runtime.lastError?.message;
    if (runtimeErr) return `Failed: ${runtimeErr}`;
    if (err instanceof Error) return `Failed: ${err.message}`;
    return 'Failed: unknown error';
  }

  async function save(c: chrome.cookies.Cookie): Promise<void> {
    const key = cookieKey(c);
    const edit = edits[key];
    if (!edit) return;
    const url = buildCookieUrl(c);
    const expirationDate = parseExpires(edit.expires);
    try {
      const result = await chrome.cookies.set({
        url,
        name: c.name,
        value: edit.value,
        path: c.path,
        domain: c.hostOnly ? undefined : c.domain,
        secure: c.secure,
        httpOnly: c.httpOnly,
        sameSite: c.sameSite,
        storeId: c.storeId,
        ...(expirationDate !== undefined ? { expirationDate } : {}),
      });
      if (!result) {
        errors = { ...errors, [key]: 'Chrome refused this cookie (flag mismatch?)' };
        return;
      }
      errors = Object.fromEntries(Object.entries(errors).filter(([k]) => k !== key));
      const nextEdits = { ...edits };
      delete nextEdits[key];
      edits = nextEdits;
      await loadCookies();
    } catch (err) {
      errors = { ...errors, [key]: describeError(err) };
    }
  }

  async function remove(c: chrome.cookies.Cookie): Promise<void> {
    const key = cookieKey(c);
    try {
      await chrome.cookies.remove({ url: buildCookieUrl(c), name: c.name, storeId: c.storeId });
      errors = Object.fromEntries(Object.entries(errors).filter(([k]) => k !== key));
      await loadCookies();
    } catch (err) {
      errors = { ...errors, [key]: describeError(err) };
    }
  }

  function startAdd(): void {
    if (!domain) return;
    draft = { name: '', value: '', expires: '' };
    draftError = null;
  }

  function cancelAdd(): void {
    draft = null;
    draftError = null;
  }

  async function saveDraft(): Promise<void> {
    if (!draft || !domain || !tabUrl) return;
    if (!draft.name.trim()) {
      draftError = 'Name is required';
      return;
    }
    const expirationDate = parseExpires(draft.expires);
    try {
      const result = await chrome.cookies.set({
        url: tabUrl,
        name: draft.name.trim(),
        value: draft.value,
        path: '/',
        domain,
        ...(expirationDate !== undefined ? { expirationDate } : {}),
      });
      if (!result) {
        draftError = 'Chrome refused this cookie (flag mismatch?)';
        return;
      }
      draft = null;
      draftError = null;
      await loadCookies();
    } catch (err) {
      draftError = describeError(err);
    }
  }

  async function deleteAll(): Promise<void> {
    if (!domain) return;
    const n = cookies.length;
    if (n === 0) return;
    const ok = confirm(`Delete all ${n} cookies for ${domain}?`);
    if (!ok) return;
    await Promise.all(
      cookies.map((c) =>
        chrome.cookies.remove({ url: buildCookieUrl(c), name: c.name, storeId: c.storeId }),
      ),
    );
    await loadCookies();
  }

  function exportJson(): void {
    if (!domain) return;
    const json = toExportJson(cookies);
    const filename = toExportFilename(domain, new Date());
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
</script>

{#if !domain}
  <div class="empty">Cookies aren't available on this page.</div>
{:else}
  <div class="cookies-popup">
    <header>
      <span class="domain">{domain}</span>
      <span class="count">{cookies.length}</span>
    </header>

    <ul class="list">
      {#if draft}
        <li class="row draft open">
          <input
            class="name-input"
            placeholder="cookie name"
            bind:value={draft.name}
          />
          <div class="panel">
            <label>
              value
              <textarea bind:value={draft.value}></textarea>
            </label>
            <label>
              expires
              <input type="datetime-local" bind:value={draft.expires} />
            </label>
            <div class="actions">
              <button class="btn" onclick={saveDraft}>Save</button>
              <button class="btn" onclick={cancelAdd}>Cancel</button>
            </div>
            {#if draftError}
              <div class="error">{draftError}</div>
            {/if}
          </div>
        </li>
      {/if}

      {#each cookies as c (cookieKey(c))}
        {@const key = cookieKey(c)}
        {@const open = expanded[key] ?? false}
        {@const valueVal = edits[key]?.value ?? c.value}
        {@const expiresVal = edits[key]?.expires ?? formatExpiresInput(c.expirationDate)}
        <li class="row" class:open>
          <button class="head" onclick={() => toggle(key)}>
            <span class="arrow">{open ? '▾' : '▸'}</span>
            <span class="name">{c.name}</span>
          </button>
          {#if open}
            <div class="panel">
              <div class="meta">
                <span>domain: {c.domain}</span>
                <span>path: {c.path}</span>
                {#if c.httpOnly}<span class="badge">httpOnly</span>{/if}
                {#if c.secure}<span class="badge">secure</span>{/if}
                <span class="badge">sameSite: {c.sameSite}</span>
              </div>
              <label>
                value
                <textarea
                  value={valueVal}
                  oninput={(e) => onValueInput(key, c, (e.target as HTMLTextAreaElement).value)}
                ></textarea>
              </label>
              <label>
                expires
                <input
                  type="datetime-local"
                  value={expiresVal}
                  oninput={(e) => onExpiresInput(key, c, (e.target as HTMLInputElement).value)}
                />
              </label>
              <div class="actions">
                <button class="btn" disabled={!isDirty(c)} onclick={() => save(c)}>Save</button>
                <button class="btn danger" onclick={() => remove(c)}>Delete</button>
              </div>
              {#if errors[key]}
                <div class="error">{errors[key]}</div>
              {/if}
            </div>
          {/if}
        </li>
      {/each}
    </ul>

    {#if !loading && cookies.length === 0 && !draft}
      <div class="empty">No cookies for {domain}</div>
    {/if}

    <footer>
      <button class="foot" onclick={startAdd} disabled={!!draft}>
        <span class="ic">+</span><span>Add</span>
      </button>
      <button class="foot" onclick={deleteAll} disabled={cookies.length === 0}>
        <span class="ic">🗑</span><span>Delete All</span>
      </button>
      <button class="foot" onclick={loadCookies}>
        <span class="ic">↻</span><span>Refresh</span>
      </button>
      <button class="foot" onclick={exportJson} disabled={cookies.length === 0}>
        <span class="ic">⬆</span><span>Export</span>
      </button>
    </footer>
  </div>
{/if}

<style>
  .cookies-popup { display: flex; flex-direction: column; height: 100%; color: #eee; font-family: system-ui, sans-serif; font-size: 13px; }
  header { display: flex; justify-content: space-between; padding: 8px 12px; border-bottom: 1px solid #2a2a30; }
  .domain { font-weight: 500; }
  .count { opacity: 0.6; }
  .list { list-style: none; margin: 0; padding: 0; overflow-y: auto; flex: 1; max-height: 320px; }
  .row { border-bottom: 1px solid #1d1d22; }
  .head { width: 100%; text-align: left; background: transparent; border: none; color: inherit; padding: 8px 12px; cursor: pointer; font-size: 13px; display: flex; gap: 6px; align-items: center; }
  .head:hover { background: #1b1b20; }
  .arrow { opacity: 0.6; width: 10px; display: inline-block; }
  .row.open { background: #15151a; }
  .panel { padding: 8px 12px 12px; display: flex; flex-direction: column; gap: 8px; }
  .meta { display: flex; flex-wrap: wrap; gap: 6px; opacity: 0.7; font-size: 11px; }
  .badge { padding: 1px 6px; border-radius: 3px; background: #26262c; }
  .panel label { display: flex; flex-direction: column; gap: 2px; font-size: 11px; opacity: 0.8; }
  .panel textarea { min-height: 44px; background: #0f0f12; color: #eee; border: 1px solid #2a2a30; border-radius: 4px; padding: 4px 6px; font-family: monospace; resize: vertical; }
  .panel input[type="datetime-local"] { background: #0f0f12; color: #eee; border: 1px solid #2a2a30; border-radius: 4px; padding: 4px 6px; }
  .name-input { margin: 8px 12px 0; background: #0f0f12; color: #eee; border: 1px solid #2a2a30; border-radius: 4px; padding: 6px 8px; }
  .actions { display: flex; gap: 6px; margin-top: 4px; }
  .btn { padding: 4px 10px; border-radius: 4px; border: 1px solid #3a3a42; background: transparent; color: inherit; cursor: pointer; font-size: 12px; }
  .btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .btn.danger { border-color: #5a2a2a; color: #e88; }
  .error { color: #f77; font-size: 11px; }
  .empty { padding: 24px; text-align: center; opacity: 0.5; }
  footer { display: grid; grid-template-columns: repeat(4, 1fr); border-top: 1px solid #2a2a30; }
  .foot { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 8px 4px; background: transparent; border: none; color: inherit; cursor: pointer; font-size: 11px; }
  .foot:hover:not(:disabled) { background: #1b1b20; }
  .foot:disabled { opacity: 0.4; cursor: not-allowed; }
  .ic { font-size: 16px; }
</style>
```

- [ ] **Step 2: Run svelte-check**

Run: `pnpm check`
Expected: 0 errors for `src/modules/cookies/Popup.svelte`.

- [ ] **Step 3: Commit**

```bash
git add src/modules/cookies/Popup.svelte
git commit -m "feat(cookies): add Popup.svelte UI"
```

---

## Task 7: Module index.ts + README.md

**Files:**
- Create: `src/modules/cookies/index.ts`
- Create: `src/modules/cookies/README.md`

- [ ] **Step 1: Create the module index**

Create `src/modules/cookies/index.ts`:

```typescript
import type { OmniModule } from '../../core/types';
import Popup from './Popup.svelte';
import { COOKIES_DEFAULTS } from './storage';

const cookies: OmniModule = {
  id: 'cookies',
  label: 'Cookies',
  icon: '🍪',
  Popup,
  storageDefaults: { ...COOKIES_DEFAULTS },
};

export default cookies;
```

- [ ] **Step 2: Create the README**

Create `src/modules/cookies/README.md`:

```markdown
# Cookies Module

Lightweight cookie viewer / editor scoped to the current tab's eTLD+1.

## Storage shape
No persistent per-module state. See `./storage.ts` → `CookiesStorage` (empty record).

## Domain matching
eTLD+1 via `../../core/domain.ts`. Chrome's `cookies.getAll({ domain })` implicitly includes subdomains.

## Known limitations
- Current site only. Switch tabs to switch sites.
- Editor surfaces `value` and `expires` only; advanced fields (`path`, `domain`, `httpOnly`, `secure`, `sameSite`) are read-only.
- No live updates — click Refresh after a site mutates cookies while the popup is open.
- No import of exported JSON in v1.
- `chrome.cookies.set` may reject inputs that violate its invariants (e.g., `secure` without `https`, `sameSite=none` without `secure`); errors appear inline under the row.
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/modules/cookies/index.ts src/modules/cookies/README.md
git commit -m "feat(cookies): add module index and README"
```

---

## Task 8: Wire up — manifest permission + registry + registry test

**Files:**
- Modify: `manifest.config.ts`
- Modify: `src/core/registry.ts`
- Modify: `tests/core/registry.test.ts`

- [ ] **Step 1: Update registry test to expect cookies module**

Replace `tests/core/registry.test.ts` with:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/core/registry.test.ts`
Expected: FAIL — `cookies module undefined`.

- [ ] **Step 3: Register the cookies module**

Replace `src/core/registry.ts` with:

```typescript
import type { OmniModule } from './types';
import dark from '../modules/dark';
import cookies from '../modules/cookies';

export const modules: OmniModule[] = [dark, cookies];
```

- [ ] **Step 4: Add cookies permission to manifest**

Edit `manifest.config.ts` — extend the `permissions` array. Full file:

```typescript
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
});
```

- [ ] **Step 5: Run the full test suite**

Run: `pnpm test`
Expected: PASS — all existing tests + new cookies tests + updated registry test.

- [ ] **Step 6: Run typecheck and svelte-check**

Run: `pnpm typecheck && pnpm check`
Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add manifest.config.ts src/core/registry.ts tests/core/registry.test.ts
git commit -m "feat(cookies): register module and add cookies permission"
```

---

## Task 9: Build + manual smoke test

**Files:** none (verification only)

- [ ] **Step 1: Production build**

Run: `pnpm build`
Expected: build succeeds, `dist/` contains the extension with `manifest.json` including `"cookies"` in `permissions`.

Verify: `grep '"cookies"' dist/manifest.json` returns a match.

- [ ] **Step 2: Load unpacked in Chrome**

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Remove the previous Omni Extension install if present.
4. Click "Load unpacked" and pick the `dist/` folder.
5. Confirm two tabs appear in the popup: `🌙 Dark` and `🍪 Cookies`.

- [ ] **Step 3: Smoke test — view**

1. Navigate to `https://example.com` in a new tab.
2. Open the popup, click the `🍪 Cookies` tab.
3. Header shows `example.com` with a count (likely 0 on a fresh profile — load a site with cookies like `https://x.com` to get a non-empty list).
4. Click a cookie row. Accordion expands, shows read-only meta + editable `value` and `expires`.

- [ ] **Step 4: Smoke test — edit**

1. Change a cookie's `value`. Confirm `Save` enables.
2. Click `Save`. Confirm the row re-renders with the new value persisted (re-expand to verify).
3. Reload the page. Confirm the site still sees the edited cookie (or expected side effects).

- [ ] **Step 5: Smoke test — add**

1. Click `+ Add`.
2. A new row appears at the top with an empty name input focused.
3. Type a name (e.g., `omni_test`), a value, leave `expires` blank.
4. Click `Save`. Draft row disappears, new cookie appears in the sorted list.

- [ ] **Step 6: Smoke test — delete & delete-all**

1. Expand the `omni_test` cookie, click `Delete`. Row disappears.
2. Click `🗑 Delete All`. Confirm the native prompt fires. Click OK.
3. List goes to empty state.
4. Reload the page. Site may set fresh cookies — click `↻ Refresh` to see them.

- [ ] **Step 7: Smoke test — export**

1. Navigate to a site with several cookies.
2. Open the popup → Cookies tab → click `⬆ Export`.
3. Confirm a file `cookies-<domain>-<YYYY-MM-DD>.json` downloads.
4. Open the file and confirm it's valid JSON, an array sorted by cookie name.

- [ ] **Step 8: Smoke test — non-http tab**

1. Navigate to `chrome://settings`.
2. Open popup → Cookies tab.
3. Confirm the empty state shows `Cookies aren't available on this page.` and footer buttons are hidden (no cookies-popup root rendered).

- [ ] **Step 9: Commit the smoke-test log**

No code change. If any smoke step revealed a regression, file it as a follow-up task and fix before closing this plan.

```bash
git log --oneline main..HEAD
```

Expected: sequence of 8 `feat(cookies): …` commits plus the design-spec commit from the brainstorming session. Plan complete.

---

## Self-Review Checklist

Spec → plan coverage:

- Section 2 scope items (list, editor, add, delete, delete-all, refresh, export, permission, tests) → Tasks 1–8.
- Section 3.1 file structure (README, index, Popup, service, storage) → Tasks 1, 5, 6, 7.
- Section 3.2 core touchpoints → Task 1 (types + storage), Task 8 (registry + manifest).
- Section 4 data model (`CookiesStorage` empty) → Task 1.
- Section 5.1 `cookies` permission → Task 8.
- Section 5.2 domain matching → already in `core/domain.ts`; used in Popup (Task 6).
- Section 5.3 `buildCookieUrl` → Task 2.
- Section 5.4 operations table → Popup calls (Task 6).
- Section 6.1–6.6 UI → Task 6 (single file).
- Section 7 test plan (`buildCookieUrl`, `parseExpires`, `toExportFilename`, `toExportJson`, storage, registry) → Tasks 1–5, 8. `formatExpiresInput` added (inverse of `parseExpires`) because Popup needs it to seed editor fields.
- Section 8 limitations → documented in Task 7 README.
- Section 9 open questions → resolved in "Plan-phase resolutions" block above.
