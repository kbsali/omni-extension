import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import Popup from '../../../src/modules/dark/Popup.svelte';
import { DEFAULT_STORAGE } from '../../../src/core/storage';

declare const chrome: any;

describe('Dark Popup', () => {
  beforeEach(() => {
    chrome.flush();
    chrome.storage.sync.get.callsFake(() => Promise.resolve({ omni: DEFAULT_STORAGE }));
    chrome.storage.sync.set.callsFake(() => Promise.resolve());
    chrome.tabs.query.callsFake(() =>
      Promise.resolve([{ id: 1, url: 'https://github.com/kevin/repo' }]),
    );
    chrome.tabs.sendMessage.callsFake(() => Promise.resolve());
  });

  it('renders the moon icon and OFF state when site is not dark', async () => {
    const { findByText } = render(Popup);
    expect(await findByText(/OFF/i)).toBeTruthy();
    expect(await findByText(/Current site: github\.com/)).toBeTruthy();
  });

  it('renders ON when the current site is force-dark', async () => {
    const storage = structuredClone(DEFAULT_STORAGE);
    storage.modules.dark.sites['github.com'] = 'dark';
    chrome.storage.sync.get.callsFake(() => Promise.resolve({ omni: storage }));
    const { findByText } = render(Popup);
    expect(await findByText(/ON/i)).toBeTruthy();
  });

  it('clicking the toggle calls chrome.storage.sync.set', async () => {
    const { findByRole, findByText } = render(Popup);
    // Wait for onMount to populate currentDomain (otherwise the toggle early-returns).
    await findByText(/Current site: github\.com/);
    const toggle = await findByRole('switch');
    await fireEvent.click(toggle);
    // sinon-chrome records .set calls
    expect(chrome.storage.sync.set.called).toBe(true);
  });
});
