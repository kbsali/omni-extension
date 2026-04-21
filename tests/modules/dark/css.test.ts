import { describe, it, expect } from 'vitest';
import { buildDarkCss, STYLE_ELEMENT_ID } from '../../../src/modules/dark/css';

describe('buildDarkCss', () => {
  it('includes filter on html with brightness variable', () => {
    const css = buildDarkCss();
    expect(css).toContain('html');
    expect(css).toContain('filter: invert(1) hue-rotate(180deg) brightness(var(--omni-brightness, 1))');
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
