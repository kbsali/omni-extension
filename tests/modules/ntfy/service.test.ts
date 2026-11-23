import { describe, expect, it, vi } from 'vitest';

import {
  fetchMessages,
  formatSize,
  isExpired,
  parseMessages,
  splitLinks,
  topicUrl,
} from '../../../src/modules/ntfy/service';
import { NTFY_DEFAULTS } from '../../../src/modules/ntfy/storage';

const settings = {
  server: 'https://ntfy.example.com/',
  topic: 'kbsali-all',
  token: 'tk_abc',
};

const body = [
  '{"id":"o","time":1,"event":"open","topic":"kbsali-all"}',
  '{"id":"a","time":10,"event":"message","message":"old"}',
  '',
  '{"id":"k","time":20,"event":"keepalive"}',
  '{"id":"b","time":30,"event":"message","title":"T","message":"new"}',
].join('\n');

describe('modules/ntfy/service', () => {
  it('builds the poll URL without a double slash', () => {
    expect(topicUrl(settings)).toBe(
      'https://ntfy.example.com/kbsali-all/json?poll=1&since=all'
    );
  });

  it('keeps only messages, newest first', () => {
    expect(parseMessages(body).map((m) => m.id)).toEqual(['b', 'a']);
  });

  it('sends the token as a Bearer header', async () => {
    const fetchFn = vi.fn(async () => new Response(body));
    const messages = await fetchMessages(settings, fetchFn);
    expect(messages).toHaveLength(2);
    expect(fetchFn).toHaveBeenCalledWith(topicUrl(settings), {
      headers: { Authorization: 'Bearer tk_abc' },
    });
  });

  it('sends no auth header without a token', async () => {
    const fetchFn = vi.fn(async () => new Response(''));
    await fetchMessages(NTFY_DEFAULTS, fetchFn);
    expect(fetchFn).toHaveBeenCalledWith(topicUrl(NTFY_DEFAULTS), {
      headers: {},
    });
  });

  it('throws on an HTTP error', async () => {
    const fetchFn = vi.fn(
      async () => new Response('', { status: 401, statusText: 'Unauthorized' })
    );
    await expect(fetchMessages(settings, fetchFn)).rejects.toThrow(
      'ntfy answered 401 Unauthorized'
    );
  });

  it('splits URLs out of text, leaving trailing punctuation', () => {
    expect(splitLinks('see https://a.b/c?d=1. ok')).toEqual([
      { text: 'see ' },
      { url: 'https://a.b/c?d=1' },
      { text: '. ok' },
    ]);
    expect(splitLinks('https://x.y')).toEqual([{ url: 'https://x.y' }]);
    expect(splitLinks('no link')).toEqual([{ text: 'no link' }]);
  });

  it('formats sizes', () => {
    expect(formatSize(undefined)).toBe('');
    expect(formatSize(512)).toBe('512 B');
    expect(formatSize(2048)).toBe('2.0 KB');
    expect(formatSize(3 * 1024 * 1024)).toBe('3.0 MB');
  });

  it('flags expired attachments', () => {
    const att = { name: 'f', url: 'u', expires: 100 };
    expect(isExpired(att, 99_000)).toBe(false);
    expect(isExpired(att, 101_000)).toBe(true);
    expect(isExpired({ name: 'f', url: 'u' })).toBe(false);
  });
});
