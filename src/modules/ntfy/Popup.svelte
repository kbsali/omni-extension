<script lang="ts">
  import { onMount } from 'svelte';
  import { readStorage, writeStorage } from '../../core/storage';
  import {
    downloadAttachment,
    fetchMessages,
    formatSize,
    isExpired,
    splitLinks,
    type NtfyAttachment,
    type NtfyMessage,
  } from './service';
  import { NTFY_DEFAULTS, type NtfyStorage } from './storage';

  let settings: NtfyStorage = $state({ ...NTFY_DEFAULTS });
  let messages: NtfyMessage[] = $state([]);
  let loading = $state(false);
  let error: string | null = $state(null);
  let showSettings = $state(false);

  const isHttp = (url?: string): url is string => !!url && /^https?:\/\//i.test(url);

  function errorText(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }

  async function load(): Promise<void> {
    loading = true;
    error = null;
    try {
      messages = await fetchMessages(settings);
    } catch (err) {
      error = errorText(err);
    } finally {
      loading = false;
    }
  }

  onMount(async () => {
    try {
      settings = { ...(await readStorage()).modules.ntfy };
    } catch (err) {
      error = errorText(err);
      return;
    }
    await load();
  });

  async function save(e: SubmitEvent): Promise<void> {
    e.preventDefault();
    try {
      const storage = await readStorage();
      await writeStorage({
        ...storage,
        modules: { ...storage.modules, ntfy: { ...settings } },
      });
    } catch (err) {
      error = errorText(err);
      return;
    }
    showSettings = false;
    await load();
  }

  async function download(att: NtfyAttachment): Promise<void> {
    error = null;
    try {
      await downloadAttachment(att, settings.token);
    } catch (err) {
      error = errorText(err);
    }
  }

  function when(time: number): string {
    return new Date(time * 1000).toLocaleString();
  }
</script>

<div class="ntfy">
  <div class="bar">
    <span class="topic" title={settings.server}>{settings.topic}</span>
    <button type="button" onclick={load} disabled={loading}>
      {loading ? 'Loading…' : 'Refresh'}
    </button>
    <button
      type="button"
      onclick={() => (showSettings = !showSettings)}
      aria-expanded={showSettings}
    >
      Settings
    </button>
  </div>

  {#if showSettings}
    <form class="settings" onsubmit={save}>
      <label>Server <input bind:value={settings.server} type="url" required /></label>
      <label>Topic <input bind:value={settings.topic} required /></label>
      <label>
        Token
        <input bind:value={settings.token} type="password" placeholder="tk_… (optional)" />
      </label>
      <button type="submit">Save</button>
    </form>
  {/if}

  {#if error}
    <div class="error">{error}</div>
  {/if}

  <ul class="list">
    {#each messages as msg (msg.id)}
      <li>
        <div class="meta">
          <strong>{msg.title ?? ''}</strong>
          <time>{when(msg.time)}</time>
        </div>
        {#if msg.message}
          <p>
            {#each splitLinks(msg.message) as part, i (i)}
              {#if 'url' in part}
                <a href={part.url} target="_blank" rel="noreferrer">{part.url}</a>
              {:else}
                {part.text}
              {/if}
            {/each}
          </p>
        {/if}
        {#if isHttp(msg.click)}
          <a class="action" href={msg.click} target="_blank" rel="noreferrer">Open link</a>
        {/if}
        {#if msg.attachment}
          {@const att = msg.attachment}
          {#if isExpired(att)}
            <span class="action expired">{att.name} (expired)</span>
          {:else}
            <button type="button" class="action" onclick={() => download(att)}>
              Download {att.name} {formatSize(att.size)}
            </button>
          {/if}
        {/if}
      </li>
    {:else}
      {#if !loading && !error}
        <li class="empty">No messages</li>
      {/if}
    {/each}
  </ul>
</div>

<style>
  .ntfy {
    color: #eee;
    font-family: system-ui, sans-serif;
    font-size: 13px;
  }
  .bar {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    border-bottom: 1px solid #2a2a30;
  }
  .topic {
    flex: 1;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  button {
    background: #1b1b20;
    color: #eee;
    border: 1px solid #2a2a30;
    border-radius: 4px;
    padding: 4px 8px;
    font-size: 12px;
    cursor: pointer;
  }
  button:disabled {
    cursor: default;
    opacity: 0.6;
  }
  button:focus-visible,
  a:focus-visible,
  input:focus-visible {
    outline: 2px solid #e4205f;
    outline-offset: 1px;
  }
  .settings {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px 12px;
    border-bottom: 1px solid #2a2a30;
  }
  .settings label {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 11px;
    opacity: 0.8;
  }
  .settings input {
    padding: 5px 8px;
    background: #0f0f12;
    color: #eee;
    border: 1px solid #2a2a30;
    border-radius: 4px;
    font-size: 13px;
  }
  .error {
    padding: 6px 12px;
    color: #f77;
    font-size: 12px;
    background: #1a0f12;
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 380px;
    overflow-y: auto;
  }
  .list li {
    padding: 8px 12px;
    border-bottom: 1px solid #2a2a30;
  }
  .meta {
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }
  time {
    font-size: 11px;
    opacity: 0.6;
    white-space: nowrap;
  }
  p {
    margin: 4px 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  a {
    color: #ff6b9a;
    cursor: pointer;
  }
  .action {
    display: inline-block;
    margin-top: 4px;
    max-width: 100%;
    overflow-wrap: anywhere;
    text-align: left;
  }
  .expired {
    opacity: 0.5;
    font-size: 12px;
  }
  .empty {
    text-align: center;
    opacity: 0.6;
    padding: 24px 12px;
  }
</style>
