import { expect, test } from './fixtures';

// Regression: the dark popup wrote the whole storage from Svelte $state, and
// chrome.storage saved the proxied recents array as {}, which crashed the
// emoji tab.
test('emoji copies and saves recents after a dark mode write', async ({
  context,
  extensionId,
}) => {
  const target = await context.newPage();
  await target.goto('https://example.com');

  const popupUrl = `chrome-extension://${extensionId}/src/popup/index.html?sourceUrl=${encodeURIComponent(target.url())}`;
  const dark = await context.newPage();
  await dark.goto(popupUrl);
  await dark.getByRole('switch').click();
  await expect(target.locator('style#omni-dark-style')).toHaveCount(1);
  await dark.close();

  const popup = await context.newPage();
  const errors: string[] = [];
  popup.on('pageerror', (err) => errors.push(err.message));
  await popup.goto(popupUrl);
  await popup.getByRole('button', { name: /Emoji/ }).click();
  const closed = popup.waitForEvent('close');
  await popup.locator('[data-index="0"]').click();
  await closed;

  const [worker] = context.serviceWorkers();
  const recents = await worker!.evaluate(
    async () =>
      (
        (await chrome.storage.sync.get('omni')) as {
          omni?: { modules: { emoji: { recents: unknown } } };
        }
      ).omni?.modules.emoji.recents
  );
  expect(Array.isArray(recents)).toBe(true);
  expect(recents).toHaveLength(1);
  expect(errors).toEqual([]);
});
