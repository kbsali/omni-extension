<script lang="ts">
  import { modules } from '../core/registry';

  let active = $state(modules[0]?.id ?? '');
  const activeModule = $derived(modules.find((m) => m.id === active));
</script>

<nav class="tabs">
  {#each modules as mod (mod.id)}
    <button class:active={mod.id === active} onclick={() => (active = mod.id)}>
      <span class="icon">{mod.icon}</span>
      <span class="label">{mod.label}</span>
    </button>
  {/each}
</nav>

<section class="panel">
  {#if activeModule}
    {@const Component = activeModule.Popup}
    <Component />
  {/if}
</section>

<style>
  .tabs { display: flex; border-bottom: 1px solid #2a2a30; }
  .tabs button {
    flex: 1; padding: 10px 4px; background: transparent; border: none;
    color: #ccc; cursor: pointer; font-size: 12px; border-bottom: 2px solid transparent;
  }
  .tabs button.active { color: #fff; border-bottom-color: #e4205f; }
  .tabs .icon { display: block; font-size: 16px; }
  .panel { min-height: 240px; }
</style>
