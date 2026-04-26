import { describe, it, expect } from 'vitest';
import { EMOJI_DEFAULTS, RECENTS_MAX } from '../../../src/modules/emoji/storage';
import { DEFAULT_STORAGE } from '../../../src/core/storage';

describe('modules/emoji/storage', () => {
  it('EMOJI_DEFAULTS has an empty recents array', () => {
    expect(EMOJI_DEFAULTS).toEqual({ recents: [] });
  });

  it('RECENTS_MAX is 16', () => {
    expect(RECENTS_MAX).toBe(16);
  });

  it('DEFAULT_STORAGE.modules.emoji matches EMOJI_DEFAULTS', () => {
    expect(DEFAULT_STORAGE.modules.emoji).toEqual(EMOJI_DEFAULTS);
  });
});
