import { describe, it, expect, beforeEach } from 'vitest';
import {
  applyDarkFilter,
  removeDarkFilter,
  updateBrightness,
} from '../../../src/modules/dark/content';
import { STYLE_ELEMENT_ID } from '../../../src/modules/dark/css';

describe('dark/content DOM helpers', () => {
  beforeEach(() => {
    document.documentElement.innerHTML = '<head></head><body></body>';
    document.documentElement.style.removeProperty('--omni-brightness');
  });

  it('applyDarkFilter injects a <style id="omni-dark-style">', () => {
    applyDarkFilter(1.0);
    const el = document.getElementById(STYLE_ELEMENT_ID);
    expect(el).toBeTruthy();
    expect(el?.tagName).toBe('STYLE');
    expect(el?.textContent).toContain('filter: invert(1)');
  });

  it('applyDarkFilter sets --omni-brightness custom property', () => {
    applyDarkFilter(0.9);
    expect(document.documentElement.style.getPropertyValue('--omni-brightness')).toBe('0.9');
  });

  it('applyDarkFilter is idempotent (no duplicate style elements)', () => {
    applyDarkFilter(1.0);
    applyDarkFilter(1.0);
    expect(document.querySelectorAll(`#${STYLE_ELEMENT_ID}`).length).toBe(1);
  });

  it('removeDarkFilter strips the style element and custom property', () => {
    applyDarkFilter(1.0);
    removeDarkFilter();
    expect(document.getElementById(STYLE_ELEMENT_ID)).toBeNull();
    expect(document.documentElement.style.getPropertyValue('--omni-brightness')).toBe('');
  });

  it('updateBrightness changes the custom property without re-injecting style', () => {
    applyDarkFilter(1.0);
    updateBrightness(0.75);
    expect(document.documentElement.style.getPropertyValue('--omni-brightness')).toBe('0.75');
    expect(document.querySelectorAll(`#${STYLE_ELEMENT_ID}`).length).toBe(1);
  });
});
