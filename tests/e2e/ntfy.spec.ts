import { once } from 'node:events';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import { expect, test } from './fixtures';

test('ntfy lists messages with a link and a downloadable file', async ({
  context,
  extensionId,
}) => {
  const auth: (string | undefined)[] = [];
  const server = createServer((req, res) => {
    auth.push(req.headers.authorization);
    if (req.url === '/file/report.txt') {
      res.end('file body');
      return;
    }
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const lines = [
      {
        id: 'a',
        time: 1,
        event: 'message',
        message: 'see https://example.com/x',
      },
      {
        id: 'b',
        time: 2,
        event: 'message',
        title: 'Report',
        message: 'report.txt',
        attachment: {
          name: 'report.txt',
          url: `${base}/file/report.txt`,
          size: 9,
        },
      },
    ];
    res.end(lines.map((l) => JSON.stringify(l)).join('\n'));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address() as AddressInfo;

  try {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/src/popup/index.html`);
    await popup.getByRole('button', { name: /ntfy/ }).click();
    await popup.getByRole('button', { name: 'Settings' }).click();
    await popup.getByLabel('Server').fill(`http://127.0.0.1:${port}`);
    await popup.getByLabel('Token').fill('tk_test');
    await popup.getByRole('button', { name: 'Save' }).click();

    await expect(
      popup.getByRole('link', { name: 'https://example.com/x' })
    ).toBeVisible();
    const downloadPromise = popup.waitForEvent('download');
    await popup.getByRole('button', { name: /Download report\.txt/ }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('report.txt');
    expect(auth.at(-1)).toBe('Bearer tk_test');
  } finally {
    server.close();
  }
});
