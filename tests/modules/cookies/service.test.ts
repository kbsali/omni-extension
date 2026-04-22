import { describe, it, expect } from 'vitest';
import { buildCookieUrl, parseExpires, formatExpiresInput } from '../../../src/modules/cookies/service';

describe('modules/cookies/service — buildCookieUrl', () => {
  it('uses https when secure=true', () => {
    expect(buildCookieUrl({ domain: 'x.com', path: '/', secure: true }))
      .toBe('https://x.com/');
  });

  it('uses http when secure=false', () => {
    expect(buildCookieUrl({ domain: 'x.com', path: '/', secure: false }))
      .toBe('http://x.com/');
  });

  it('strips a leading dot from the domain', () => {
    expect(buildCookieUrl({ domain: '.x.com', path: '/', secure: true }))
      .toBe('https://x.com/');
  });

  it('defaults path to "/" when empty', () => {
    expect(buildCookieUrl({ domain: 'x.com', path: '', secure: true }))
      .toBe('https://x.com/');
  });

  it('preserves non-root paths', () => {
    expect(buildCookieUrl({ domain: 'x.com', path: '/api', secure: true }))
      .toBe('https://x.com/api');
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
