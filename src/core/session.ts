const PENDING_TAB_KEY = 'omni.pendingTab';

export async function setPendingTab(moduleId: string): Promise<void> {
  await chrome.storage.session.set({ [PENDING_TAB_KEY]: moduleId });
}

export async function consumePendingTab(): Promise<string | undefined> {
  const result = await chrome.storage.session.get(PENDING_TAB_KEY);
  const value = result[PENDING_TAB_KEY] as string | undefined;
  if (value !== undefined) await chrome.storage.session.remove(PENDING_TAB_KEY);
  return value;
}
