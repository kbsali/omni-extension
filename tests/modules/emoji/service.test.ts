import { describe, it, expect } from 'vitest';
import { pushRecent } from '../../../src/modules/emoji/service';

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
