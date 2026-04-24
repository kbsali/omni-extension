# Cookies Editor Module — Design Spec

**Date:** 2026-04-22
**Status:** Approved design
**Author:** Kevin Saliou (via brainstorming session)

## 1. Purpose

Second module for the Omni Extension: a lightweight cookie viewer / editor scoped to the current tab's site, reachable from the `🍪 Cookies` tab in the popup. Lets the user inspect every cookie Chrome holds for the current eTLD+1, tweak value or expiry, delete individual cookies or all of them, add new ones, and export the full set as JSON.

Plugs into the existing `OmniModule` registry pattern (see `2026-04-21-omni-extension-design.md`). No core refactoring required — one new folder, one type extension, one registry line, one manifest permission.

## 2. Scope (v1)

**In scope:**

- New module at `src/modules/cookies/` implementing `OmniModule`.
- List every cookie matching the current tab's eTLD+1 (Chrome's implicit subdomain match).
- Per-cookie accordion editor:
  - read-only: `name`, `domain`, `path`, `httpOnly`, `secure`, `sameSite`
  - editable: `value`, `expires` (datetime-local; blank = session)
  - `Save` + `Delete` buttons per row
- `+ Add` — inline empty row at top of list, pre-expanded, focus on name field.
- `🗑 Delete All` — removes all cookies for current site, gated by native `confirm()`.
- `↻ Refresh` — manual re-read; no live `cookies.onChanged` subscription.
- `⬆ Export` — download `cookies-<domain>-<YYYY-MM-DD>.json` containing all cookies for current site, full fields.
- Add `"cookies"` permission to `manifest.config.ts`.
- Vitest unit tests on pure logic in `service.ts`.

**Out of scope for v1:**

- Cross-site cookie browsing, domain picker, or global cookie list.
- Editing advanced fields (`path`, `domain`, `httpOnly`, `secure`, `sameSite`).
- Import of previously exported JSON (export-only for now).
- Live updates while popup is open (`cookies.onChanged`).
- Partitioned / third-party cookie explicit UI — whatever `chrome.cookies.getAll({domain})` returns is what's shown.
- Incognito / non-default `storeId` selection — default store only, but `storeId` is preserved round-trip so edits stick in whichever store the cookie came from.
- E2E tests (per user preference for side projects).
- UI component tests (manual smoke test covers it).

## 3. Architecture

Fits the existing layered structure unchanged.

### 3.1 File structure

```
src/modules/cookies/
├── README.md        # 10-line module spec
├── index.ts         # OmniModule export
├── Popup.svelte     # list + accordion editor + footer action bar
├── service.ts       # pure logic: buildCookieUrl, toExportJson, parseExpires, toExportFilename
└── storage.ts       # CookiesStorage (empty) + COOKIES_DEFAULTS
```

### 3.2 Core touchpoints

- `src/core/types.ts` — extend `OmniStorage.modules` with `cookies: CookiesStorage`.
- `src/core/storage.ts` — extend `DEFAULT_STORAGE.modules` with `cookies: { ...COOKIES_DEFAULTS }`.
- `src/core/registry.ts` — `import cookies from '../modules/cookies'` and append to `modules` array.
- `manifest.config.ts` — add `'cookies'` to `permissions`.

### 3.3 Module contract

No `onBackground` hook — popup talks to `chrome.cookies.*` directly (same simplification landed in the Dark module after the last session). Module export:

```ts
const cookies: OmniModule = {
  id: 'cookies',
  label: 'Cookies',
  icon: '🍪',
  Popup,
  storageDefaults: { ...COOKIES_DEFAULTS },
};
```

## 4. Data model

### 4.1 Storage slice

```ts
// src/modules/cookies/storage.ts
export type CookiesStorage = Record<string, never>;
export const COOKIES_DEFAULTS: CookiesStorage = {};
```

The module has no persistent user settings in v1. The empty slice exists only so `OmniStorage.modules.cookies` is type-safe and symmetric with the Dark slice.

### 4.2 Cookie type

