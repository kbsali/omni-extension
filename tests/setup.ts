// @ts-expect-error — sinon-chrome@3 ships no .d.ts files and pins sinon@7 (2019, no new releases since 2020).
import chrome from 'sinon-chrome';
import { beforeEach } from 'vitest';

(globalThis as unknown as { chrome: typeof chrome }).chrome = chrome;

beforeEach(() => {
  chrome.flush();
});
