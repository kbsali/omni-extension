export function buildCookieUrl(
  c: Pick<chrome.cookies.Cookie, 'domain' | 'path' | 'secure'>,
): string {
  const scheme = c.secure ? 'https' : 'http';
  const host = c.domain.startsWith('.') ? c.domain.slice(1) : c.domain;
  const path = c.path || '/';
  return `${scheme}://${host}${path}`;
}

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

export function parseExpires(datetimeLocal: string): number | undefined {
  if (!datetimeLocal.trim()) return undefined;
  const ms = new Date(datetimeLocal).getTime();
  if (Number.isNaN(ms)) return undefined;
  return Math.floor(ms / 1000);
}

export function formatExpiresInput(expirationDate: number | undefined): string {
  if (expirationDate === undefined) return '';
  const d = new Date(expirationDate * 1000);
  if (Number.isNaN(d.getTime())) return '';
  return (
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` +
    `T${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  );
}
