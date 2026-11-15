import { describe, it, expect, beforeEach } from 'vitest';
import {
  applyDarkFilter,
  buildDarkCss,
  removeDarkFilter,
  STYLE_ELEMENT_ID,
} from '../../../src/modules/dark/css';

describe('buildDarkCss', () => {
  it('includes filter on html with brightness variable', () => {
    const css = buildDarkCss();
    expect(css).toContain('html');
    expect(css).toContain(
      'filter: invert(1) hue-rotate(180deg) brightness(var(--omni-brightness, 1))',
    );
  });

  it('re-inverts media elements', () => {
    const css = buildDarkCss();
    expect(css).toContain('img');
    expect(css).toContain('video');
    expect(css).toContain('picture');
    expect(css).toContain('iframe');
  });

  it('sets white background on html to stabilize transparent regions', () => {
    expect(buildDarkCss()).toContain('background: white');
  });
});

describe('STYLE_ELEMENT_ID', () => {
  it('is a stable constant', () => {
    expect(STYLE_ELEMENT_ID).toBe('omni-dark-style');
  });
});

describe('dark/css DOM helpers', () => {
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
});
