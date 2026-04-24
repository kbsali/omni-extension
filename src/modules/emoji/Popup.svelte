<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { EMOJIS } from './data';
  import { fuzzyFilter, pushRecent, type EmojiEntry } from './service';
  import { RECENTS_MAX } from './storage';

  const COLS = 8;
  const STORAGE_KEY = 'omni';

  let searchInput: HTMLInputElement | undefined = $state();
  let gridContainer: HTMLDivElement | undefined = $state();
  let query = $state('');
  let recents: string[] = $state([]);
  let selected = $state(0);
  let copyError: string | null = $state(null);

  // Built once; emoji dataset is static.
  const byChar = new Map<string, EmojiEntry>(EMOJIS.map((e) => [e.char, e]));

  // Look up EmojiEntry for each recent char; skip any that vanished from the dataset.
  const recentEntries: EmojiEntry[] = $derived.by(() => {
    if (query.trim() !== '') return [];
    return recents.flatMap((char) => {
      const entry = byChar.get(char);
      return entry ? [entry] : [];
    });
  });

  const mainList: EmojiEntry[] = $derived(
    query.trim() === '' ? [...EMOJIS] : fuzzyFilter(query, EMOJIS),
  );

  // Flattened list the user navigates. Recents come first when not searching.
  const visible: EmojiEntry[] = $derived([...recentEntries, ...mainList]);

  const recentsEnd = $derived(recentEntries.length);

  // Reset selection when query changes. Uses an effect on query only.
  $effect(() => {
    // touch `query` to register the dep
    query;
    selected = 0;
  });

  // Keep selection within bounds.
  $effect(() => {
    if (visible.length === 0) {
      selected = 0;
    } else if (selected > visible.length - 1) {
      selected = visible.length - 1;
    } else if (selected < 0) {
      selected = 0;
    }
  });

  onMount(async () => {
    try {
      const root = await chrome.storage.sync.get(STORAGE_KEY);
      const slice = (root[STORAGE_KEY] as { modules?: { emoji?: { recents?: string[] } } } | undefined)?.modules?.emoji;
      recents = slice?.recents ?? [];
    } catch {
      recents = [];
    }
    await tick();
    searchInput?.focus();
  });

  async function persistRecent(char: string): Promise<void> {
    try {
      const root = (await chrome.storage.sync.get(STORAGE_KEY))[STORAGE_KEY] as
        | Record<string, unknown>
        | undefined;
      const rootObj = (root ?? {}) as { modules?: Record<string, unknown> };
      const modulesObj = (rootObj.modules ?? {}) as Record<string, unknown>;
      const emojiSlice = (modulesObj.emoji ?? {}) as { recents?: string[] };
      const nextRecents = pushRecent(emojiSlice.recents ?? [], char, RECENTS_MAX);

      const next = {
        ...rootObj,
        modules: {
          ...modulesObj,
          emoji: { recents: nextRecents },
        },
      };
      await chrome.storage.sync.set({ [STORAGE_KEY]: next });
    } catch {
      // best-effort: copy already succeeded
    }
  }

  async function copyAndClose(char: string): Promise<void> {
    copyError = null;
    try {
      await navigator.clipboard.writeText(char);
    } catch (err) {
      copyError = err instanceof Error ? `Copy failed — ${err.message}` : 'Copy failed';
      return;
    }
    await persistRecent(char);
    window.close();
  }

  async function scrollSelectedIntoView(): Promise<void> {
    await tick();
    const cell = gridContainer?.querySelector<HTMLElement>(`[data-index="${selected}"]`);
    cell?.scrollIntoView({ block: 'nearest' });
  }

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      const entry = visible[selected];
      if (entry) void copyAndClose(entry.char);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      if (query.length > 0) {
        query = '';
      } else {
        window.close();
      }
      return;
    }
    if (visible.length === 0) return;
    const last = visible.length - 1;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      selected = Math.min(selected + 1, last);
      void scrollSelectedIntoView();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      selected = Math.max(selected - 1, 0);
      void scrollSelectedIntoView();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      selected = Math.min(selected + COLS, last);
      void scrollSelectedIntoView();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selected = Math.max(selected - COLS, 0);
      void scrollSelectedIntoView();
    }
  }

  function onCellClick(index: number): void {
    selected = index;
    const entry = visible[index];
    if (entry) void copyAndClose(entry.char);
  }

  function clearQuery(): void {
    query = '';
    searchInput?.focus();
  }
</script>

<div class="emoji-popup">
  <div class="search">
    <input
      bind:this={searchInput}
      bind:value={query}
      onkeydown={onKeydown}
      placeholder="Search emoji…"
      type="text"
      aria-label="Search emoji"
    />
    {#if query.length > 0}
      <button class="clear" onclick={clearQuery} aria-label="Clear search">×</button>
    {/if}
  </div>

  <div class="grid" bind:this={gridContainer}>
    {#if visible.length === 0}
      <div class="empty">No emoji for "{query}"</div>
    {:else}
      {#if recentEntries.length > 0}
        <div class="section-label">Recent</div>
      {/if}
      <div class="cells">
        {#each visible as entry, index (entry.char + '@' + index)}
          {#if index === recentsEnd && recentEntries.length > 0}
            <div class="divider"></div>
          {/if}
          <button
            type="button"
            class="cell"
            class:selected={index === selected}
            data-index={index}
            onclick={() => onCellClick(index)}
            aria-label={entry.name}
            title={entry.name}
          >
            {entry.char}
          </button>
        {/each}
      </div>
    {/if}
  </div>

  {#if copyError}
    <div class="copy-error">{copyError}</div>
  {/if}

  <div class="status">
    {visible[selected]?.name ?? ''}
  </div>
</div>

<style>
  .emoji-popup {
    display: flex;
    flex-direction: column;
    height: 100%;
    color: #eee;
    font-family: system-ui, sans-serif;
    font-size: 13px;
  }
  .search {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 8px 12px;
    border-bottom: 1px solid #2a2a30;
  }
  .search input {
    flex: 1;
    padding: 6px 8px;
    background: #0f0f12;
    color: #eee;
    border: 1px solid #2a2a30;
    border-radius: 4px;
    font-size: 13px;
  }
  .search input:focus {
    outline: none;
    border-color: #e4205f;
  }
  .clear {
    background: transparent;
    border: none;
    color: #aaa;
    cursor: pointer;
    font-size: 16px;
    padding: 0 6px;
    line-height: 1;
  }
  .clear:hover { color: #fff; }

  .grid {
    flex: 1;
    overflow-y: auto;
    padding: 6px 8px;
    min-height: 220px;
    max-height: 320px;
  }
  .section-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    opacity: 0.5;
    padding: 4px 2px;
  }
  .cells {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: 2px;
  }
  .divider {
    grid-column: 1 / -1;
    height: 1px;
    background: #2a2a30;
    margin: 4px 0;
  }
  .cell {
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 4px;
    cursor: pointer;
    font-size: 18px;
    line-height: 1;
    color: inherit;
    padding: 0;
  }
  .cell:hover { background: #1b1b20; }
  .cell.selected { border-color: #e4205f; background: #1b1b20; }
  .empty {
    padding: 32px 12px;
    text-align: center;
    opacity: 0.6;
  }

  .copy-error {
    padding: 6px 12px;
    color: #f77;
    font-size: 12px;
    border-top: 1px solid #3a1a1a;
    background: #1a0f12;
  }
  .status {
    padding: 6px 12px;
    border-top: 1px solid #2a2a30;
    opacity: 0.7;
    font-size: 12px;
    min-height: 18px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
