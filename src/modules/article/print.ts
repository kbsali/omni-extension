import '@fontsource-variable/inter/wght.css';
import '@fontsource-variable/inter/wght-italic.css';

import {
  dropSmallImages,
  extractArticle,
  promoteLazyImages,
  readTabHtml,
  tidyArticle,
} from './service';

const status = document.querySelector<HTMLElement>('.status')!;

function el(tag: string, text: string, className?: string): HTMLElement {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  return node;
}

// Resolves once every image has loaded or failed, so the print dialog does
// not capture blank boxes.
function imagesSettled(): Promise<unknown> {
  return Promise.all(
    [...document.images].map((img) =>
      img.complete
        ? null
        : new Promise((done) => {
            img.addEventListener('load', done, { once: true });
            img.addEventListener('error', done, { once: true });
          })
    )
  );
}

function formatDate(iso: string | null, lang: string | null): string | null {
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(lang ?? undefined, { dateStyle: 'long' });
}

async function run(): Promise<void> {
  const params = new URLSearchParams(location.search);
  const tabId = Number(params.get('tabId'));
  const url = params.get('url') ?? '';
  if (!tabId) throw new Error('No source tab given');

  const article = extractArticle(await readTabHtml(tabId), url);
  if (!article) throw new Error('No article found on this page');

  const body = new DOMParser().parseFromString(
    article.content,
    'text/html'
  ).body;
  promoteLazyImages(body);
  const title = tidyArticle(body, article.title);
  const main = document.createElement('main');
  main.append(...body.childNodes);

  document.title = title;
  // Hyphenation and quote marks follow the article's language.
  if (article.lang) document.documentElement.lang = article.lang;

  const header = document.createElement('header');
  if (article.siteName) header.append(el('p', article.siteName, 'site'));
  header.append(el('h1', title));
  const meta = [article.byline, formatDate(article.publishedTime, article.lang)]
    .filter(Boolean)
    .join(' · ');
  if (meta) header.append(el('p', meta, 'meta'));
  const source = el('p', '', 'source');
  const link = el('a', article.url);
  link.setAttribute('href', article.url);
  source.append(link);
  header.append(source);

  document.body.append(header, main);
  status.remove();

  await Promise.all([imagesSettled(), document.fonts.ready]);
  dropSmallImages(main);
  // ?noprint renders the page without the dialog, to check the layout.
  if (!params.has('noprint')) window.print();
}

run().catch((err: unknown) => {
  status.textContent = err instanceof Error ? err.message : String(err);
  status.classList.add('error');
});
