import { Readability } from '@mozilla/readability';

export interface Article {
  title: string;
  byline: string | null;
  siteName: string | null;
  publishedTime: string | null;
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
    content: parsed.content,
    url,
  };
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

// Reads the live DOM of a tab, so content shown only to a logged-in
// subscriber is kept.
export async function readTabHtml(tabId: number): Promise<string> {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => document.documentElement.outerHTML,
  });
  if (typeof result?.result !== 'string') {
    throw new Error('Could not read the page');
  }
  return result.result;
}
