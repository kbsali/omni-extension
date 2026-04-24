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
