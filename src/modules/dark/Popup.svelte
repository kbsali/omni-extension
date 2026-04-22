<script lang="ts">
  import { onMount } from 'svelte';
  import { readStorage, writeStorage, DEFAULT_STORAGE } from '../../core/storage';
  import { extractETLD1 } from '../../core/domain';
  import { setSiteMode, setDefaultMode, setBrightness } from './storage';
  import { resolveMode } from './service';
  import type { OmniStorage } from '../../core/types';

  let storage = $state<OmniStorage>(DEFAULT_STORAGE);
  let currentDomain = $state<string | null>(null);

  onMount(async () => {
    storage = await readStorage();
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentDomain = tab?.url ? extractETLD1(tab.url) : null;
  });

  const effectiveMode = $derived(
    currentDomain ? resolveMode(storage, currentDomain) : storage.modules.dark.defaultMode,
  );

  async function update(next: OmniStorage) {
    console.log('[omni/dark/popup] writing storage', next.modules.dark);
    storage = next;
    await writeStorage(next);
  }

  function onToggleSite() {
    if (!currentDomain) return;
    const current = resolveMode(storage, currentDomain);
    const next = current === 'dark' ? 'light' : 'dark';
    const defaultMode = storage.modules.dark.defaultMode;
    const siteValue = next === defaultMode ? 'default' : next;
    update(setSiteMode(storage, currentDomain, siteValue));
  }

  function onToggleGlobal() {
    update(setDefaultMode(storage, storage.modules.dark.defaultMode === 'dark' ? 'light' : 'dark'));
  }

  function onBrightness(e: Event) {
    const value = Number((e.target as HTMLInputElement).value) / 100;
    update(setBrightness(storage, value));
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
      oninput={onBrightness}
    />
    <span>{Math.round(storage.modules.dark.brightness * 100)}%</span>
  </label>
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
</style>
