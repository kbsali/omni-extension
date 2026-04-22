import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // extension state shared across persistent context
  workers: 1,
  reporter: 'list',
  use: {
    trace: 'retain-on-failure',
  },
});
