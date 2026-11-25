import type { NtfyStorage } from './storage';

export interface NtfyAttachment {
  name: string;
  url: string;
  type?: string;
  size?: number;
  expires?: number; // unix seconds
}

export interface NtfyMessage {
  id: string;
  time: number; // unix seconds
  event: string;
  title?: string;
  message?: string;
  click?: string;
  attachment?: NtfyAttachment;
}

export type TextPart = { text: string } | { url: string };

const URL_RE = /https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]/g;

function authHeaders(token: string): HeadersInit {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function topicUrl({ server, topic }: NtfyStorage): string {
  const base = server.trim().replace(/\/+$/, '');
  return `${base}/${encodeURIComponent(topic.trim())}/json?poll=1&since=all`;
}

// The poll endpoint answers with one JSON object per line; keepalive and
// open events are dropped. Newest first.
export function parseMessages(body: string): NtfyMessage[] {
  return body
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line) as NtfyMessage)
    .filter((m) => m.event === 'message')
    .sort((a, b) => b.time - a.time);
}

export async function fetchMessages(
  settings: NtfyStorage,
  fetchFn: typeof fetch = fetch
): Promise<NtfyMessage[]> {
  const res = await fetchFn(topicUrl(settings), {
    headers: authHeaders(settings.token),
  });
  if (!res.ok) throw new Error(`ntfy answered ${res.status} ${res.statusText}`);
  return parseMessages(await res.text());
}

// Fetching the file and saving a blob URL makes the browser download it
// instead of opening it, and sends the token for a protected server.
export async function downloadAttachment(
  att: NtfyAttachment,
  token: string,
  fetchFn: typeof fetch = fetch
): Promise<void> {
  const res = await fetchFn(att.url, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`download failed: ${res.status}`);
  const href = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = href;
  a.download = att.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
}

export function splitLinks(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_RE)) {
    const start = match.index;
    if (start > last) parts.push({ text: text.slice(last, start) });
    parts.push({ url: match[0] });
    last = start + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

export function formatSize(bytes?: number): string {
  if (bytes === undefined) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function isExpired(att: NtfyAttachment, nowMs = Date.now()): boolean {
  return att.expires !== undefined && att.expires * 1000 < nowMs;
}
