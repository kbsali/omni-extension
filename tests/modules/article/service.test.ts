import { describe, expect, it } from 'vitest';

import {
  extractArticle,
  promoteLazyImages,
} from '../../../src/modules/article/service';

const para = (n: number) =>
  `<p>Paragraphe ${n} du récit, assez long pour compter comme du contenu réel. `.repeat(
    3
  ) + '</p>';

const page = `<!doctype html><html><head><title>Le skipper raconte sa longue convalescence | Le Journal</title>
<meta property="og:site_name" content="Le Journal"></head><body>
<nav><a href="/">Accueil</a><a href="/sports">Sports</a></nav>
<div class="detail-article">
  <h1>Le skipper raconte sa longue convalescence</h1>
  <p class="author">Par Jeanne Martin</p>
  <figure><img src="/images/photo.jpg" alt="Photo"><figcaption>Légende</figcaption></figure>
  ${[1, 2, 3, 4, 5, 6].map(para).join('')}
</div>
<aside><article><a href="/autre">Autre article</a></article></aside>
<footer>Mentions légales</footer>
</body></html>`;

describe('article/service', () => {
  it('extracts the main text, title and site name', () => {
    const a = extractArticle(page, 'https://www.example.fr/sports/x.php')!;
    expect(a.title).toBe('Le skipper raconte sa longue convalescence');
    expect(a.siteName).toBe('Le Journal');
    expect(a.content).toContain('Paragraphe 6');
    expect(a.content).not.toContain('Mentions légales');
    expect(a.url).toBe('https://www.example.fr/sports/x.php');
  });

  it('turns relative image paths into absolute ones', () => {
    const a = extractArticle(page, 'https://www.example.fr/sports/x.php')!;
    expect(a.content).toContain('https://www.example.fr/images/photo.jpg');
  });

  it('returns null for a page without content', () => {
    expect(
      extractArticle('<html><body></body></html>', 'https://x.fr/')
    ).toBeNull();
  });

  it('promotes lazy image sources', () => {
    const div = document.createElement('div');
    div.innerHTML =
      '<img src="blank.gif" data-src="https://x.fr/real.jpg" loading="lazy"><img src="https://x.fr/a.jpg">';
    promoteLazyImages(div);
    const [lazy, plain] = div.querySelectorAll('img');
    expect(lazy!.getAttribute('src')).toBe('https://x.fr/real.jpg');
    expect(lazy!.hasAttribute('loading')).toBe(false);
    expect(plain!.getAttribute('src')).toBe('https://x.fr/a.jpg');
  });
});
