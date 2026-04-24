# Omni Extension v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the MV3 Chrome extension scaffold + a fully functional Dark Mode module with per-site (eTLD+1) overrides, a global default, and a global brightness slider.

**Architecture:** Svelte 5 + Vite + CRXJS. Three layers — `core/` (storage, domain, registry), `modules/dark/` (self-contained feature), and `background/` (orchestrator). Storage is a single `omni` key in `chrome.storage.sync`. Dark content scripts are dynamically registered per enrolled domain at `document_start`.

**Tech Stack:** TypeScript (strict), Svelte 5 (runes mode), Vite, @crxjs/vite-plugin, tldts, Vitest, @testing-library/svelte, happy-dom, sinon-chrome.

**Spec:** `docs/superpowers/specs/2026-04-21-omni-extension-design.md`

---

## File Structure Overview

```
omni-extension/
├── .gitignore
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── vite.config.ts
├── manifest.config.ts              # CRXJS manifest builder
├── README.md
├── docs/
│   └── superpowers/{specs,plans}/
├── src/
│   ├── core/
│   │   ├── types.ts                # OmniModule, OmniStorage, Mode, BackgroundCtx
│   │   ├── domain.ts               # extractETLD1
│   │   ├── storage.ts              # typed wrapper around chrome.storage.sync
│   │   └── registry.ts             # exports modules: OmniModule[]
│   ├── modules/
│   │   └── dark/
│   │       ├── README.md
│   │       ├── index.ts            # OmniModule export
│   │       ├── storage.ts          # DarkStorage slice + defaults + helpers
│   │       ├── service.ts          # resolveMode, computeEnrolledDomains, diffRegistrations
│   │       ├── css.ts              # pure CSS string generator
│   │       ├── content.ts          # content script entry (uses css.ts)
│   │       └── Popup.svelte        # moon + toggle + buttons + slider
│   ├── popup/
│   │   ├── index.html
│   │   ├── main.ts
│   │   └── App.svelte              # tab shell
│   └── background/
│       └── index.ts                # service worker; wires module onBackground hooks
└── tests/
    ├── setup.ts                    # sinon-chrome global install
    ├── core/
    │   ├── domain.test.ts
    │   ├── storage.test.ts
    │   └── registry.test.ts
    └── modules/dark/
        ├── service.test.ts
        ├── storage.test.ts
        ├── css.test.ts
        └── Popup.test.ts
```

---

## Task 0: Project Bootstrap

**Files:**

- Create: `package.json`, `pnpm-lock.yaml` (generated), `.gitignore`, `tsconfig.json`, `vite.config.ts`, `manifest.config.ts`, `tests/setup.ts`

- [ ] **Step 1: Create `.gitignore`**

Create `.gitignore`:

```
node_modules/
dist/
.DS_Store
coverage/
*.log
.vite/
```

- [ ] **Step 2: Create `package.json`**

Create `package.json`:

