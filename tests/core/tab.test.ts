import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveTabUrl } from '../../src/core/tab';

declare const chrome: any;

describe('core/tab — resolveTabUrl', () => {
  beforeEach(() => {
    chrome.tabs.query.callsFake(() => Promise.resolve([{ id: 1, url: 'https://github.com/a' }]));
  });

  afterEach(() => {
    history.replaceState(null, '', location.pathname);
  });

  it('returns the active tab URL', async () => {
    expect(await resolveTabUrl()).toBe('https://github.com/a');
  });

  it('prefers the sourceUrl query parameter', async () => {
    history.replaceState(null, '', `?sourceUrl=${encodeURIComponent('https://example.com/x?y=1')}`);
    expect(await resolveTabUrl()).toBe('https://example.com/x?y=1');
    expect(chrome.tabs.query.called).toBe(false);
  });

  it('returns null when there is no active tab', async () => {
    chrome.tabs.query.callsFake(() => Promise.resolve([]));
    expect(await resolveTabUrl()).toBeNull();
  });
});
