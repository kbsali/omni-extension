import { describe, it, expect } from 'vitest';
import { COOKIES_DEFAULTS } from '../../../src/modules/cookies/storage';
import { DEFAULT_STORAGE } from '../../../src/core/storage';

describe('modules/cookies/storage', () => {
  it('COOKIES_DEFAULTS is an empty object', () => {
    expect(COOKIES_DEFAULTS).toEqual({});
  });

  it('DEFAULT_STORAGE.modules.cookies exists and equals {}', () => {
    expect(DEFAULT_STORAGE.modules.cookies).toEqual({});
  });
});
