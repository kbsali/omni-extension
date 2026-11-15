// A popup opened as a detached window (Vivaldi shortcut fallback) is its own
// currentWindow, so the background passes the source tab URL as ?sourceUrl=.
export async function resolveTabUrl(): Promise<string | null> {
  const passed = new URLSearchParams(location.search).get('sourceUrl');
  if (passed) return passed;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.url ?? null;
}
