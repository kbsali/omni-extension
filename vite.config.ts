import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { svelteTesting } from '@testing-library/svelte/vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [svelte(), svelteTesting(), crx({ manifest })],
  resolve: {
    alias: {
      '@core': resolve(__dirname, 'src/core'),
      '@modules': resolve(__dirname, 'src/modules'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        // Dark content script is registered dynamically via
        // chrome.scripting.registerContentScripts at runtime.
        // CRXJS cannot statically discover it from the manifest, so we add it
        // as an explicit Rollup input to ensure it is emitted to dist/ at a
        // stable, hash-free path that matches the runtime registration.
        'src/modules/dark/content': 'src/modules/dark/content.ts',
      },
      output: {
        entryFileNames: (chunk) => {
          if (chunk.name === 'src/modules/dark/content') {
            return 'src/modules/dark/content.js';
          }
          return 'assets/[name]-[hash].js';
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.ts'],
    // Playwright owns tests/e2e — exclude from Vitest discovery.
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/core/**', 'src/modules/*/service.ts', 'src/modules/*/storage.ts', 'src/modules/*/css.ts'],
    },
  },
});
