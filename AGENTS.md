## Approach

- Read existing files before writing. Don't re-read unless changed.
- Thorough in reasoning, concise in output.
- Skip files over 100KB unless required.
- No sycophantic openers or closing fluff.
- No emojis or em-dashes.
- Do not guess APIs, versions, flags, commit SHAs, or package names. Verify by reading code or docs before asserting.

## Commands

- `bun install`: run first; `node_modules/` is not present in a fresh clone
- `bun run build`: builds the MV3 extension into `dist/` (load unpacked in Chrome)
- `bun run dev`: Vite + CRXJS HMR; reload the extension when the manifest changes
- `bun run test`: Vitest (happy-dom). Not `bun test`, which starts Bun's own runner
- `bun run test:e2e`: Playwright against `dist/`; run `bun run build` first. Headed only (MV3 service workers do not boot headless)
- `bun run check`: svelte-check; `bun run typecheck`, `bun run lint`, `bun run format:check`
- Pre-commit (`.githooks/pre-commit`): `bun fmt --staged`, then `bunx oxlint`

## Architecture

- Each feature is a module in `src/modules/<name>/`: `index.ts` (exports an `OmniModule`), `Popup.svelte`, `service.ts`, `storage.ts`, `README.md`
- `src/core/registry.ts` lists the modules; the popup (`src/popup/`) and the background (`src/background/`) iterate over it
- Imports are relative. The `@core` and `@modules` aliases are defined (`tsconfig.json`, `vite.config.ts`) but unused; don't introduce them
- Design specs and plans live in `docs/superpowers/specs/` and `docs/superpowers/plans/`; read them before changing a module

## Adding a module

1. Create `src/modules/<name>/` with `index.ts` exporting an `OmniModule`
2. Register it in `src/core/registry.ts`
3. Add its storage type to `OmniStorage.modules` in `src/core/types.ts`
4. If it has a shortcut, add the same `commandName` to `commands` in `manifest.config.ts`. Chrome allows 4 per extension and 3 are used
5. Add tests under `tests/modules/<name>/`, matching the existing `service.test.ts` / `storage.test.ts` pairs

## Gotchas

- The manifest `version` comes from `package.json`. A release bumps `package.json` only
- `tests/setup.ts` stubs `chrome` with sinon-chrome: it covers `chrome.storage` and `chrome.runtime`, not `chrome.scripting`
- `*.svelte` is ignored by `bun fmt` and oxlint; only `svelte-check` covers it
- Coverage only counts `src/core/**` and the `service.ts`, `storage.ts` and `css.ts` files of each module
- Pinned on purpose: `typescript` 6 (svelte-check breaks on 7) and `@crxjs/vite-plugin` 2.x (3.0 not adopted yet). Check again before bumping either