Use `chrome.cookies.Cookie` from `@types/chrome` directly. Do not define a parallel interface.

## 5. Chrome API usage

### 5.1 Permission

Add `"cookies"` to `manifest.config.ts` permissions. `host_permissions: ["<all_urls>"]` is already declared by the Dark module scaffolding.

### 5.2 Domain matching

`chrome.cookies.getAll({ domain: eTLD1 })` returns cookies for the domain _and all its subdomains_ — Chrome's documented match rule when the argument has no leading dot. This matches the screenshot behavior (e.g., `x.com` view includes `.x.com` cookies) and requires no extra filtering client-side.

eTLD+1 comes from the existing `core/domain.ts:extractETLD1` (uses `tldts`).

### 5.3 URL construction

`chrome.cookies.set` and `chrome.cookies.remove` require a `url`, not `{domain, path}`. Pure helper:

```ts
export function buildCookieUrl(
  c: Pick<chrome.cookies.Cookie, 'domain' | 'path' | 'secure'>,
): string {
  const scheme = c.secure ? 'https' : 'http';
  const host = c.domain.startsWith('.') ? c.domain.slice(1) : c.domain;
  const path = c.path || '/';
  return `${scheme}://${host}${path}`;
}
```

### 5.4 Operations

| Action     | Call                                                                                                           |
| ---------- | -------------------------------------------------------------------------------------------------------------- |
| List       | `chrome.cookies.getAll({ domain })` → sort by `name`                                                           |
| Save edit  | `chrome.cookies.set({ url, name, value, path, domain, expirationDate?, secure, httpOnly, sameSite, storeId })` |
| Delete     | `chrome.cookies.remove({ url, name, storeId })`                                                                |
| Delete All | `getAll` → `Promise.all(remove(…))` after `confirm(...)`                                                       |
| Add        | `set({ url: tabUrl, name, value, path: '/', domain: currentETLD1, expirationDate? })`                          |
| Export     | `getAll` → `JSON.stringify(cookies, null, 2)` → `Blob` → `URL.createObjectURL` → anchor click                  |

Session cookies: when the user leaves the `expires` field blank, omit `expirationDate` from the `set` payload entirely (Chrome treats missing `expirationDate` as session).

## 6. UI

### 6.1 Layout

Popup width ≈ 360px. Top-level structure:

```
┌──────────────────────────────────┐
│ <domain>                    <n>  │  ← header: site + cookie count
├──────────────────────────────────┤
│ ▼ __cf_bm                        │  ← collapsed row
│ ▼ __cuid                         │
│ ▼ _ga                            │
│   ┌───── expanded panel ─────┐   │
│   │ domain, path, flags RO   │   │
│   │ value: <textarea>        │   │
│   │ expires: <datetime>      │   │
│   │ [Save]         [Delete]  │   │
│   └──────────────────────────┘   │
│ ▼ _gcl_au                        │
│ …                                │
├──────────────────────────────────┤
│ + Add  🗑 Delete All  ↻  ⬆ Export │  ← sticky footer
└──────────────────────────────────┘
```

### 6.2 Expanded row

Grid with read-only fields + two editable controls:

- `value` — `<textarea>`, autosizes vertically, editable.
- `expires` — `<input type="datetime-local">`; empty = session cookie.
- `[Save]` disabled until dirty (either field changed).
- `[Delete]` always enabled; no inline confirm (single-cookie delete is low-risk).

### 6.3 Add flow

- `+ Add` inserts a synthetic row at the top of the list, pre-expanded, name field focused.
- Pre-filled defaults: `domain = current eTLD+1`, `path = '/'`, `expires = blank (session)`.
- `Save` on the synthetic row calls `chrome.cookies.set`. On success, the real cookie replaces the draft row (re-sorted alphabetically).
- `Cancel` (small X on the synthetic row) discards without a call.

### 6.4 Footer actions

Four slots, icon + label, matching screenshot:

- `+ Add`
- `🗑 Delete All` — native `confirm("Delete all N cookies for <domain>?")` before calling.
- `↻ Refresh` — re-runs `getAll` and re-renders.
- `⬆ Export` — downloads JSON.

### 6.5 Error handling

`chrome.cookies.set` rejects on some inputs (e.g., setting an `httpOnly` cookie from a script context, malformed path, cross-domain). On rejection:

- Show a one-line red error message under the failing row.
- Do not close the accordion; the user's edits remain.
- No toast / modal / global error banner.

### 6.6 Empty states

- **No cookies:** centered muted text — `No cookies for <domain>`.
- **Non-http(s) tab** (`chrome://`, `about:`, `file://`, no active tab): centered muted text — `Cookies aren't available on this page.` All footer buttons disabled.

