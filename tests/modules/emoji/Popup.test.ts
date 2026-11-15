import { fireEvent, render } from '@testing-library/svelte';
import { beforeEach, describe, expect, it } from 'vitest';

import Popup from '../../../src/modules/emoji/Popup.svelte';

declare const chrome: any;

describe('Emoji Popup', () => {
  beforeEach(() => {
    chrome.storage.sync.get.callsFake(() => Promise.resolve({}));
    chrome.storage.local.get.callsFake(() => Promise.resolve({}));
  });

  it('resets the selection when the query changes', async () => {
    const { getByLabelText, container } = render(Popup);
    const search = getByLabelText('Search emoji');
    const selected = () =>
      container.querySelector('.cell.selected')?.getAttribute('data-index');

    await fireEvent.input(search, { target: { value: 'face' } });
    await fireEvent.keyDown(search, { key: 'ArrowRight' });
    expect(selected()).toBe('1');

    await fireEvent.input(search, { target: { value: 'faces' } });
    expect(selected()).toBe('0');
  });
});
