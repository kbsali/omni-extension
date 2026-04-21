// @ts-expect-error - sinon-chrome has no type definitions
import chrome from 'sinon-chrome';
import { beforeEach, afterAll } from 'vitest';

(globalThis as unknown as { chrome: typeof chrome }).chrome = chrome;

beforeEach(() => {
  chrome.flush();
});

afterAll(() => {
  chrome.flush();
});
