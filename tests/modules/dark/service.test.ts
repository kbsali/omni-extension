import { describe, it, expect } from 'vitest';
import { resolveMode, nextSiteValueOnToggle } from '../../../src/modules/dark/service';
import { COOKIES_DEFAULTS } from '../../../src/modules/cookies/storage';
import { EMOJI_DEFAULTS } from '../../../src/modules/emoji/storage';
import type { OmniStorage } from '../../../src/core/types';

const baseStorage = (): OmniStorage => ({
  version: 1,
  modules: {
    dark: { defaultMode: 'light', brightness: 1.0, sites: {} },
    cookies: { ...COOKIES_DEFAULTS },
    emoji: { ...EMOJI_DEFAULTS },
  },
});

describe('resolveMode', () => {
  it('returns defaultMode when domain has no explicit entry', () => {
    expect(resolveMode(baseStorage(), 'github.com')).toBe('light');
  });

  it('returns explicit mode when set', () => {
    const s = baseStorage();
    s.modules.dark.sites['github.com'] = 'dark';
    expect(resolveMode(s, 'github.com')).toBe('dark');
  });

  it('returns defaultMode when explicit mode is "default"', () => {
    const s = baseStorage();
    s.modules.dark.sites['github.com'] = 'default';
    expect(resolveMode(s, 'github.com')).toBe('light');
  });

  it('respects defaultMode flip', () => {
    const s = baseStorage();
    s.modules.dark.defaultMode = 'dark';
    expect(resolveMode(s, 'unknown.com')).toBe('dark');
  });
});

describe('dark/service — nextSiteValueOnToggle', () => {
  it('forces dark when currently default on a light default', () => {
    expect(nextSiteValueOnToggle('default', 'light')).toBe('dark');
  });

  it('clears override when explicit dark flipped to light on a light default', () => {
    // effective dark → next effective light; since light === defaultMode, store 'default'
    expect(nextSiteValueOnToggle('dark', 'light')).toBe('default');
  });

  it('forces dark when explicit light on a light default', () => {
    // effective light → next effective dark; store the override
    expect(nextSiteValueOnToggle('light', 'light')).toBe('dark');
  });

  it('forces light when currently default on a dark default', () => {
    expect(nextSiteValueOnToggle('default', 'dark')).toBe('light');
  });

  it('clears override when explicit light flipped to dark on a dark default', () => {
    expect(nextSiteValueOnToggle('light', 'dark')).toBe('default');
  });

  it('forces light when explicit dark on a dark default', () => {
    expect(nextSiteValueOnToggle('dark', 'dark')).toBe('light');
  });
});
