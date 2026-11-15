import { test, expect } from './fixtures';

test('toggling dark mode injects style element on the active site', async ({
  context,
  extensionId,
}) => {
  const logs: string[] = [];
  context.on('console', (msg) => logs.push(`[page:${msg.type()}] ${msg.text()}`));
  for (const sw of context.serviceWorkers()) {
    sw.on('console', (msg) => logs.push(`[sw:${msg.type()}] ${msg.text()}`));
  }
  context.on('serviceworker', (sw) => {
    sw.on('console', (msg) => logs.push(`[sw:${msg.type()}] ${msg.text()}`));
  });

  const dumpLogs = (label: string) => {
    console.log(`--- captured logs (${label}) ---`);
    for (const line of logs) console.log(line);
    console.log('--- end logs ---');
  };

  try {
    const target = await context.newPage();
    await target.goto('https://example.com');

    // A popup opened as a page is its own active tab: pass the site the way
    // the detached-window fallback does.
    const popup = await context.newPage();
    await popup.goto(
      `chrome-extension://${extensionId}/src/popup/index.html?sourceUrl=${encodeURIComponent(target.url())}`,
    );
    await expect(popup.getByText('Current site: example.com')).toBeVisible();
    await popup.getByRole('switch').click();

    await expect(target.locator('style#omni-dark-style')).toHaveCount(1);

    dumpLogs('end of test');
  } catch (err) {
    dumpLogs('failure path');
    throw err;
  }
});