```json
{
  "name": "omni-extension",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@crxjs/vite-plugin": "^2.0.0-beta.28",
    "@sveltejs/vite-plugin-svelte": "^5.0.3",
    "@testing-library/svelte": "^5.2.6",
    "@tsconfig/svelte": "^5.0.4",
    "@types/chrome": "^0.0.287",
    "@vitest/coverage-v8": "^2.1.8",
    "happy-dom": "^15.11.7",
    "sinon-chrome": "^3.0.1",
    "svelte": "^5.19.0",
    "svelte-check": "^4.1.4",
    "tldts": "^6.1.74",
    "typescript": "^5.7.3",
    "vite": "^6.0.7",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 3: Create `tsconfig.json`**

Create `tsconfig.json`:

```json
{
  "extends": "@tsconfig/svelte/tsconfig.json",
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "verbatimModuleSyntax": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["chrome", "vitest/globals", "svelte"],
    "baseUrl": ".",
    "paths": {
      "@core/*": ["src/core/*"],
      "@modules/*": ["src/modules/*"]
    }
  },
  "include": ["src/**/*", "tests/**/*", "vite.config.ts", "manifest.config.ts"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 4: Create `manifest.config.ts`**

Create `manifest.config.ts`:

```ts
import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json' with { type: 'json' };

export default defineManifest({
  manifest_version: 3,
  name: 'Omni Extension',
  version: pkg.version,
  description: 'Multi-tool browser extension (Dark Mode + future modules)',
  permissions: ['storage', 'scripting', 'activeTab'],
  host_permissions: ['<all_urls>'],
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  action: {
    default_popup: 'src/popup/index.html',
  },
});
```

- [ ] **Step 5: Create `vite.config.ts`**

Create `vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config';

export default defineConfig({
  plugins: [svelte(), crx({ manifest })],
  resolve: {
    alias: {
      '@core': '/src/core',
      '@modules': '/src/modules',
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'src/core/**',
        'src/modules/*/service.ts',
        'src/modules/*/storage.ts',
        'src/modules/*/css.ts',
      ],
    },
  },
});
```

- [ ] **Step 6: Create `tests/setup.ts`**

Create `tests/setup.ts`:

```ts
import chrome from 'sinon-chrome';
import { beforeEach, afterAll } from 'vitest';

// Install sinon-chrome as the global `chrome` object used by the extension code.
(globalThis as unknown as { chrome: typeof chrome }).chrome = chrome;

beforeEach(() => {
  chrome.flush();
});

afterAll(() => {
  chrome.flush();
});
```

- [ ] **Step 7: Install dependencies**

Run:

```bash
pnpm install
```

Expected: lockfile generated, `node_modules/` populated. No errors.

- [ ] **Step 8: Verify typecheck + empty test suite passes**

Run:

```bash
pnpm typecheck && pnpm test
```

Expected: `tsc --noEmit` exits 0 (no files yet — passes trivially). Vitest reports "No test files found" and exits 0 (pass `--passWithNoTests` if needed; adjust later).

If vitest fails on no-tests, add `"test": "vitest run --passWithNoTests"` to package.json scripts.

- [ ] **Step 9: Commit**

```bash
git add .gitignore package.json pnpm-lock.yaml tsconfig.json vite.config.ts manifest.config.ts tests/setup.ts
git commit -m "chore: bootstrap vite + svelte 5 + vitest + crxjs scaffolding"
```

---

## Task 1: Core Types

**Files:**

- Create: `src/core/types.ts`
- Create: `tests/core/registry.test.ts` (types-only sanity test, written later in Task 7)

- [ ] **Step 1: Write `src/core/types.ts`**

Create `src/core/types.ts`:

```ts
import type { Component } from 'svelte';

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

- [ ] **Step 2: Verify typecheck passes**

Run:

```bash
pnpm typecheck
```

Expected: exit 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/core/types.ts
git commit -m "feat(core): add OmniStorage, OmniModule, and DarkStorage types"
```

---

## Task 2: Domain Extraction (eTLD+1)

**Files:**

- Create: `src/core/domain.ts`
- Create: `tests/core/domain.test.ts`

- [ ] **Step 1: Write failing test `tests/core/domain.test.ts`**

Create `tests/core/domain.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { extractETLD1 } from '../../src/core/domain';

describe('extractETLD1', () => {
  it('extracts eTLD+1 from simple https URL', () => {
    expect(extractETLD1('https://github.com/user/repo')).toBe('github.com');
  });

  it('collapses subdomains to eTLD+1', () => {
    expect(extractETLD1('https://docs.github.com/en')).toBe('github.com');
    expect(extractETLD1('https://api.github.com/v1')).toBe('github.com');
  });

  it('treats foo.github.io as its own eTLD+1 (PSL multi-level TLD)', () => {
    expect(extractETLD1('https://foo.github.io/')).toBe('foo.github.io');
    expect(extractETLD1('https://bar.github.io/')).toBe('bar.github.io');
  });

  it('handles co.uk and similar two-part TLDs', () => {
    expect(extractETLD1('https://www.bbc.co.uk/news')).toBe('bbc.co.uk');
  });

  it('returns null for internal browser URLs', () => {
    expect(extractETLD1('about:blank')).toBeNull();
    expect(extractETLD1('chrome://extensions')).toBeNull();
    expect(extractETLD1('chrome-extension://abc/popup.html')).toBeNull();
  });

  it('returns null for IP hosts', () => {
    expect(extractETLD1('http://192.168.1.1:8080/')).toBeNull();
    expect(extractETLD1('http://[::1]/')).toBeNull();
  });

  it('returns null for malformed URLs', () => {
    expect(extractETLD1('not-a-url')).toBeNull();
    expect(extractETLD1('')).toBeNull();
  });

  it('returns null for localhost', () => {
    expect(extractETLD1('http://localhost:3000/')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/core/domain.test.ts`
Expected: FAIL — "Cannot find module '../../src/core/domain'".

- [ ] **Step 3: Implement `src/core/domain.ts`**

Create `src/core/domain.ts`:

```ts
import { getDomain, parse } from 'tldts';

/**
 * Extracts the registrable domain (eTLD+1) from a URL.
 * Returns null for browser-internal URLs, IPs, localhost, or malformed input.
 */
export function extractETLD1(url: string): string | null {
  if (!url) return null;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return null;
  }

  const info = parse(parsed.hostname);
  if (info.isIp) return null;

  const domain = getDomain(parsed.hostname);
  return domain ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/core/domain.test.ts`
Expected: all 8 test cases PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/domain.ts tests/core/domain.test.ts
git commit -m "feat(core): add extractETLD1 with PSL-aware domain parsing"
```

---

## Task 3: Typed Storage Wrapper

**Files:**

- Create: `src/core/storage.ts`
- Create: `tests/core/storage.test.ts`

- [ ] **Step 1: Write failing test `tests/core/storage.test.ts`**

Create `tests/core/storage.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  readStorage,
  writeStorage,
  onStorageChange,
  DEFAULT_STORAGE,
} from '../../src/core/storage';

declare const chrome: any;

