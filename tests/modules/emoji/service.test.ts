import { describe, it, expect } from 'vitest';
import { pushRecent, fuzzyFilter } from '../../../src/modules/emoji/service';
import type { EmojiEntry } from '../../../src/modules/emoji/service';

describe('modules/emoji/service — pushRecent', () => {
  it('prepends to an empty list', () => {
    expect(pushRecent([], '😀', 16)).toEqual(['😀']);
  });

  it('prepends a new entry', () => {
    expect(pushRecent(['b', 'c'], 'a', 3)).toEqual(['a', 'b', 'c']);
  });

  it('dedupes and moves an existing entry to the front', () => {
    expect(pushRecent(['a', 'b', 'c'], 'b', 3)).toEqual(['b', 'a', 'c']);
  });

  it('caps the length by dropping the oldest', () => {
    expect(pushRecent(['a', 'b', 'c'], 'd', 3)).toEqual(['d', 'a', 'b']);
  });

  it('is noop-returning when the char is already at the front', () => {
    expect(pushRecent(['a', 'b', 'c'], 'a', 3)).toEqual(['a', 'b', 'c']);
  });

  it('does not mutate the input array', () => {
    const input: string[] = ['a', 'b', 'c'];
    pushRecent(input, 'd', 3);
    expect(input).toEqual(['a', 'b', 'c']);
  });
});

const grinning: EmojiEntry = { char: '😀', name: 'grinning face', keywords: ['smile', 'happy'] };
const grin: EmojiEntry = { char: '😬', name: 'grimacing face', keywords: ['grin', 'awkward'] };
const cat: EmojiEntry = { char: '🐱', name: 'cat face', keywords: ['kitten', 'pet'] };
const pizza: EmojiEntry = { char: '🍕', name: 'pizza', keywords: ['food', 'italian'] };

const ALL: readonly EmojiEntry[] = [grinning, grin, cat, pizza];

describe('modules/emoji/service — fuzzyFilter', () => {
  it('returns all entries in original order for empty query', () => {
    expect(fuzzyFilter('', ALL)).toEqual([...ALL]);
  });

  it('treats whitespace-only query as empty', () => {
    expect(fuzzyFilter('   ', ALL)).toEqual([...ALL]);
  });

  it('is case-insensitive', () => {
    const upper = fuzzyFilter('GRIN', ALL);
    const lower = fuzzyFilter('grin', ALL);
    expect(upper).toEqual(lower);
    expect(upper.length).toBeGreaterThan(0);
  });

  it('ranks name startsWith above keyword match', () => {
    // "grin" starts the name "grinning face" → high score
    // "grin" is a keyword on the grimacing entry → lower score
    const result = fuzzyFilter('grin', ALL);
    expect(result[0]).toBe(grinning);
    expect(result).toContain(grin);
  });

  it('matches keyword-only hits', () => {
    const result = fuzzyFilter('kitten', ALL);
    expect(result).toEqual([cat]);
  });

  it('falls back to subsequence match on name', () => {
    // "gnf" is a subsequence of "grinning face"
    const result = fuzzyFilter('gnf', ALL);
    expect(result).toContain(grinning);
  });

  it('returns empty array for no match', () => {
    expect(fuzzyFilter('xyzzy', ALL)).toEqual([]);
  });

  it('breaks ties by original array index (stable)', () => {
    // Three entries all contain "face" in name. Expected order: grinning, grin, cat
    // preserving original array order.
    const result = fuzzyFilter('face', ALL);
    expect(result).toEqual([grinning, grin, cat]);
  });
});
