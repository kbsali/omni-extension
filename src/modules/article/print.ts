import { extractArticle, promoteLazyImages, readTabHtml } from './service';

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

async function run(): Promise<void> {
  const params = new URLSearchParams(location.search);
  const tabId = Number(params.get('tabId'));
  const url = params.get('url') ?? '';
  if (!tabId) throw new Error('No source tab given');

  const article = extractArticle(await readTabHtml(tabId), url);
  if (!article) throw new Error('No article found on this page');

  document.title = article.title;

  const header = document.createElement('header');
  header.append(el('h1', article.title));
  const meta = [article.siteName, article.byline, article.publishedTime]
    .filter(Boolean)
    .join(' · ');
  if (meta) header.append(el('p', meta, 'meta'));
  const source = el('p', '', 'source');
  const link = el('a', article.url);
  link.setAttribute('href', article.url);
  source.append(link);
  header.append(source);

  const body = new DOMParser().parseFromString(
    article.content,
    'text/html'
  ).body;
  promoteLazyImages(body);
  const main = document.createElement('main');
  main.append(...body.childNodes);

  document.body.append(header, main);
  status.remove();

  await imagesSettled();
  window.print();
}

run().catch((err: unknown) => {
  status.textContent = err instanceof Error ? err.message : String(err);
  status.classList.add('error');
});
