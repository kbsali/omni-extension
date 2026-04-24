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

Keyboard-driven emoji picker. Type to fuzzy-filter ~1900 emojis, arrow-key to navigate, Enter to copy. Recently used emojis are remembered and shown first. See [`src/modules/emoji/README.md`](src/modules/emoji/README.md).

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