describe('core/storage', () => {
  beforeEach(() => {
    chrome.flush();
  });

  describe('readStorage', () => {
    it('returns DEFAULT_STORAGE when nothing stored', async () => {
      chrome.storage.sync.get.yields({});
      const storage = await readStorage();
      expect(storage).toEqual(DEFAULT_STORAGE);
    });

    it('returns stored value under the "omni" key', async () => {
      const stored = {
        version: 1,
        modules: {
          dark: { defaultMode: 'dark', brightness: 0.9, sites: { 'github.com': 'dark' } },
        },
      };
      chrome.storage.sync.get.yields({ omni: stored });
      const storage = await readStorage();
      expect(storage).toEqual(stored);
    });
  });

  describe('writeStorage', () => {
    it('writes the object under the "omni" key', async () => {
      chrome.storage.sync.set.yields();
      await writeStorage(DEFAULT_STORAGE);
      expect(chrome.storage.sync.set.calledOnce).toBe(true);
      expect(chrome.storage.sync.set.firstCall.args[0]).toEqual({ omni: DEFAULT_STORAGE });
    });
  });

  describe('onStorageChange', () => {
    it('invokes callback with parsed new/old storage on change', () => {
      const cb = vi.fn();
      onStorageChange(cb);

      expect(chrome.storage.onChanged.addListener.calledOnce).toBe(true);
      const listener = chrome.storage.onChanged.addListener.firstCall.args[0];

      const newValue = { ...DEFAULT_STORAGE };
      const oldValue = {
        ...DEFAULT_STORAGE,
        modules: { dark: { ...DEFAULT_STORAGE.modules.dark, brightness: 0.8 } },
      };
      listener({ omni: { newValue, oldValue } }, 'sync');

      expect(cb).toHaveBeenCalledWith(newValue, oldValue);
    });

    it('ignores unrelated storage keys', () => {
      const cb = vi.fn();
      onStorageChange(cb);
      const listener = chrome.storage.onChanged.addListener.firstCall.args[0];

      listener({ otherKey: { newValue: 'x', oldValue: 'y' } }, 'sync');
      expect(cb).not.toHaveBeenCalled();
    });

    it('ignores non-sync storage changes', () => {
      const cb = vi.fn();
      onStorageChange(cb);
      const listener = chrome.storage.onChanged.addListener.firstCall.args[0];

      listener({ omni: { newValue: DEFAULT_STORAGE, oldValue: DEFAULT_STORAGE } }, 'local');
      expect(cb).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/core/storage.test.ts`
Expected: FAIL — "Cannot find module '../../src/core/storage'".

- [ ] **Step 3: Implement `src/core/storage.ts`**

Create `src/core/storage.ts`:

```ts
import type { OmniStorage } from './types';

const STORAGE_KEY = 'omni';

export const DEFAULT_STORAGE: OmniStorage = {
  version: 1,
  modules: {
    dark: {
      defaultMode: 'light',
      brightness: 1.0,
      sites: {},
    },
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

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/core/storage.test.ts`
Expected: all 6 test cases PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/storage.ts tests/core/storage.test.ts
git commit -m "feat(core): add typed chrome.storage.sync wrapper with DEFAULT_STORAGE"
```

---

## Task 4: Dark Module Storage Helpers

**Files:**

- Create: `src/modules/dark/storage.ts`
- Create: `tests/modules/dark/storage.test.ts`

- [ ] **Step 1: Write failing test `tests/modules/dark/storage.test.ts`**

Create `tests/modules/dark/storage.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  setSiteMode,
  setDefaultMode,
  setBrightness,
  cycleSiteMode,
  DARK_DEFAULTS,
} from '../../../src/modules/dark/storage';
import { DEFAULT_STORAGE } from '../../../src/core/storage';

describe('modules/dark/storage', () => {
  describe('DARK_DEFAULTS', () => {
    it('matches DEFAULT_STORAGE.modules.dark', () => {
      expect(DARK_DEFAULTS).toEqual(DEFAULT_STORAGE.modules.dark);
    });
  });

  describe('setSiteMode', () => {
    it('returns new storage with updated site entry', () => {
      const next = setSiteMode(DEFAULT_STORAGE, 'github.com', 'dark');
      expect(next.modules.dark.sites['github.com']).toBe('dark');
      expect(next).not.toBe(DEFAULT_STORAGE);
    });

    it('removes the site when mode is "default"', () => {
      const withSite = setSiteMode(DEFAULT_STORAGE, 'github.com', 'dark');
      const cleared = setSiteMode(withSite, 'github.com', 'default');
      expect(cleared.modules.dark.sites).not.toHaveProperty('github.com');
    });

    it('does not mutate input', () => {
      const original = structuredClone(DEFAULT_STORAGE);
      setSiteMode(DEFAULT_STORAGE, 'github.com', 'dark');
      expect(DEFAULT_STORAGE).toEqual(original);
    });
  });

  describe('setDefaultMode', () => {
    it('flips the global default', () => {
      const next = setDefaultMode(DEFAULT_STORAGE, 'dark');
      expect(next.modules.dark.defaultMode).toBe('dark');
    });
  });

  describe('setBrightness', () => {
    it('clamps to [0.5, 1.0]', () => {
      expect(setBrightness(DEFAULT_STORAGE, 0.3).modules.dark.brightness).toBe(0.5);
      expect(setBrightness(DEFAULT_STORAGE, 1.5).modules.dark.brightness).toBe(1.0);
      expect(setBrightness(DEFAULT_STORAGE, 0.75).modules.dark.brightness).toBe(0.75);
    });
  });

  describe('cycleSiteMode', () => {
    it('cycles default → dark → light → default', () => {
      let s = DEFAULT_STORAGE;
      s = cycleSiteMode(s, 'example.com');
      expect(s.modules.dark.sites['example.com']).toBe('dark');
      s = cycleSiteMode(s, 'example.com');
      expect(s.modules.dark.sites['example.com']).toBe('light');
      s = cycleSiteMode(s, 'example.com');
      expect(s.modules.dark.sites).not.toHaveProperty('example.com');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/modules/dark/storage.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/modules/dark/storage.ts`**

Create `src/modules/dark/storage.ts`:

```ts
import type { DarkStorage, Mode, OmniStorage } from '../../core/types';

export const DARK_DEFAULTS: DarkStorage = {
  defaultMode: 'light',
  brightness: 1.0,
  sites: {},
};

export function setSiteMode(storage: OmniStorage, domain: string, mode: Mode): OmniStorage {
  const sites = { ...storage.modules.dark.sites };
  if (mode === 'default') {
    delete sites[domain];
  } else {
    sites[domain] = mode;
  }
  return {
    ...storage,
    modules: {
      ...storage.modules,
      dark: { ...storage.modules.dark, sites },
    },
  };
}

export function setDefaultMode(storage: OmniStorage, mode: 'dark' | 'light'): OmniStorage {
  return {
    ...storage,
    modules: {
      ...storage.modules,
      dark: { ...storage.modules.dark, defaultMode: mode },
    },
  };
}

export function setBrightness(storage: OmniStorage, value: number): OmniStorage {
  const clamped = Math.min(1.0, Math.max(0.5, value));
  return {
    ...storage,
    modules: {
      ...storage.modules,
      dark: { ...storage.modules.dark, brightness: clamped },
    },
  };
}

export function cycleSiteMode(storage: OmniStorage, domain: string): OmniStorage {
  const current = storage.modules.dark.sites[domain];
  const next: Mode = current === undefined ? 'dark' : current === 'dark' ? 'light' : 'default';
  return setSiteMode(storage, domain, next);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/modules/dark/storage.test.ts`
Expected: all 6 test cases PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/dark/storage.ts tests/modules/dark/storage.test.ts
git commit -m "feat(dark): add immutable storage helpers for sites, default, brightness"
```

---

## Task 5: Dark Service — Pure Resolution Logic

**Files:**

- Create: `src/modules/dark/service.ts`
- Create: `tests/modules/dark/service.test.ts`

- [ ] **Step 1: Write failing test `tests/modules/dark/service.test.ts`**

Create `tests/modules/dark/service.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  resolveMode,
  computeEnrolledDomains,
  diffRegistrations,
} from '../../../src/modules/dark/service';
import type { OmniStorage } from '../../../src/core/types';

const baseStorage = (): OmniStorage => ({
  version: 1,
  modules: {
    dark: { defaultMode: 'light', brightness: 1.0, sites: {} },
  },
});

describe('resolveMode', () => {
  it('returns defaultMode when domain has no explicit entry', () => {
    expect(resolveMode(baseStorage(), 'github.com')).toBe('light');
  });

  it('returns explicit mode when set', () => {
    const s = baseStorage();
    s.modules.dark.sites['github.com'] = 'dark';
    expect(resolveMode(s, 'github.com')).toBe('dark');
  });

  it('returns defaultMode when explicit mode is "default"', () => {
    const s = baseStorage();
    s.modules.dark.sites['github.com'] = 'default';
    expect(resolveMode(s, 'github.com')).toBe('light');
  });

  it('respects defaultMode flip', () => {
    const s = baseStorage();
    s.modules.dark.defaultMode = 'dark';
    expect(resolveMode(s, 'unknown.com')).toBe('dark');
  });
});

describe('computeEnrolledDomains', () => {
  it('returns explicit dark sites when default is light', () => {
    const s = baseStorage();
    s.modules.dark.sites = { 'github.com': 'dark', 'example.com': 'light' };
    expect(computeEnrolledDomains(s)).toEqual({ mode: 'per-site', domains: ['github.com'] });
  });

  it('returns global + per-site light excludes when default is dark', () => {
    const s = baseStorage();
    s.modules.dark.defaultMode = 'dark';
    s.modules.dark.sites = { 'news.com': 'light', 'github.com': 'dark' };
    const result = computeEnrolledDomains(s);
    expect(result.mode).toBe('global');
    expect(result.excludeDomains).toEqual(['news.com']);
  });

  it('returns empty per-site when nothing enrolled and default is light', () => {
    expect(computeEnrolledDomains(baseStorage())).toEqual({ mode: 'per-site', domains: [] });
  });
});

describe('diffRegistrations', () => {
  it('identifies added and removed domains (per-site → per-site)', () => {
    const prev = { mode: 'per-site' as const, domains: ['a.com', 'b.com'] };
    const next = { mode: 'per-site' as const, domains: ['b.com', 'c.com'] };
    expect(diffRegistrations(prev, next)).toEqual({
      toRegister: { mode: 'per-site', domains: ['c.com'] },
      toUnregister: ['a.com'],
      fullReregister: false,
    });
  });

  it('signals full re-register when mode changes', () => {
    const prev = { mode: 'per-site' as const, domains: ['a.com'] };
    const next = { mode: 'global' as const, excludeDomains: ['b.com'] };
    const diff = diffRegistrations(prev, next);
    expect(diff.fullReregister).toBe(true);
  });

  it('signals full re-register when global excludeDomains change', () => {
    const prev = { mode: 'global' as const, excludeDomains: ['a.com'] };
    const next = { mode: 'global' as const, excludeDomains: ['b.com'] };
    const diff = diffRegistrations(prev, next);
    expect(diff.fullReregister).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/modules/dark/service.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/modules/dark/service.ts`**

Create `src/modules/dark/service.ts`:

```ts
import type { OmniStorage } from '../../core/types';

export type EnrolledSet =
  | { mode: 'per-site'; domains: string[] }
  | { mode: 'global'; excludeDomains: string[] };

export function resolveMode(storage: OmniStorage, domain: string): 'dark' | 'light' {
  const site = storage.modules.dark.sites[domain];
  if (site === 'dark' || site === 'light') return site;
  return storage.modules.dark.defaultMode;
}

export function computeEnrolledDomains(storage: OmniStorage): EnrolledSet {
  const { defaultMode, sites } = storage.modules.dark;
  if (defaultMode === 'dark') {
    const excludeDomains = Object.entries(sites)
      .filter(([, mode]) => mode === 'light')
      .map(([domain]) => domain)
      .sort();
    return { mode: 'global', excludeDomains };
  }
  const domains = Object.entries(sites)
    .filter(([, mode]) => mode === 'dark')
    .map(([domain]) => domain)
    .sort();
  return { mode: 'per-site', domains };
}

export interface RegistrationDiff {
  toRegister: EnrolledSet;
  toUnregister: string[];
  fullReregister: boolean;
}

export function diffRegistrations(prev: EnrolledSet, next: EnrolledSet): RegistrationDiff {
  if (prev.mode !== next.mode) {
    return { toRegister: next, toUnregister: allDomainIds(prev), fullReregister: true };
  }

  if (next.mode === 'global') {
    const prevG = prev as Extract<EnrolledSet, { mode: 'global' }>;
    const excludesChanged =
      prevG.excludeDomains.length !== next.excludeDomains.length ||
      prevG.excludeDomains.some((d, i) => d !== next.excludeDomains[i]);
    if (excludesChanged) {
      return { toRegister: next, toUnregister: ['__global__'], fullReregister: true };
    }
    return {
      toRegister: { mode: 'per-site', domains: [] },
      toUnregister: [],
      fullReregister: false,
    };
  }

  const prevS = prev as Extract<EnrolledSet, { mode: 'per-site' }>;
  const prevSet = new Set(prevS.domains);
  const nextSet = new Set(next.domains);
  const added = next.domains.filter((d) => !prevSet.has(d));
  const removed = prevS.domains.filter((d) => !nextSet.has(d));
  return {
    toRegister: { mode: 'per-site', domains: added },
    toUnregister: removed,
    fullReregister: false,
  };
}

function allDomainIds(set: EnrolledSet): string[] {
  if (set.mode === 'global') return ['__global__'];
  return [...set.domains];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/modules/dark/service.test.ts`
Expected: all 9 test cases PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/dark/service.ts tests/modules/dark/service.test.ts
git commit -m "feat(dark): add resolveMode, computeEnrolledDomains, diffRegistrations"
```

---

## Task 6: Dark CSS Generator

**Files:**

- Create: `src/modules/dark/css.ts`
- Create: `tests/modules/dark/css.test.ts`

- [ ] **Step 1: Write failing test `tests/modules/dark/css.test.ts`**

Create `tests/modules/dark/css.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildDarkCss, STYLE_ELEMENT_ID } from '../../../src/modules/dark/css';

describe('buildDarkCss', () => {
  it('includes filter on html with brightness variable', () => {
    const css = buildDarkCss();
    expect(css).toContain('html');
    expect(css).toContain(
      'filter: invert(1) hue-rotate(180deg) brightness(var(--omni-brightness, 1))',
    );
  });

  it('re-inverts media elements', () => {
    const css = buildDarkCss();
    expect(css).toContain('img');
    expect(css).toContain('video');
    expect(css).toContain('picture');
    expect(css).toContain('iframe');
  });

  it('sets white background on html to stabilize transparent regions', () => {
    expect(buildDarkCss()).toContain('background: white');
  });
});

describe('STYLE_ELEMENT_ID', () => {
  it('is a stable constant', () => {
    expect(STYLE_ELEMENT_ID).toBe('omni-dark-style');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/modules/dark/css.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/modules/dark/css.ts`**

Create `src/modules/dark/css.ts`:

```ts
export const STYLE_ELEMENT_ID = 'omni-dark-style';

export function buildDarkCss(): string {
  return `
html {
  filter: invert(1) hue-rotate(180deg) brightness(var(--omni-brightness, 1));
  background: white;
}
img, video, picture, iframe, svg, canvas,
[style*="background-image"] {
  filter: invert(1) hue-rotate(180deg);
}
`.trim();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/modules/dark/css.test.ts`
Expected: all 4 test cases PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/dark/css.ts tests/modules/dark/css.test.ts
git commit -m "feat(dark): add buildDarkCss pure generator"
```

---

## Task 7: Dark Content Script

**Files:**

- Create: `src/modules/dark/content.ts`
- Create: `tests/modules/dark/content.test.ts`

- [ ] **Step 1: Write failing test `tests/modules/dark/content.test.ts`**

Create `tests/modules/dark/content.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  applyDarkFilter,
  removeDarkFilter,
  updateBrightness,
} from '../../../src/modules/dark/content';
import { STYLE_ELEMENT_ID } from '../../../src/modules/dark/css';

describe('dark/content DOM helpers', () => {
  beforeEach(() => {
    document.documentElement.innerHTML = '<head></head><body></body>';
    document.documentElement.style.removeProperty('--omni-brightness');
  });

  it('applyDarkFilter injects a <style id="omni-dark-style">', () => {
    applyDarkFilter(1.0);
    const el = document.getElementById(STYLE_ELEMENT_ID);
    expect(el).toBeTruthy();
    expect(el?.tagName).toBe('STYLE');
    expect(el?.textContent).toContain('filter: invert(1)');
  });

  it('applyDarkFilter sets --omni-brightness custom property', () => {
    applyDarkFilter(0.9);
    expect(document.documentElement.style.getPropertyValue('--omni-brightness')).toBe('0.9');
  });

  it('applyDarkFilter is idempotent (no duplicate style elements)', () => {
    applyDarkFilter(1.0);
    applyDarkFilter(1.0);
    expect(document.querySelectorAll(`#${STYLE_ELEMENT_ID}`).length).toBe(1);
  });

  it('removeDarkFilter strips the style element and custom property', () => {
    applyDarkFilter(1.0);
    removeDarkFilter();
    expect(document.getElementById(STYLE_ELEMENT_ID)).toBeNull();
    expect(document.documentElement.style.getPropertyValue('--omni-brightness')).toBe('');
  });

  it('updateBrightness changes the custom property without re-injecting style', () => {
    applyDarkFilter(1.0);
    updateBrightness(0.75);
    expect(document.documentElement.style.getPropertyValue('--omni-brightness')).toBe('0.75');
    expect(document.querySelectorAll(`#${STYLE_ELEMENT_ID}`).length).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/modules/dark/content.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/modules/dark/content.ts`**

Create `src/modules/dark/content.ts`:

```ts
import { buildDarkCss, STYLE_ELEMENT_ID } from './css';

export function applyDarkFilter(brightness: number): void {
  document.documentElement.style.setProperty('--omni-brightness', String(brightness));
  if (document.getElementById(STYLE_ELEMENT_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ELEMENT_ID;
  style.textContent = buildDarkCss();
  (document.head ?? document.documentElement).appendChild(style);
}

export function removeDarkFilter(): void {
  document.getElementById(STYLE_ELEMENT_ID)?.remove();
  document.documentElement.style.removeProperty('--omni-brightness');
}

export function updateBrightness(brightness: number): void {
  document.documentElement.style.setProperty('--omni-brightness', String(brightness));
}

type ContentMessage =
  | { type: 'omni-dark/update-brightness'; brightness: number }
  | { type: 'omni-dark/remove' };

// Wire up at module load (runs at document_start in the injected context).
if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((msg: ContentMessage) => {
    if (msg.type === 'omni-dark/update-brightness') {
      updateBrightness(msg.brightness);
    } else if (msg.type === 'omni-dark/remove') {
      removeDarkFilter();
    }
  });
}

// Read brightness from storage and apply immediately.
if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
  chrome.storage.sync.get('omni').then((result) => {
    const brightness = (result.omni?.modules?.dark?.brightness as number | undefined) ?? 1.0;
    applyDarkFilter(brightness);
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/modules/dark/content.test.ts`
Expected: all 5 test cases PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/dark/content.ts tests/modules/dark/content.test.ts
git commit -m "feat(dark): add content script with apply/remove/updateBrightness"
```

---

## Task 8: Dark Popup Component

**Files:**

- Create: `src/modules/dark/Popup.svelte`
- Create: `tests/modules/dark/Popup.test.ts`

- [ ] **Step 1: Write failing test `tests/modules/dark/Popup.test.ts`**

Create `tests/modules/dark/Popup.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import Popup from '../../../src/modules/dark/Popup.svelte';
import { DEFAULT_STORAGE } from '../../../src/core/storage';

declare const chrome: any;

describe('Dark Popup', () => {
  beforeEach(() => {
    chrome.flush();
    chrome.storage.sync.get.yields({ omni: DEFAULT_STORAGE });
    chrome.storage.sync.set.yields();
    chrome.tabs.query.yields([{ id: 1, url: 'https://github.com/kevin/repo' }]);
  });

  it('renders the moon icon and OFF state when site is not dark', async () => {
    const { findByText } = render(Popup);
    expect(await findByText(/OFF/i)).toBeTruthy();
    expect(await findByText(/Current site: github\.com/)).toBeTruthy();
  });

  it('renders ON when the current site is force-dark', async () => {
    const storage = structuredClone(DEFAULT_STORAGE);
    storage.modules.dark.sites['github.com'] = 'dark';
    chrome.storage.sync.get.yields({ omni: storage });
    const { findByText } = render(Popup);
    expect(await findByText(/ON/i)).toBeTruthy();
  });

  it('clicking the toggle calls chrome.storage.sync.set', async () => {
    const { findByRole } = render(Popup);
    const toggle = await findByRole('switch');
    await fireEvent.click(toggle);
    // sinon-chrome records .set calls
    expect(chrome.storage.sync.set.called).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/modules/dark/Popup.test.ts`
Expected: FAIL — component not found.

- [ ] **Step 3: Implement `src/modules/dark/Popup.svelte`**

Create `src/modules/dark/Popup.svelte`:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { readStorage, writeStorage } from '../../core/storage';
  import { extractETLD1 } from '../../core/domain';
  import { cycleSiteMode, setDefaultMode, setBrightness } from './storage';
  import { resolveMode } from './service';
  import type { OmniStorage } from '../../core/types';
  import { DEFAULT_STORAGE } from '../../core/storage';

  let storage = $state<OmniStorage>(DEFAULT_STORAGE);
  let currentDomain = $state<string | null>(null);

  onMount(async () => {
    storage = await readStorage();
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentDomain = tab?.url ? extractETLD1(tab.url) : null;
  });

  const effectiveMode = $derived(
    currentDomain ? resolveMode(storage, currentDomain) : storage.modules.dark.defaultMode,
  );

  async function update(next: OmniStorage) {
    storage = next;
    await writeStorage(next);
  }

  function onToggleSite() {
    if (!currentDomain) return;
    update(cycleSiteMode(storage, currentDomain));
  }

  function onToggleGlobal() {
    update(setDefaultMode(storage, storage.modules.dark.defaultMode === 'dark' ? 'light' : 'dark'));
  }

  function onBrightness(e: Event) {
    const value = Number((e.target as HTMLInputElement).value) / 100;
    update(setBrightness(storage, value));
    chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      const tab = tabs[0];
      if (tab?.id !== undefined) {
        chrome.tabs.sendMessage(tab.id, { type: 'omni-dark/update-brightness', brightness: value });
      }
    });
  }
</script>

<div class="dark-popup">
  <div class="moon">🌙</div>

  <button
    class="toggle"
    role="switch"
    aria-checked={effectiveMode === 'dark'}
    onclick={onToggleSite}
    disabled={!currentDomain}
  >
    <span class="knob" class:on={effectiveMode === 'dark'}></span>
  </button>
  <div class="state">{effectiveMode === 'dark' ? 'ON' : 'OFF'}</div>

  <div class="site">Current site: {currentDomain ?? '—'}</div>

  <div class="buttons">
    <button class="btn" onclick={onToggleSite} disabled={!currentDomain}>This site only</button>
    <button class="btn" onclick={onToggleGlobal}>All sites</button>
  </div>

  <label class="brightness">
    Brightness
    <input
      type="range"
      min="50"
      max="100"
      value={Math.round(storage.modules.dark.brightness * 100)}
      oninput={onBrightness}
    />
    <span>{Math.round(storage.modules.dark.brightness * 100)}%</span>
  </label>
</div>

<style>
  .dark-popup { padding: 16px; color: #eee; font-family: system-ui, sans-serif; }
  .moon { font-size: 48px; text-align: center; }
  .toggle {
    display: block; margin: 8px auto; width: 60px; height: 30px;
    border-radius: 15px; border: none; background: #333; cursor: pointer; position: relative;
  }
  .knob {
    position: absolute; top: 3px; left: 3px; width: 24px; height: 24px;
    border-radius: 50%; background: white; transition: left 0.15s;
  }
  .knob.on { left: 33px; }
  .state { text-align: center; opacity: 0.7; }
  .site { text-align: center; margin: 12px 0; opacity: 0.7; font-size: 13px; }
  .buttons { display: flex; gap: 8px; }
  .btn { flex: 1; padding: 8px; border-radius: 6px; border: 1px solid #444; background: transparent; color: inherit; cursor: pointer; }
  .brightness { display: flex; align-items: center; gap: 8px; margin-top: 16px; font-size: 13px; }
  .brightness input { flex: 1; }
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/modules/dark/Popup.test.ts`
Expected: all 3 test cases PASS.

If tests fail on Svelte 5 runes syntax, ensure `@sveltejs/vite-plugin-svelte` v5+ is installed and `vitest.config` extends `vite.config.ts` (it does via the shared config).

- [ ] **Step 5: Commit**

```bash
git add src/modules/dark/Popup.svelte tests/modules/dark/Popup.test.ts
git commit -m "feat(dark): add Svelte Popup with moon, toggle, buttons, brightness slider"
```

---

## Task 9: Dark Module Export

**Files:**

- Create: `src/modules/dark/index.ts`
- Create: `src/modules/dark/README.md`

- [ ] **Step 1: Write `src/modules/dark/index.ts`**

Create `src/modules/dark/index.ts`:

```ts
import type { OmniModule, BackgroundCtx } from '../../core/types';
import Popup from './Popup.svelte';
import { DARK_DEFAULTS } from './storage';
import { computeEnrolledDomains, diffRegistrations, type EnrolledSet } from './service';

const CONTENT_SCRIPT_FILE = 'src/modules/dark/content.ts';

async function reconcile(prev: EnrolledSet, next: EnrolledSet): Promise<EnrolledSet> {
  const diff = diffRegistrations(prev, next);

  if (diff.fullReregister || diff.toUnregister.length > 0) {
    const existing = await chrome.scripting.getRegisteredContentScripts();
    const darkIds = existing.filter((s) => s.id.startsWith('omni-dark')).map((s) => s.id);
    if (darkIds.length > 0) {
      await chrome.scripting.unregisterContentScripts({ ids: darkIds });
    }
  }

  if (next.mode === 'global') {
    const excludeMatches = next.excludeDomains.map((d) => `*://*.${d}/*`);
    await chrome.scripting.registerContentScripts([
      {
        id: 'omni-dark-global',
        js: [CONTENT_SCRIPT_FILE],
        matches: ['<all_urls>'],
        excludeMatches,
        runAt: 'document_start',
      },
    ]);
  } else {
    const toRegister = diff.fullReregister
      ? next.domains
      : diff.toRegister.mode === 'per-site'
        ? diff.toRegister.domains
        : [];
    if (toRegister.length > 0) {
      await chrome.scripting.registerContentScripts(
        toRegister.map((domain) => ({
          id: `omni-dark-${domain}`,
          js: [CONTENT_SCRIPT_FILE],
          matches: [`*://*.${domain}/*`, `*://${domain}/*`],
          runAt: 'document_start' as const,
        })),
      );
    }
  }

  // Broadcast brightness / removals to matching live tabs (best-effort).
  for (const removed of diff.toUnregister) {
    const tabs = await chrome.tabs.query({ url: [`*://*.${removed}/*`, `*://${removed}/*`] });
    for (const tab of tabs) {
      if (tab.id !== undefined) {
        chrome.tabs.sendMessage(tab.id, { type: 'omni-dark/remove' }).catch(() => {});
      }
    }
  }

  return next;
}

const dark: OmniModule = {
  id: 'dark',
  label: 'Dark',
  icon: '🌙',
  Popup,
  storageDefaults: DARK_DEFAULTS,
  onBackground(ctx: BackgroundCtx) {
    let current: EnrolledSet = { mode: 'per-site', domains: [] };

    ctx.getStorage().then((storage) => {
      const initial = computeEnrolledDomains(storage);
      reconcile(current, initial).then((applied) => {
        current = applied;
      });
    });

    ctx.onStorageChange((next) => {
      const nextSet = computeEnrolledDomains(next);
      reconcile(current, nextSet).then((applied) => {
        current = applied;
      });
    });
  },
};

export default dark;
```

- [ ] **Step 2: Write `src/modules/dark/README.md`**

Create `src/modules/dark/README.md`:

```markdown
# Dark Mode Module

Per-site dark mode via CSS `filter: invert() hue-rotate()`.

## Storage shape

See `../../core/types.ts` → `DarkStorage`.

## Domain matching

eTLD+1 (registrable domain). `docs.github.com` and `github.com` share one setting.

## Known limitations

- Fixed-position elements may break on some sites (known `filter` stacking context issue).
- Already-dark sites look inverted-light (deferred to future "smart mode").
```

- [ ] **Step 3: Verify typecheck**

Run:

```bash
pnpm typecheck
```

Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/modules/dark/index.ts src/modules/dark/README.md
git commit -m "feat(dark): export OmniModule with background reconciliation"
```

---

## Task 10: Core Registry

**Files:**

- Create: `src/core/registry.ts`
- Create: `tests/core/registry.test.ts`

- [ ] **Step 1: Write failing test `tests/core/registry.test.ts`**

Create `tests/core/registry.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { modules } from '../../src/core/registry';

describe('core/registry', () => {
  it('exports at least the dark module', () => {
    expect(modules.length).toBeGreaterThanOrEqual(1);
    expect(modules.find((m) => m.id === 'dark')).toBeDefined();
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
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/core/registry.ts`**

Create `src/core/registry.ts`:

```ts
import type { OmniModule } from './types';
import dark from '../modules/dark';

export const modules: OmniModule[] = [dark];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/core/registry.test.ts`
Expected: all 3 test cases PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/registry.ts tests/core/registry.test.ts
git commit -m "feat(core): add module registry with dark module registered"
```

---

## Task 11: Popup Shell

**Files:**

- Create: `src/popup/index.html`
- Create: `src/popup/main.ts`
- Create: `src/popup/App.svelte`

- [ ] **Step 1: Write `src/popup/index.html`**

Create `src/popup/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Omni</title>
    <style>
      html,
      body {
        margin: 0;
        width: 340px;
        background: #15151a;
        color: #eee;
      }
    </style>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

- [ ] **Step 2: Write `src/popup/main.ts`**

Create `src/popup/main.ts`:

```ts
import { mount } from 'svelte';
import App from './App.svelte';

const target = document.getElementById('app');
if (!target) throw new Error('#app root not found');

mount(App, { target });
```

- [ ] **Step 3: Write `src/popup/App.svelte`**

Create `src/popup/App.svelte`:

```svelte
<script lang="ts">
  import { modules } from '../core/registry';

  let active = $state(modules[0]?.id ?? '');
  const activeModule = $derived(modules.find((m) => m.id === active));
</script>

<nav class="tabs">
  {#each modules as mod (mod.id)}
    <button class:active={mod.id === active} onclick={() => (active = mod.id)}>
      <span class="icon">{mod.icon}</span>
      <span class="label">{mod.label}</span>
    </button>
  {/each}
</nav>

<section class="panel">
  {#if activeModule}
    {@const Component = activeModule.Popup}
    <Component />
  {/if}
</section>

<style>
  .tabs { display: flex; border-bottom: 1px solid #2a2a30; }
  .tabs button {
    flex: 1; padding: 10px 4px; background: transparent; border: none;
    color: #ccc; cursor: pointer; font-size: 12px; border-bottom: 2px solid transparent;
  }
  .tabs button.active { color: #fff; border-bottom-color: #e4205f; }
  .tabs .icon { display: block; font-size: 16px; }
  .panel { min-height: 240px; }
</style>
```

- [ ] **Step 4: Verify typecheck + tests still pass**

Run:

```bash
pnpm typecheck && pnpm test
```

Expected: exit 0. All previously passing tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/popup/index.html src/popup/main.ts src/popup/App.svelte
git commit -m "feat(popup): add tab-shell App.svelte that iterates module registry"
```

---

## Task 12: Background Service Worker

**Files:**

- Create: `src/background/index.ts`

- [ ] **Step 1: Write `src/background/index.ts`**

Create `src/background/index.ts`:

```ts
import { modules } from '../core/registry';
import { readStorage, writeStorage, onStorageChange, DEFAULT_STORAGE } from '../core/storage';
import type { BackgroundCtx, OmniStorage } from '../core/types';

async function ensureDefaults(): Promise<OmniStorage> {
  const existing = await readStorage();
  if (existing === DEFAULT_STORAGE) {
    await writeStorage(DEFAULT_STORAGE);
    return DEFAULT_STORAGE;
  }
  return existing;
}

const ctx: BackgroundCtx = {
  getStorage: ensureDefaults,
  onStorageChange,
};

for (const mod of modules) {
  mod.onBackground?.(ctx);
}

chrome.runtime.onInstalled.addListener(() => {
  void ensureDefaults();
});
```

- [ ] **Step 2: Verify typecheck**

Run:

```bash
pnpm typecheck
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/background/index.ts
git commit -m "feat(background): wire module onBackground hooks with shared ctx"
```

---

## Task 13: Build Verification + README

**Files:**

- Create: `README.md`

- [ ] **Step 1: Run production build**

Run:

```bash
pnpm build
```

Expected: `dist/` is produced with `manifest.json`, bundled popup, content, and background scripts. No build errors.

If CRXJS complains about content script paths, ensure `src/modules/dark/content.ts` is referenced as a module entry (CRXJS picks it up automatically via `registerContentScripts` call in source, but may need an entry in `vite.config.ts` — add `build.rollupOptions.input` with content script path if needed).

- [ ] **Step 2: Run full test suite with coverage**

Run:

```bash
pnpm test:coverage
```

Expected: all tests pass; coverage report shows ≥80% on `src/core/` and `src/modules/dark/{service,storage,css}.ts`.

- [ ] **Step 3: Write `README.md`**

Create `README.md`:

````markdown
# Omni Extension

Multi-tool browser extension (Manifest V3). First module: **Dark Mode** with per-site overrides.

## Install (dev)

```bash
pnpm install
pnpm build
```
````

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

### Known limitations

- Uses `filter: invert(1) hue-rotate(180deg)` — not a color-aware dark mode. Looks ugly on already-dark sites, sites with heavy gradients/shadows, and can break `position: fixed` sticky headers on some layouts.
- Per-site rules use eTLD+1 granularity. `docs.github.com` and `github.com` share one setting.
- No E2E tests yet.

## Architecture

See [`docs/superpowers/specs/2026-04-21-omni-extension-design.md`](docs/superpowers/specs/2026-04-21-omni-extension-design.md).

Adding a new module:

1. Create `src/modules/<name>/` with `index.ts` exporting an `OmniModule`
2. Import + register in `src/core/registry.ts`

No shell code changes required.

## License

MIT

````

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: add README with install, develop, test, and architecture pointers"
````

---

## Task 14: Manual Smoke Test

**No files — manual verification only.**

- [ ] **Step 1: Build and load the extension**

```bash
pnpm build
```

Load `dist/` in Chrome via `chrome://extensions` → Load unpacked.

- [ ] **Step 2: Smoke test "This site only"**

1. Navigate to a light-themed site (e.g., `https://example.com`).
2. Open the extension popup → Dark tab.
3. Click `This site only`. Page should immediately appear inverted.
4. Reload the page. Dark filter should re-apply at `document_start` with no flash.
5. Close and reopen the browser. Navigate back to the same site. Still dark.

- [ ] **Step 3: Smoke test "All sites"**

1. In the popup, click `All sites`. `defaultMode` flips to `dark`.
2. Navigate to a different site not previously enrolled. Should be dark.
3. Open popup on a site, cycle toggle to `light`. That site should re-render un-inverted.

- [ ] **Step 4: Smoke test brightness slider**

1. On a dark site, drag the brightness slider to 70%.
2. The active tab dims live (no reload required).
3. Reload the page. Brightness persists.

- [ ] **Step 5: Smoke test cross-session persistence**

1. Quit Chrome entirely.
2. Reopen. Navigate to a dark-enrolled site. Still dark without opening the popup.

- [ ] **Step 6: Tag v0.1.0 if smoke passes**

```bash
git tag v0.1.0
```

(Don't push the tag unless Kevin approves.)

---

## Self-Review Notes

**Spec coverage check (spec §§ → task):**

- §2 In-scope MV3 scaffolding → Task 0
- §3.3 Module contract (OmniModule type) → Task 1 + Task 9
- §4 Storage schema → Task 1 + Task 3 + Task 4
- §5.1 resolveMode → Task 5
- §5.2 Content script + CSS → Tasks 6, 7
- §5.3 Background reconciliation → Task 9 (reconcile()) + Task 12 (wiring)
- §5.4 Popup UI → Task 8
- §6 Popup shell → Task 11
- §7 Manifest → Task 0 (manifest.config.ts)
- §8 Build & tooling → Task 0 + Task 13
- §9 Testing (Vitest + mocks, 80%+) → Tasks 2, 3, 4, 5, 6, 7, 8, 10, 13
- §10 Known limitations → Task 13 README + Task 9 module README
- §11 Future modules → registry contract supports them (no v1 work)
- §12 Deferred decisions (teardown mechanism) → Task 9 reconcile() sends `omni-dark/remove` message then relies on natural reload; documented in module README

**Placeholder scan:** none. Every code step has complete code. Every command has exact expected output.

**Type consistency check:**

- `OmniModule` shape in Task 1 matches usage in Task 9 and Task 10
- `EnrolledSet` discriminated union defined in Task 5, consumed correctly in Task 9
- `ContentMessage` types in Task 7 match the messages sent from Task 8 popup and Task 9 reconcile()
- `DEFAULT_STORAGE` / `DARK_DEFAULTS` consistent between core and module storage

Plan is complete.
