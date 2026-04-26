import { describe, it, expect, vi } from 'vitest';
import { buildDispatcher } from '../../src/background/shortcuts';
import type { OmniModule, OmniShortcut, ShortcutCtx } from '../../src/core/types';

function makeCtx(): ShortcutCtx {
  return {
    getStorage: vi.fn(),
    writeStorage: vi.fn(),
    getActiveTab: vi.fn(),
    openPopupFocusedOn: vi.fn(),
  } as unknown as ShortcutCtx;
}

function makeModule(id: string, shortcut: OmniShortcut | undefined): OmniModule {
  return {
    id,
    label: id,
    icon: '?',
    // @ts-expect-error — Component type not needed for dispatcher tests
    Popup: null,
    storageDefaults: {},
    shortcut,
  };
}

describe('background/shortcuts — buildDispatcher', () => {
  it('routes a known command to the matching module onInvoke', async () => {
    const onInvokeA = vi.fn();
    const onInvokeB = vi.fn();
    const modules = [
      makeModule('a', {
        commandName: 'cmd-a',
        description: 'a',
        suggestedKey: 'Alt+Shift+A',
        onInvoke: onInvokeA,
      }),
      makeModule('b', {
        commandName: 'cmd-b',
        description: 'b',
        suggestedKey: 'Alt+Shift+B',
        onInvoke: onInvokeB,
      }),
    ];
    const ctx = makeCtx();
    const dispatch = buildDispatcher(modules, ctx);

    await dispatch('cmd-b');
    expect(onInvokeB).toHaveBeenCalledWith(ctx);
    expect(onInvokeA).not.toHaveBeenCalled();
  });

  it('ignores modules without a shortcut', async () => {
    const onInvoke = vi.fn();
    const modules = [
      makeModule('no-shortcut', undefined),
      makeModule('with-shortcut', {
        commandName: 'cmd',
        description: 'x',
        suggestedKey: 'Alt+Shift+X',
        onInvoke,
      }),
    ];
    const dispatch = buildDispatcher(modules, makeCtx());

    await dispatch('cmd');
    expect(onInvoke).toHaveBeenCalledTimes(1);
  });

  it('warns and does not throw on unknown commands', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const dispatch = buildDispatcher([], makeCtx());

    await expect(dispatch('nope')).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('catches errors thrown by onInvoke and logs them', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const failing = vi.fn().mockRejectedValue(new Error('boom'));
    const modules = [
      makeModule('a', {
        commandName: 'cmd',
        description: 'a',
        suggestedKey: 'Alt+Shift+A',
        onInvoke: failing,
      }),
    ];
    const dispatch = buildDispatcher(modules, makeCtx());

    await expect(dispatch('cmd')).resolves.toBeUndefined();
    expect(failing).toHaveBeenCalled();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
    log.mockRestore();
  });
});
