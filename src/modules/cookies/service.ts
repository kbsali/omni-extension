export function buildCookieUrl(
  c: Pick<chrome.cookies.Cookie, 'domain' | 'path' | 'secure'>,
): string {
  const scheme = c.secure ? 'https' : 'http';
  const host = c.domain.startsWith('.') ? c.domain.slice(1) : c.domain;
  const path = c.path || '/';
  return `${scheme}://${host}${path}`;
}
