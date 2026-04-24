# Dark Mode Module

Per-site dark mode via CSS `filter: invert() hue-rotate()`.

## Storage shape

See `../../core/types.ts` → `DarkStorage`.

## Domain matching

eTLD+1 (registrable domain). `docs.github.com` and `github.com` share one setting.

## Known limitations

- Fixed-position elements may break on some sites (known `filter` stacking context issue).
- Already-dark sites look inverted-light (deferred to future "smart mode").
