import { test as base, chromium, type BrowserContext } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const pathToExtension = fileURLToPath(new URL('../../dist', import.meta.url));

export const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
}>({
  // Playwright parses the fixture signature and rejects anything but `{}` here.
  // oxlint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      headless: false, // MV3 service workers do not boot in standard headless
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-first-run',
      ],
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    let [serviceWorker] = context.serviceWorkers();
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker');
    }
    const extensionId = serviceWorker.url().split('/')[2] ?? '';
    await use(extensionId);
  },
});

export const expect = test.expect;
