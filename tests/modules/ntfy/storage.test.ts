import { describe, expect, it } from 'vitest';

import { DEFAULT_STORAGE, withDefaults } from '../../../src/core/storage';
import { NTFY_DEFAULTS } from '../../../src/modules/ntfy/storage';

describe('modules/ntfy/storage', () => {
  it('defaults to the kbsali-all topic with no token', () => {
    expect(NTFY_DEFAULTS.topic).toBe('kbsali-all');
    expect(NTFY_DEFAULTS.token).toBe('');
  });

  it('DEFAULT_STORAGE.modules.ntfy matches NTFY_DEFAULTS', () => {
    expect(DEFAULT_STORAGE.modules.ntfy).toEqual(NTFY_DEFAULTS);
  });

  it('fills ntfy for storage written before the module existed', () => {
    expect(withDefaults({ modules: {} }).modules.ntfy).toEqual(NTFY_DEFAULTS);
  });
});
