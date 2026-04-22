import { describe, it, expect } from 'vitest';
import { buildCookieUrl } from '../../../src/modules/cookies/service';

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
