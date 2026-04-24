import { describe, it, expect } from 'vitest';
import {
  buildCookieUrl,
  parseExpires,
  formatExpiresInput,
  toExportFilename,
  toExportJson,
} from '../../../src/modules/cookies/service';

describe('modules/cookies/service — buildCookieUrl', () => {
  it('uses https when secure=true', () => {
    expect(buildCookieUrl({ domain: 'x.com', path: '/', secure: true })).toBe('https://x.com/');
  });

  it('uses http when secure=false', () => {
    expect(buildCookieUrl({ domain: 'x.com', path: '/', secure: false })).toBe('http://x.com/');
  });

  it('strips a leading dot from the domain', () => {
    expect(buildCookieUrl({ domain: '.x.com', path: '/', secure: true })).toBe('https://x.com/');
  });

  it('defaults path to "/" when empty', () => {
    expect(buildCookieUrl({ domain: 'x.com', path: '', secure: true })).toBe('https://x.com/');
  });

  it('preserves non-root paths', () => {
    expect(buildCookieUrl({ domain: 'x.com', path: '/api', secure: true })).toBe(
      'https://x.com/api',
    );
  });
});

describe('modules/cookies/service — parseExpires', () => {
  it('returns undefined for empty string', () => {
    expect(parseExpires('')).toBeUndefined();
  });

  it('returns undefined for whitespace', () => {
    expect(parseExpires('   ')).toBeUndefined();
  });

  it('returns undefined for invalid input', () => {
    expect(parseExpires('not-a-date')).toBeUndefined();
  });

  it('returns unix seconds for a valid datetime-local string', () => {
    // 2030-01-15T12:00 local → Date(2030, 0, 15, 12, 0).getTime()/1000
    const expected = Math.floor(new Date(2030, 0, 15, 12, 0).getTime() / 1000);
    expect(parseExpires('2030-01-15T12:00')).toBe(expected);
  });
});

describe('modules/cookies/service — formatExpiresInput', () => {
  it('returns empty string for undefined (session cookie)', () => {
    expect(formatExpiresInput(undefined)).toBe('');
  });

  it('formats unix seconds back to a datetime-local string', () => {
    const seconds = Math.floor(new Date(2030, 0, 15, 12, 0).getTime() / 1000);
    expect(formatExpiresInput(seconds)).toBe('2030-01-15T12:00');
  });

  it('round-trips parseExpires → formatExpiresInput', () => {
    const input = '2030-01-15T12:00';
    const seconds = parseExpires(input);
    expect(seconds).toBeDefined();
    expect(formatExpiresInput(seconds)).toBe(input);
  });
});

describe('modules/cookies/service — toExportFilename', () => {
  it('formats as cookies-<domain>-<YYYY-MM-DD>.json', () => {
    const date = new Date(2026, 3, 22, 9, 30); // 22 April 2026 local
    expect(toExportFilename('x.com', date)).toBe('cookies-x.com-2026-04-22.json');
  });

  it('zero-pads month and day', () => {
    const date = new Date(2026, 0, 5); // 5 January 2026
    expect(toExportFilename('example.org', date)).toBe('cookies-example.org-2026-01-05.json');
  });
});

describe('modules/cookies/service — toExportJson', () => {
  const makeCookie = (name: string): chrome.cookies.Cookie => ({
    name,
    value: 'v-' + name,
    domain: 'x.com',
    path: '/',
    secure: true,
    httpOnly: false,
    session: true,
    sameSite: 'lax',
    storeId: '0',
    hostOnly: true,
  });

  it('returns pretty-printed JSON', () => {
    const out = toExportJson([makeCookie('a')]);
    expect(out).toContain('\n');
    expect(out).toContain('  ');
    expect(JSON.parse(out)).toEqual([makeCookie('a')]);
  });

  it('sorts cookies alphabetically by name', () => {
    const cookies = [makeCookie('zeta'), makeCookie('alpha'), makeCookie('mid')];
    const parsed = JSON.parse(toExportJson(cookies)) as chrome.cookies.Cookie[];
    expect(parsed.map((c) => c.name)).toEqual(['alpha', 'mid', 'zeta']);
  });

  it('returns "[]" for empty input', () => {
    expect(toExportJson([])).toBe('[]');
  });
});
