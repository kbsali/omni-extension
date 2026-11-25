import { describe, expect, it } from 'vitest';

import {
  dropSmallImages,
  extractArticle,
  promoteLazyImages,
  tidyArticle,
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

  it('replaces a cut metadata title with the full first heading', () => {
    const div = document.createElement('div');
    div.innerHTML =
      '<h2>Le skipper raconte  sa longue convalescence après la course</h2><p>Texte.</p>';
    expect(tidyArticle(div, 'Le skipper raconte sa longue conva')).toBe(
      'Le skipper raconte sa longue convalescence après la course'
    );
    expect(div.querySelector('h2')).toBeNull();
  });

  it('keeps an unrelated first heading and the given title', () => {
    const div = document.createElement('div');
    div.innerHTML = '<h2>Racontez-nous</h2><p>Texte.</p>';
    expect(tidyArticle(div, 'Le skipper')).toBe('Le skipper');
    expect(div.querySelector('h2')).not.toBeNull();
  });

  it('drops link-only blocks and keeps text with links', () => {
    const div = document.createElement('div');
    div.innerHTML = [
      '<p><a href="/sources">Ajouter Le Journal à vos sources</a></p>',
      '<a href="/autre"><h3>Lire aussi : autre article</h3></a>',
      '<p>Un texte avec <a href="/x">un lien</a> au milieu de la phrase.</p>',
    ].join('');
    tidyArticle(div, 'Titre');
    expect(div.textContent).not.toContain('Ajouter');
    expect(div.textContent).not.toContain('Lire aussi');
    expect(div.textContent).toContain('au milieu de la phrase');
  });

  it('drops small and broken images with their figure', () => {
    const div = document.createElement('div');
    div.innerHTML =
      '<figure><img alt="author"><figcaption>Auteur</figcaption></figure><figure><img alt="photo"></figure>';
    const [small, big] = div.querySelectorAll('img');
    Object.defineProperty(small, 'naturalWidth', { value: 64 });
    Object.defineProperty(big, 'naturalWidth', { value: 1200 });
    dropSmallImages(div);
    expect(div.querySelectorAll('figure')).toHaveLength(1);
    expect(div.querySelector('img')!.alt).toBe('photo');
  });
});
