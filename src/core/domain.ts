import { getDomain, parse } from 'tldts';

/**
 * Extracts the registrable domain (eTLD+1) from a URL.
 * Returns null for browser-internal URLs, IPs, localhost, or malformed input.
 */
export function extractETLD1(url: string): string | null {
  if (!url) return null;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return null;
  }

  const info = parse(parsed.hostname, { allowPrivateDomains: true });
  if (info.isIp) return null;

  const domain = getDomain(parsed.hostname, { allowPrivateDomains: true });
  return domain ?? null;
}
