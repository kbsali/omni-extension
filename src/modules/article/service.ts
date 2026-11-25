import { Readability } from '@mozilla/readability';

export interface Article {
  title: string;
  byline: string | null;
  siteName: string | null;
  publishedTime: string | null;
  lang: string | null;
  content: string; // cleaned HTML
  url: string;
}

// Parses a page's serialized HTML and keeps its main article. The <base>
// makes Readability turn relative links and image paths into absolute ones
// that still resolve from the extension page.
export function extractArticle(html: string, url: string): Article | null {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const base = doc.createElement('base');
  base.href = url;
  doc.head.prepend(base);
  const parsed = new Readability(doc).parse();
  if (!parsed?.content) return null;
  return {
    title: parsed.title || doc.title || url,
    byline: parsed.byline || null,
    siteName: parsed.siteName || null,
    publishedTime: parsed.publishedTime || null,
    lang: parsed.lang || null,
    content: parsed.content,
    url,
  };
}

const normalize = (text: string | null) =>
  (text ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

// Drops what Readability keeps but a reader does not want on paper: what
// the page hid (see visibleHtml), the title repeated as the first heading, and blocks that are only a link
// (promos such as "add us to your sources", "read also" teasers).
// Returns the title to show: sites cut their metadata title, so a first
// heading that starts with it is the full headline.
export function tidyArticle(root: ParentNode, title: string): string {
  for (const hidden of root.querySelectorAll('[data-omni-hidden]')) {
    hidden.remove();
  }
  const first = root.querySelector('h1, h2');
  const heading = first?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const titles = new Set([normalize(title)]);
  const short = normalize(title).replace(/[\s.…]+$/, '');
  if (first && short && normalize(heading).startsWith(short)) {
    first.remove();
    title = heading;
    titles.add(normalize(heading));
  }
  for (const block of root.querySelectorAll('p, h2, h3, h4, h5, h6, li')) {
    const text = normalize(block.textContent);
    const media = block.querySelector('img, picture, video, iframe, svg');
    if (!text && !media) {
      block.remove();
      continue;
    }
    if (!text) continue;
    if (titles.has(text)) {
      block.remove();
      continue;
    }
    const linked = block.closest('a[href]')
      ? text
      : [...block.querySelectorAll('a[href]')]
          .map((a) => normalize(a.textContent))
          .join(' ');
    if (linked.length >= text.length * 0.9) block.remove();
  }
  for (const list of root.querySelectorAll('ul, ol')) {
    if (!list.querySelector('li')) list.remove();
  }
  return title;
}

// Author portraits, logos and icons load as small images; so do broken ones
// (width 0). Call once images have loaded.
export function dropSmallImages(root: ParentNode, minWidth = 120): void {
  for (const img of root.querySelectorAll('img')) {
    if (img.naturalWidth >= minWidth) continue;
    (img.closest('figure') ?? img.closest('a') ?? img).remove();
  }
}

// Lazy images keep their real source in data-src or srcset until scrolled
// into view; the print page never scrolls, so promote them to src.
export function promoteLazyImages(root: ParentNode): void {
  for (const img of root.querySelectorAll('img')) {
    const lazy = img.getAttribute('data-src');
    if (lazy) img.setAttribute('src', lazy);
    img.removeAttribute('loading');
  }
}

// Runs in the tab: serializes a copy of the page in which the elements the
// page hides with CSS (prompts for another login state, closed menus and
// tooltips) carry data-omni-hidden. They are marked, not removed, so
// Readability scores the page as it is; tidyArticle drops them. The live
// page is not modified.
export function visibleHtml(): string {
  const boxless = new Set(['BR', 'WBR', 'SOURCE', 'TRACK', 'TEMPLATE']);
  const copy = document.documentElement.cloneNode(true) as HTMLElement;
  const live = [...document.body.querySelectorAll('*')];
  const copied = [...copy.querySelector('body')!.querySelectorAll('*')];
  live.forEach((el, i) => {
    if (boxless.has(el.tagName) || el.checkVisibility()) return;
    if (getComputedStyle(el).display === 'contents') return;
    copied[i]?.setAttribute('data-omni-hidden', '');
  });
  return copy.outerHTML;
}

// Reads the live DOM of a tab, so content shown only to a logged-in
// subscriber is kept.
export async function readTabHtml(tabId: number): Promise<string> {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: visibleHtml,
  });
  if (typeof result?.result !== 'string') {
    throw new Error('Could not read the page');
  }
  return result.result;
}
