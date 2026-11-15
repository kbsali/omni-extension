import { crx } from '@crxjs/vite-plugin';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { svelteTesting } from '@testing-library/svelte/vite';
import { defineConfig } from 'vitest/config';

import manifest from './manifest.config.ts';

export default defineConfig({
  plugins: [svelte(), svelteTesting(), crx({ manifest })],
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
