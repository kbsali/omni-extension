import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { svelteTesting } from '@testing-library/svelte/vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config.ts';

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
        // Dark content script was once registered at runtime via
        // chrome.scripting.registerContentScripts, which needed a stable,
        // hash-free path in dist/. Since a7d94de it is declared statically in
        // manifest.config.ts; this explicit input predates that switch.
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
      include: [
        'src/core/**',
        'src/modules/*/service.ts',
        'src/modules/*/storage.ts',
        'src/modules/*/css.ts',
      ],
    },
  },
});