## 7. Testing

Vitest-only, matches the Dark module's approach. Coverage target: 80%+ on `src/modules/cookies/service.ts`.

### 7.1 `tests/cookies.service.test.ts`

Pure-function tests, no `chrome` API calls:

- `buildCookieUrl`:
  - `secure: true` → `https` scheme
  - `secure: false` → `http` scheme
  - leading `.` stripped from domain
  - missing / empty path defaults to `/`
- `toExportJson(cookies)`:
  - returns stable JSON string
  - cookies sorted by `name`
- `toExportFilename(domain, date)`:
  - returns `cookies-<domain>-<YYYY-MM-DD>.json`
- `parseExpires(datetimeLocalString)`:
  - valid string → unix seconds (number)
  - empty / blank → `undefined`

### 7.2 `tests/cookies.storage.test.ts`

- `COOKIES_DEFAULTS` equals `{}`.
- `DEFAULT_STORAGE.modules.cookies` exists and equals `{}`.

### 7.3 `tests/registry.test.ts` (extension)

- Registry has 2 modules now (`dark`, `cookies`).
- IDs unique, all required `OmniModule` fields present.

### 7.4 Test setup

`sinon-chrome` (already installed per bootstrap) provides `chrome.cookies` mocks out of the box. No additions to `tests/setup.ts` expected; verify during implementation and extend only if missing.

### 7.5 Not tested

- Svelte component rendering (`Popup.svelte`) — manual smoke test on `pnpm dev`.
- E2E (Playwright) — deferred per side-project preference.

## 8. Known Limitations (v1)

Document in `src/modules/cookies/README.md`:

1. **Current site only.** No domain picker; switch tabs to switch sites.
2. **Value + expires only.** Advanced fields (`path`, `domain`, `httpOnly`, `secure`, `sameSite`) are read-only in the editor.
3. **No live updates.** If a site sets a cookie while the popup is open, click Refresh to see it.
4. **No import.** Exported JSON is inspection-only in v1.
5. **Set failures surfaced inline.** `chrome.cookies.set` rejects on invariant violations (e.g., `secure: true` with an `http://` URL, `sameSite: 'none'` without `secure: true`, malformed path). The module shows the error under the row; the user has to resolve the conflict by changing `expires` / `value` in ways that keep the existing flags valid — advanced flags are not editable in v1.
6. **`httpOnly` caveat.** Chrome may reject setting some `httpOnly` cookies from an extension context; the module surfaces the error inline but cannot override it.
7. **Default cookie store only.** Incognito-specific stores are not selectable; cookies from non-default stores are preserved on round-trip but not explicitly filterable.
8. **`httpOnly` caveat.** Chrome may reject setting some `httpOnly` cookies from an extension context; the module surfaces the error inline but cannot override it.
9. **Default cookie store only.** Incognito-specific stores are not selectable; cookies from non-default stores are preserved on round-trip but not explicitly filterable.

## 9. Open Questions Deferred to Plan Phase

- Exact shape of the synthetic "draft" row for Add (pure local state vs. a sentinel object in the list array) — plan phase decision.
- Whether to keep the `Delete` button disabled for the synthetic draft row (it's a no-op there) or show `Cancel` instead — plan phase decision.
- Precise error-message copy for common `chrome.cookies.set` failures — plan phase decision.
