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

export function applyDarkFilter(brightness: number): void {
  document.documentElement.style.setProperty(
    '--omni-brightness',
    String(brightness)
  );
  if (document.getElementById(STYLE_ELEMENT_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ELEMENT_ID;
  style.textContent = buildDarkCss();
  (document.head ?? document.documentElement).appendChild(style);
}

export function removeDarkFilter(): void {
  document.getElementById(STYLE_ELEMENT_ID)?.remove();
  document.documentElement.style.removeProperty('--omni-brightness');
}
