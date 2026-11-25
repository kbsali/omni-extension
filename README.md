# Omni Extension

Multi-tool browser extension (Manifest V3).

## Install (dev)

```bash
bun install
bun run build
```

Then in Chrome:

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `dist/` folder

## Develop

```bash
bun run dev
```

HMR-enabled. Reload the extension in Chrome when `manifest.config.ts` changes.

## Test

```bash
bun run check         # oxlint, bun fmt --check, svelte-check
bun run test
bun run test:coverage
bun run build && bun run test:e2e   # headed Chromium, needs a display
```

## Features

### Dark Mode

Per-site (eTLD+1) dark mode via CSS filter inversion.

- Toggle current site: click `This site only`
- Flip global default: click `All sites`
- Adjust brightness 50% to 100%
- Default mode and brightness sync via `chrome.storage.sync`; the per-site list stays on this device (`chrome.storage.local`)

### Cookies

Lightweight cookie viewer/editor scoped to the current tab's eTLD+1. See [`src/modules/cookies/README.md`](src/modules/cookies/README.md).

### Emoji

Keyboard-driven emoji picker. Type to fuzzy-filter ~1900 emojis, arrow-key to navigate, Enter to copy. Recently used emojis are remembered and shown first. See [`src/modules/emoji/README.md`](src/modules/emoji/README.md).

### ntfy

Lists the messages of an ntfy topic (`kbsali-all` by default, server and access token set in the tab's Settings). URLs open in a new tab, attachments download. See [`src/modules/ntfy/README.md`](src/modules/ntfy/README.md).

### PDF

Exports the article of the current page (newspaper, blog) to PDF: extracts the main text from the live page, so subscriber-only content is kept, lays it out cleanly and opens the print dialog (pick "Save as PDF"). See [`src/modules/article/README.md`](src/modules/article/README.md).

### Keyboard shortcuts

Each module ships a keyboard shortcut. Chrome lets you remap them at `chrome://extensions/shortcuts`.

| Shortcut            | Action                                       |
| ------------------- | -------------------------------------------- |
| `Ctrl+Shift+L`      | Open popup on Emoji tab, search focused      |
| `Ctrl+Shift+Comma`  | Open popup on Cookies tab                    |
| `Ctrl+Shift+Period` | Toggle dark mode for current site (no popup) |

Chrome caps user-configurable shortcuts at 4 per extension. One slot is free for a future module.

**If a shortcut doesn't fire**, your OS, window manager or another extension is intercepting the keystroke. Open `chrome://extensions/shortcuts` and remap the conflicting entry to a free combination.

### Known limitations

- Dark mode uses `filter: invert(1) hue-rotate(180deg)`, not a color-aware dark mode.
- Dark mode per-site rules use eTLD+1 granularity.
- E2E coverage is limited to dark mode, the ntfy list and the article export (`tests/e2e/`).
- Where `chrome.action.openPopup()` is unavailable or a no-op (Chrome <127, Vivaldi), the emoji and cookies shortcuts open the popup in a small detached window instead.

## Architecture

See [`docs/superpowers/specs/2026-04-21-omni-extension-design.md`](docs/superpowers/specs/2026-04-21-omni-extension-design.md).

Adding a new module:

See "Adding a module" in [`AGENTS.md`](AGENTS.md): registry entry, storage type, and a manifest command if the module has a shortcut.

## License

MIT
