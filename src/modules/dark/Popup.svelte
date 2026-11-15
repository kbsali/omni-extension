<script lang="ts">
  import { onMount } from 'svelte';
  import { readStorage, writeStorage, DEFAULT_STORAGE } from '../../core/storage';
  import { extractETLD1 } from '../../core/domain';
  import { resolveTabUrl } from '../../core/tab';
  import { setSiteMode, setDefaultMode, setBrightness } from './storage';
  import { resolveMode, nextSiteValueOnToggle } from './service';
  import type { OmniStorage } from '../../core/types';

  let storage = $state<OmniStorage>(DEFAULT_STORAGE);
  let currentDomain = $state<string | null>(null);
  let writeError = $state<string | null>(null);

  onMount(async () => {
    storage = await readStorage();
    const url = await resolveTabUrl();
    currentDomain = url ? extractETLD1(url) : null;
  });

  const effectiveMode = $derived(
    currentDomain ? resolveMode(storage, currentDomain) : storage.modules.dark.defaultMode,
  );

  // Apply the change to a fresh read, not to the snapshot: a click before onMount
  // resolves would otherwise write DEFAULT_STORAGE over the user's settings, and a
  // shortcut toggle or another synced device would be reverted.
  async function update(change: (s: OmniStorage) => OmniStorage) {
    try {
      storage = change(await readStorage());
      await writeStorage(storage);
      writeError = null;
    } catch (err) {
      // Typically a storage.sync quota (write rate or item size).
      writeError = `Not saved: ${err instanceof Error ? err.message : String(err)}`;
      storage = await readStorage();
    }
  }

  function onToggleSite() {
    const domain = currentDomain;
    if (!domain) return;
    void update((s) => {
      const current = s.modules.dark.sites[domain] ?? 'default';
      return setSiteMode(s, domain, nextSiteValueOnToggle(current, s.modules.dark.defaultMode));
    });
  }

  function onToggleGlobal() {
    void update((s) => setDefaultMode(s, s.modules.dark.defaultMode === 'dark' ? 'light' : 'dark'));
  }

  // Update the label on input, persist on release: storage.sync allows 120 writes
  // a minute, and every input step of a drag would be one.
  function brightnessFrom(e: Event): number {
    return Number((e.target as HTMLInputElement).value) / 100;
  }

  function onBrightnessInput(e: Event) {
    storage = setBrightness(storage, brightnessFrom(e));
  }

  function onBrightnessChange(e: Event) {
    const value = brightnessFrom(e);
    void update((s) => setBrightness(s, value));
  }
</script>

<div class="dark-popup">
  <div class="moon">🌙</div>

  <button
    class="toggle"
    role="switch"
    aria-label="Toggle dark mode for this site"
    aria-checked={effectiveMode === 'dark'}
    onclick={onToggleSite}
    disabled={!currentDomain}
  >
    <span class="knob" class:on={effectiveMode === 'dark'}></span>
  </button>
  <div class="state">{effectiveMode === 'dark' ? 'ON' : 'OFF'}</div>

  <div class="site">Current site: {currentDomain ?? '—'}</div>

  <div class="buttons">
    <button class="btn" onclick={onToggleSite} disabled={!currentDomain}>This site only</button>
    <button class="btn" onclick={onToggleGlobal}>All sites</button>
  </div>

  <label class="brightness">
    Brightness
    <input
      type="range"
      min="50"
      max="100"
      value={Math.round(storage.modules.dark.brightness * 100)}
      oninput={onBrightnessInput}
      onchange={onBrightnessChange}
    />
    <span>{Math.round(storage.modules.dark.brightness * 100)}%</span>
  </label>

  {#if writeError}
    <div class="error" role="alert">{writeError}</div>
  {/if}
</div>

<style>
  .dark-popup { padding: 16px; color: #eee; font-family: system-ui, sans-serif; }
  .moon { font-size: 48px; text-align: center; }
  .toggle {
    display: block; margin: 8px auto; width: 60px; height: 30px;
    border-radius: 15px; border: none; background: #333; cursor: pointer; position: relative;
  }
  .knob {
    position: absolute; top: 3px; left: 3px; width: 24px; height: 24px;
    border-radius: 50%; background: white; transition: left 0.15s;
  }
  .knob.on { left: 33px; }
  .state { text-align: center; opacity: 0.7; }
  .site { text-align: center; margin: 12px 0; opacity: 0.7; font-size: 13px; }
  .buttons { display: flex; gap: 8px; }
  .btn { flex: 1; padding: 8px; border-radius: 6px; border: 1px solid #444; background: transparent; color: inherit; cursor: pointer; }
  .brightness { display: flex; align-items: center; gap: 8px; margin-top: 16px; font-size: 13px; }
  .brightness input { flex: 1; }
  .error { margin-top: 12px; color: #f77; font-size: 12px; }
</style>
