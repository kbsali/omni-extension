<script lang="ts">
  import { onMount } from 'svelte';

  let tab: chrome.tabs.Tab | undefined = $state();
  let error: string | null = $state(null);

  const exportable = $derived(!!tab?.id && /^https?:\/\//i.test(tab.url ?? ''));

  onMount(async () => {
    [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  });

  async function exportPdf(): Promise<void> {
    if (!tab?.id || !tab.url) return;
    error = null;
    const params = new URLSearchParams({ tabId: String(tab.id), url: tab.url });
    try {
      await chrome.tabs.create({
        url: chrome.runtime.getURL(`src/modules/article/print.html?${params}`),
        index: tab.index + 1,
      });
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
  }
</script>

<div class="article">
  <p>
    Extracts the article from this page into a clean layout, then opens the
    print dialog: pick "Save as PDF".
  </p>
  <button type="button" onclick={exportPdf} disabled={!exportable}>
    Export article to PDF
  </button>
  {#if tab && !exportable}
    <p class="hint">Only web pages (http, https) can be exported.</p>
  {/if}
  {#if error}
    <p class="error">{error}</p>
  {/if}
</div>

<style>
  .article {
    color: #eee;
    font-family: system-ui, sans-serif;
    font-size: 13px;
    padding: 12px;
  }
  p {
    margin: 0 0 10px;
    opacity: 0.8;
  }
  button {
    width: 100%;
    background: #1b1b20;
    color: #eee;
    border: 1px solid #2a2a30;
    border-radius: 4px;
    padding: 8px;
    font-size: 13px;
    cursor: pointer;
  }
  button:disabled {
    cursor: default;
    opacity: 0.6;
  }
  button:focus-visible {
    outline: 2px solid #e4205f;
    outline-offset: 1px;
  }
  .hint {
    margin-top: 8px;
    font-size: 12px;
  }
  .error {
    margin-top: 8px;
    color: #f77;
    opacity: 1;
  }
</style>
