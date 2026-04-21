export const STYLE_ELEMENT_ID = 'omni-dark-style';

export function buildDarkCss(): string {
  return `
html {
  filter: invert(1) hue-rotate(180deg) brightness(var(--omni-brightness, 1));
  background: white;
}
img, video, picture, iframe, svg, canvas,
[style*="background-image"] {
  filter: invert(1) hue-rotate(180deg);
}
`.trim();
}
