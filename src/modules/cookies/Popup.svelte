<script lang="ts">
  import { onMount } from 'svelte';
  import { extractETLD1 } from '../../core/domain';
  import {
    buildCookieUrl,
    parseExpires,
    formatExpiresInput,
    toExportFilename,
    toExportJson,
  } from './service';

  type Draft = { name: string; value: string; expires: string };

  let domain = $state<string | null>(null);
  let tabUrl = $state<string | null>(null);
  let cookies = $state<chrome.cookies.Cookie[]>([]);
  let expanded = $state<Record<string, boolean>>({});
  let edits = $state<Record<string, { value: string; expires: string }>>({});
  let errors = $state<Record<string, string>>({});
  let draft = $state<Draft | null>(null);
  let draftError = $state<string | null>(null);
  let loading = $state(false);

  function cookieKey(c: chrome.cookies.Cookie): string {
    return `${c.domain}|${c.path}|${c.name}`;
  }

  function sortCookies(list: chrome.cookies.Cookie[]): chrome.cookies.Cookie[] {
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }

  async function loadCookies(): Promise<void> {
    if (!domain) return;
    loading = true;
    try {
      const all = await chrome.cookies.getAll({ domain });
      cookies = sortCookies(all);
      errors = {};
    } finally {
      loading = false;
    }
  }

  onMount(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    tabUrl = tab?.url ?? null;
    domain = tab?.url ? extractETLD1(tab.url) : null;
    if (domain) {
      await loadCookies();
    }
  });

  function toggle(key: string): void {
    expanded = { ...expanded, [key]: !expanded[key] };
  }

  function onValueInput(key: string, current: chrome.cookies.Cookie, next: string): void {
    edits = {
      ...edits,
      [key]: {
        value: next,
        expires: edits[key]?.expires ?? formatExpiresInput(current.expirationDate),
      },
    };
  }

  function onExpiresInput(key: string, current: chrome.cookies.Cookie, next: string): void {
    edits = {
      ...edits,
      [key]: {
        value: edits[key]?.value ?? current.value,
        expires: next,
      },
    };
  }

  function isDirty(c: chrome.cookies.Cookie): boolean {
    const e = edits[cookieKey(c)];
    if (!e) return false;
    return e.value !== c.value || e.expires !== formatExpiresInput(c.expirationDate);
  }

  function describeError(err: unknown): string {
    const runtimeErr = chrome.runtime.lastError?.message;
    if (runtimeErr) return `Failed: ${runtimeErr}`;
    if (err instanceof Error) return `Failed: ${err.message}`;
    return 'Failed: unknown error';
  }

  async function save(c: chrome.cookies.Cookie): Promise<void> {
    const key = cookieKey(c);
    const edit = edits[key];
    if (!edit) return;
    const url = buildCookieUrl(c);
    const expirationDate = parseExpires(edit.expires);
    try {
      const result = await chrome.cookies.set({
        url,
        name: c.name,
        value: edit.value,
        path: c.path,
        domain: c.hostOnly ? undefined : c.domain,
        secure: c.secure,
        httpOnly: c.httpOnly,
        sameSite: c.sameSite,
        storeId: c.storeId,
        ...(expirationDate !== undefined ? { expirationDate } : {}),
      });
      if (!result) {
        errors = { ...errors, [key]: 'Chrome refused this cookie (flag mismatch?)' };
        return;
      }
      errors = Object.fromEntries(Object.entries(errors).filter(([k]) => k !== key));
      const nextEdits = { ...edits };
      delete nextEdits[key];
      edits = nextEdits;
      await loadCookies();
    } catch (err) {
      errors = { ...errors, [key]: describeError(err) };
    }
  }

  async function remove(c: chrome.cookies.Cookie): Promise<void> {
    const key = cookieKey(c);
    try {
      await chrome.cookies.remove({ url: buildCookieUrl(c), name: c.name, storeId: c.storeId });
      errors = Object.fromEntries(Object.entries(errors).filter(([k]) => k !== key));
      await loadCookies();
    } catch (err) {
      errors = { ...errors, [key]: describeError(err) };
    }
  }

  function startAdd(): void {
    if (!domain) return;
    draft = { name: '', value: '', expires: '' };
    draftError = null;
  }

  function cancelAdd(): void {
    draft = null;
    draftError = null;
  }

  async function saveDraft(): Promise<void> {
    if (!draft || !domain || !tabUrl) return;
    if (!draft.name.trim()) {
      draftError = 'Name is required';
      return;
    }
    const expirationDate = parseExpires(draft.expires);
    try {
      const result = await chrome.cookies.set({
        url: tabUrl,
        name: draft.name.trim(),
        value: draft.value,
        path: '/',
        domain,
        ...(expirationDate !== undefined ? { expirationDate } : {}),
      });
      if (!result) {
        draftError = 'Chrome refused this cookie (flag mismatch?)';
        return;
      }
      draft = null;
      draftError = null;
      await loadCookies();
    } catch (err) {
      draftError = describeError(err);
    }
  }

  async function deleteAll(): Promise<void> {
    if (!domain) return;
    const n = cookies.length;
    if (n === 0) return;
    const ok = confirm(`Delete all ${n} cookies for ${domain}?`);
    if (!ok) return;
    await Promise.all(
      cookies.map((c) =>
        chrome.cookies.remove({ url: buildCookieUrl(c), name: c.name, storeId: c.storeId }),
      ),
    );
    await loadCookies();
  }

  function exportJson(): void {
    if (!domain) return;
    const json = toExportJson(cookies);
    const filename = toExportFilename(domain, new Date());
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
</script>

{#if !domain}
  <div class="empty">Cookies aren't available on this page.</div>
{:else}
  <div class="cookies-popup">
    <header>
      <span class="domain">{domain}</span>
      <span class="count">{cookies.length}</span>
    </header>

    <ul class="list">
      {#if draft}
        <li class="row draft open">
          <input
            class="name-input"
            placeholder="cookie name"
            bind:value={draft.name}
          />
          <div class="panel">
            <label>
              value
              <textarea bind:value={draft.value}></textarea>
            </label>
            <label>
              expires
              <input type="datetime-local" bind:value={draft.expires} />
            </label>
            <div class="actions">
              <button class="btn" onclick={saveDraft}>Save</button>
              <button class="btn" onclick={cancelAdd}>Cancel</button>
            </div>
            {#if draftError}
              <div class="error">{draftError}</div>
            {/if}
          </div>
        </li>
      {/if}

      {#each cookies as c (cookieKey(c))}
        {@const key = cookieKey(c)}
        {@const open = expanded[key] ?? false}
        {@const valueVal = edits[key]?.value ?? c.value}
        {@const expiresVal = edits[key]?.expires ?? formatExpiresInput(c.expirationDate)}
        <li class="row" class:open>
          <button class="head" onclick={() => toggle(key)}>
            <span class="arrow">{open ? '▾' : '▸'}</span>
            <span class="name">{c.name}</span>
          </button>
          {#if open}
            <div class="panel">
              <div class="meta">
                <span>domain: {c.domain}</span>
                <span>path: {c.path}</span>
                {#if c.httpOnly}<span class="badge">httpOnly</span>{/if}
                {#if c.secure}<span class="badge">secure</span>{/if}
                <span class="badge">sameSite: {c.sameSite}</span>
              </div>
              <label>
                value
                <textarea
                  value={valueVal}
                  oninput={(e) => onValueInput(key, c, (e.target as HTMLTextAreaElement).value)}
                ></textarea>
              </label>
              <label>
                expires
                <input
                  type="datetime-local"
                  value={expiresVal}
                  oninput={(e) => onExpiresInput(key, c, (e.target as HTMLInputElement).value)}
                />
              </label>
              <div class="actions">
                <button class="btn" disabled={!isDirty(c)} onclick={() => save(c)}>Save</button>
                <button class="btn danger" onclick={() => remove(c)}>Delete</button>
              </div>
              {#if errors[key]}
                <div class="error">{errors[key]}</div>
              {/if}
            </div>
          {/if}
        </li>
      {/each}
    </ul>

    {#if !loading && cookies.length === 0 && !draft}
      <div class="empty">No cookies for {domain}</div>
    {/if}

    <footer>
      <button class="foot" onclick={startAdd} disabled={!!draft}>
        <span class="ic">+</span><span>Add</span>
      </button>
      <button class="foot" onclick={deleteAll} disabled={cookies.length === 0}>
        <span class="ic">🗑</span><span>Delete All</span>
      </button>
      <button class="foot" onclick={loadCookies}>
        <span class="ic">↻</span><span>Refresh</span>
      </button>
      <button class="foot" onclick={exportJson} disabled={cookies.length === 0}>
        <span class="ic">⬆</span><span>Export</span>
      </button>
    </footer>
  </div>
{/if}

<style>
  .cookies-popup { display: flex; flex-direction: column; height: 100%; color: #eee; font-family: system-ui, sans-serif; font-size: 13px; }
  header { display: flex; justify-content: space-between; padding: 8px 12px; border-bottom: 1px solid #2a2a30; }
  .domain { font-weight: 500; }
  .count { opacity: 0.6; }
  .list { list-style: none; margin: 0; padding: 0; overflow-y: auto; flex: 1; max-height: 320px; }
  .row { border-bottom: 1px solid #1d1d22; }
  .head { width: 100%; text-align: left; background: transparent; border: none; color: inherit; padding: 8px 12px; cursor: pointer; font-size: 13px; display: flex; gap: 6px; align-items: center; }
  .head:hover { background: #1b1b20; }
  .arrow { opacity: 0.6; width: 10px; display: inline-block; }
  .row.open { background: #15151a; }
  .panel { padding: 8px 12px 12px; display: flex; flex-direction: column; gap: 8px; }
  .meta { display: flex; flex-wrap: wrap; gap: 6px; opacity: 0.7; font-size: 11px; }
  .badge { padding: 1px 6px; border-radius: 3px; background: #26262c; }
  .panel label { display: flex; flex-direction: column; gap: 2px; font-size: 11px; opacity: 0.8; }
  .panel textarea { min-height: 44px; background: #0f0f12; color: #eee; border: 1px solid #2a2a30; border-radius: 4px; padding: 4px 6px; font-family: monospace; resize: vertical; }
  .panel input[type="datetime-local"] { background: #0f0f12; color: #eee; border: 1px solid #2a2a30; border-radius: 4px; padding: 4px 6px; }
  .name-input { margin: 8px 12px 0; background: #0f0f12; color: #eee; border: 1px solid #2a2a30; border-radius: 4px; padding: 6px 8px; }
  .actions { display: flex; gap: 6px; margin-top: 4px; }
  .btn { padding: 4px 10px; border-radius: 4px; border: 1px solid #3a3a42; background: transparent; color: inherit; cursor: pointer; font-size: 12px; }
  .btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .btn.danger { border-color: #5a2a2a; color: #e88; }
  .error { color: #f77; font-size: 11px; }
  .empty { padding: 24px; text-align: center; opacity: 0.5; }
  footer { display: grid; grid-template-columns: repeat(4, 1fr); border-top: 1px solid #2a2a30; }
  .foot { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 8px 4px; background: transparent; border: none; color: inherit; cursor: pointer; font-size: 11px; }
  .foot:hover:not(:disabled) { background: #1b1b20; }
  .foot:disabled { opacity: 0.4; cursor: not-allowed; }
  .ic { font-size: 16px; }
</style>
