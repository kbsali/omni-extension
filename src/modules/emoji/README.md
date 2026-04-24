# Emoji Module

Keyboard-driven emoji picker. Search, arrow-navigate, Enter to copy, Escape to clear/close.

## Storage shape

`emoji: { recents: string[] }` under the root `omni` key. Most-recent-first, capped at `RECENTS_MAX = 16`.

## Data source

`emojibase-data/en/data.json`. Loaded at module init and filtered to exclude the Component group (skin-tone swatches) and entries without a CLDR group. See `./data.ts`.

## Known limitations

- English names/keywords only.
- No skin-tone picker.
- No categories / tabs — everything is searchable as one flat grid.
- Rendering ~1900 grid cells at once. Performance is fine on modern hardware; if it becomes a problem on low-end devices, a windowed renderer or `content-visibility: auto` on grid rows are the escape hatches.
