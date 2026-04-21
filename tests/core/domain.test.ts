import { describe, it, expect } from 'vitest';
import { extractETLD1 } from '../../src/core/domain';

describe('extractETLD1', () => {
  it('extracts eTLD+1 from simple https URL', () => {
    expect(extractETLD1('https://github.com/user/repo')).toBe('github.com');
  });

  it('collapses subdomains to eTLD+1', () => {
    expect(extractETLD1('https://docs.github.com/en')).toBe('github.com');
    expect(extractETLD1('https://api.github.com/v1')).toBe('github.com');
  });

  it('treats foo.github.io as its own eTLD+1 (PSL multi-level TLD)', () => {
    expect(extractETLD1('https://foo.github.io/')).toBe('foo.github.io');
    expect(extractETLD1('https://bar.github.io/')).toBe('bar.github.io');
  });

  it('handles co.uk and similar two-part TLDs', () => {
    expect(extractETLD1('https://www.bbc.co.uk/news')).toBe('bbc.co.uk');
  });

  it('returns null for internal browser URLs', () => {
    expect(extractETLD1('about:blank')).toBeNull();
    expect(extractETLD1('chrome://extensions')).toBeNull();
    expect(extractETLD1('chrome-extension://abc/popup.html')).toBeNull();
  });

  it('returns null for IP hosts', () => {
    expect(extractETLD1('http://192.168.1.1:8080/')).toBeNull();
    expect(extractETLD1('http://[::1]/')).toBeNull();
  });

  it('returns null for malformed URLs', () => {
    expect(extractETLD1('not-a-url')).toBeNull();
    expect(extractETLD1('')).toBeNull();
  });

  it('returns null for localhost', () => {
    expect(extractETLD1('http://localhost:3000/')).toBeNull();
  });
});
