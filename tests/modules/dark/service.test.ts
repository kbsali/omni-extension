import { describe, it, expect } from 'vitest';
import {
  resolveMode,
  computeEnrolledDomains,
  diffRegistrations,
  nextSiteValueOnToggle,
} from '../../../src/modules/dark/service';
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

describe('computeEnrolledDomains', () => {
  it('returns explicit dark sites when default is light', () => {
    const s = baseStorage();
    s.modules.dark.sites = { 'github.com': 'dark', 'example.com': 'light' };
    expect(computeEnrolledDomains(s)).toEqual({ mode: 'per-site', domains: ['github.com'] });
  });

  it('returns global + per-site light excludes when default is dark', () => {
    const s = baseStorage();
    s.modules.dark.defaultMode = 'dark';
    s.modules.dark.sites = { 'news.com': 'light', 'github.com': 'dark' };
    const result = computeEnrolledDomains(s);
    expect(result.mode).toBe('global');
    if (result.mode !== 'global') throw new Error('expected global mode');
    expect(result.excludeDomains).toEqual(['news.com']);
  });

  it('returns empty per-site when nothing enrolled and default is light', () => {
    expect(computeEnrolledDomains(baseStorage())).toEqual({ mode: 'per-site', domains: [] });
  });
});

describe('diffRegistrations', () => {
  it('identifies added and removed domains (per-site → per-site)', () => {
    const prev = { mode: 'per-site' as const, domains: ['a.com', 'b.com'] };
    const next = { mode: 'per-site' as const, domains: ['b.com', 'c.com'] };
    expect(diffRegistrations(prev, next)).toEqual({
      toRegister: { mode: 'per-site', domains: ['c.com'] },
      toUnregister: ['a.com'],
      fullReregister: false,
    });
  });

  it('signals full re-register when mode changes', () => {
    const prev = { mode: 'per-site' as const, domains: ['a.com'] };
    const next = { mode: 'global' as const, excludeDomains: ['b.com'] };
    const diff = diffRegistrations(prev, next);
    expect(diff.fullReregister).toBe(true);
  });

  it('signals full re-register when global excludeDomains change', () => {
    const prev = { mode: 'global' as const, excludeDomains: ['a.com'] };
    const next = { mode: 'global' as const, excludeDomains: ['b.com'] };
    const diff = diffRegistrations(prev, next);
    expect(diff.fullReregister).toBe(true);
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
