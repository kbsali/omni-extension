import { test, expect } from './fixtures';

test('toggling dark mode injects style element on the active site', async ({
  context,
  extensionId,
}) => {
  // Capture all console messages from all pages and the service worker.
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
    // Open the target page first so the extension can act on it.
    const target = await context.newPage();
    await target.goto('https://example.com');

    // Open the extension popup (about:blank target so we don't navigate the test page).
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/src/popup/index.html`);

    // Wait for the popup to render the current site line. The popup queries the
    // ACTIVE tab via chrome.tabs.query — but the popup itself is now active, not
    // the example.com tab. So the popup may show "Current site: —" or the popup's
    // own URL eTLD+1.
    await popup.waitForSelector('text=Current site:', { timeout: 10000 });
    const popupText = await popup.locator('.dark-popup').innerText();
    console.log('[debug] initial popup text:', popupText);

    // Bypass the active-tab quirk: write storage DIRECTLY from the popup page,
    // which has access to chrome.storage.sync as the extension. This sets the
    // per-domain mode for example.com to 'dark', mirroring what clicking
    // "This site only" would do, but without depending on active-tab resolution.
    await popup.evaluate(async () => {
      const cur = (await chrome.storage.sync.get('omni')) as {
        omni?: { modules?: { dark?: { sites?: Record<string, 'dark' | 'light' | null> } } };
      };
      const omni = cur.omni ?? {
        modules: { dark: { defaultMode: 'light', brightness: 1.0, sites: {} } },
      };
      const dark = omni.modules?.dark ?? { defaultMode: 'light', brightness: 1.0, sites: {} };
      const sites = { ...dark.sites, 'example.com': 'dark' as const };
      const next = {
        ...omni,
        modules: { ...omni.modules, dark: { ...dark, sites } },
      };
      await chrome.storage.sync.set({ omni: next });
    });

    // Give the background SW a moment to reconcile + register content script.
    await target.waitForTimeout(1500);

    // Reload the target page so the (newly registered) content script can inject.
    await target.bringToFront();
    await target.reload();
    await target.waitForLoadState('domcontentloaded');
    await target.waitForTimeout(1000); // allow async content-script chrome.storage.sync.get to resolve

    // Assert: the dark style element exists.
    const styleExists = await target.locator('style#omni-dark-style').count();

    dumpLogs('end of test');

    expect(
      styleExists,
      `Expected style#omni-dark-style on the page after toggling. Logs above.`,
    ).toBe(1);
  } catch (err) {
    dumpLogs('failure path');
    throw err;
  }
});
