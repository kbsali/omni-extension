import { describe, expect, it } from 'vitest';

import { DEFAULT_STORAGE } from '../../../src/core/storage';
import { COOKIES_DEFAULTS } from '../../../src/modules/cookies/storage';

describe('modules/cookies/storage', () => {
  it('COOKIES_DEFAULTS is an empty object', () => {
    expect(COOKIES_DEFAULTS).toEqual({});
  });

  it('DEFAULT_STORAGE.modules.cookies exists and equals {}', () => {
    expect(DEFAULT_STORAGE.modules.cookies).toEqual({});
  });
});
