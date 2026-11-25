import { once } from 'node:events';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import { expect, test } from './fixtures';

const para = (n: number) =>
  `<p>Paragraphe ${n} du récit, assez long pour compter comme du contenu. `.repeat(
    3
  ) + '</p>';

const page = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<title>Le skipper raconte sa longue convalescence | Le Journal</title>
<style>.for-guests { display: none; }</style></head><body>
<nav><a href="/">Accueil</a></nav>
<div class="detail-article">
  <h1>Le skipper raconte sa longue convalescence</h1>
  <figure><img src="/photo.svg" alt="Photo"></figure>
  ${[1, 2, 3].map(para).join('')}
  <p class="for-guests">Connectez-vous pour enregistrer cet article et le lire plus tard.</p>
  ${[4, 5, 6].map(para).join('')}
</div>
<footer>Mentions légales</footer></body></html>`;

const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><rect width="400" height="200"/></svg>';

test('article export renders the article and opens the print dialog', async ({
  context,
  extensionId,
}) => {
  const server = createServer((req, res) => {
    if (req.url === '/photo.svg') {
      res.setHeader('Content-Type', 'image/svg+xml');
      res.end(svg);
      return;
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(page);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address() as AddressInfo;
  const url = `http://127.0.0.1:${port}/article.html`;

  try {
    const source = await context.newPage();
    await source.goto(url);

    const [worker] = context.serviceWorkers();
    const tabId = await worker!.evaluate(
      async (u) => (await chrome.tabs.query({ url: u }))[0]?.id,
      url
    );

    const print = await context.newPage();
    await print.addInitScript(() => {
      window.print = () => document.body.setAttribute('data-printed', '');
    });
    const params = new URLSearchParams({ tabId: String(tabId), url });
    await print.goto(
      `chrome-extension://${extensionId}/src/modules/article/print.html?${params}`
    );

    await expect(print.locator('body[data-printed]')).toBeAttached();
    await expect(print).toHaveTitle(
      'Le skipper raconte sa longue convalescence'
    );
    await expect(print.locator('main')).toContainText('Paragraphe 6');
    await expect(print.locator('main')).not.toContainText('Mentions légales');
    await expect(print.locator('main')).not.toContainText('Connectez-vous');
    await expect(print.locator('h1')).toHaveText(
      'Le skipper raconte sa longue convalescence'
    );
    await expect(print.locator('main h2')).toHaveCount(0);
    await expect(print.locator('main img')).toHaveAttribute(
      'src',
      `http://127.0.0.1:${port}/photo.svg`
    );
  } finally {
    server.close();
  }
});
