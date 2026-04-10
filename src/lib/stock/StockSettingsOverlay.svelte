<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { authFetch } from '$lib/authFetch';
  import { getSeoImageUrl } from '$lib/utils/seoImageUrl';

  export let item: any;
  export let title = 'Stock-Einstellungen';

  const dispatch = createEventDispatcher<{
    close: void;
    updated: { item: any };
  }>();

  let stockUrl = '';
  let assetId = '';
  let filenameMode: 'original' | 'web' = 'web';
  let busy: 'save' | 'upload' | 'reset' | '' = '';
  let flash = '';
  let syncKey = '';

  $: {
    const nextKey = `${item?.id || ''}:${item?.adobe_stock_url || ''}:${item?.adobe_stock_asset_id || ''}`;
    if (nextKey !== syncKey) {
      syncKey = nextKey;
      stockUrl = item?.adobe_stock_url || '';
      assetId = item?.adobe_stock_asset_id || '';
      filenameMode = 'web';
      flash = '';
    }
  }

  function firstText(...values: Array<unknown>) {
    for (const value of values) {
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return null;
  }

  function joinedKeywords(value: unknown): string | null {
    if (Array.isArray(value)) {
      const list = value
        .filter((entry): entry is string => typeof entry === 'string' && !!entry.trim())
        .map((entry) => entry.trim());
      return list.length ? list.join(', ') : null;
    }
    if (typeof value === 'string' && value.trim()) return value.trim();
    return null;
  }

  $: culocaPreview = {
    title: firstText(item?.title, item?.caption),
    description: firstText(item?.description, item?.caption),
    keywords: joinedKeywords(item?.keywords)
  };
  $: activePreview = culocaPreview;
  $: previewThumb =
    item?.slug && item?.path_512 ? getSeoImageUrl(item.slug, item.path_512, '512') : '';

  function extractAdobeAssetIdFromUrl(url: string): string {
    const match = url.trim().match(/\/(\d+)(?:[/?#]|$)/);
    return match ? match[1] : '';
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      dispatch('close');
    }
  }

  function applyUpdatedItem(next: any, fallbackMessage: string) {
    if (next?.item) {
      dispatch('updated', { item: next.item });
      flash = next?.message || fallbackMessage;
      return;
    }
    flash = fallbackMessage;
  }

  async function saveStock() {
    if (!item?.id) return;
    const normalizedUrl = stockUrl.trim();
    const inferredId = assetId.trim() || extractAdobeAssetIdFromUrl(normalizedUrl);
    const nextStatus = normalizedUrl
      ? item.adobe_stock_status === 'none'
        ? 'uploaded'
        : item.adobe_stock_status
      : 'none';
    busy = 'save';
    flash = '';
    try {
      const res = await authFetch(`/api/item/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adobe_stock_url: normalizedUrl || null,
          adobe_stock_asset_id: inferredId || null,
          adobe_stock_status: nextStatus
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        flash = data?.error || 'Speichern fehlgeschlagen';
        return;
      }
      assetId = inferredId;
      applyUpdatedItem(data, 'Gespeichert');
    } finally {
      busy = '';
    }
  }

  async function uploadToAdobe() {
    if (!item?.id) return;
    busy = 'upload';
    flash = '';
    try {
      const res = await authFetch(`/api/adobe-stock/upload/${item.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filenameMode
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        flash = data?.error || 'Upload fehlgeschlagen';
        return;
      }
      applyUpdatedItem(data, 'Upload gestartet');
    } finally {
      busy = '';
    }
  }

  async function resetAdobeBranch() {
    if (!item?.id) return;
    busy = 'reset';
    flash = '';
    try {
      const res = await authFetch(`/api/item/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adobe_stock_status: 'none',
          adobe_stock_uploaded_at: null,
          adobe_stock_asset_id: null,
          adobe_stock_url: null,
          adobe_stock_error: null
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        flash = data?.error || 'Zurücksetzen fehlgeschlagen';
        return;
      }
      applyUpdatedItem(data, 'Adobe zurückgesetzt');
    } finally {
      busy = '';
    }
  }
</script>

<div class="stock-overlay-backdrop" role="presentation" on:click={handleBackdropClick}>
  <section class="stock-overlay-panel" role="dialog" aria-modal="true" aria-label={title}>
    <header class="stock-overlay-head">
      <h3>{title}</h3>
      <button type="button" class="ghost-btn" on:click={() => dispatch('close')}>Schließen</button>
    </header>

    <p class="stock-overlay-item">
      <strong>{item?.title || item?.original_name || 'Ohne Titel'}</strong>
      {#if item?.slug}
        <span>@{item.slug}</span>
      {/if}
    </p>

    <div class="stock-overlay-meta">
      <span>Status: <code>{item?.adobe_stock_status || 'none'}</code></span>
      {#if item?.adobe_stock_uploaded_at}
        <span>Upload: {new Date(item.adobe_stock_uploaded_at).toLocaleString('de-DE')}</span>
      {/if}
    </div>

    {#if item?.adobe_stock_error}
      <p class="stock-overlay-error">{item.adobe_stock_error}</p>
    {/if}

    <label class="stock-overlay-label">
      <span>Öffentliche Stock-URL</span>
      <input type="url" bind:value={stockUrl} placeholder="https://stock.adobe.com/..." />
    </label>
    <label class="stock-overlay-label">
      <span>Asset-ID</span>
      <input type="text" bind:value={assetId} placeholder="optional" />
    </label>

    <section class="stock-upload-config">
      <h4>Adobe Upload</h4>
      <p class="stock-overlay-note">Adobe zeigt neue Uploads oft erst nach 10-20 Sekunden.</p>
      <p class="stock-overlay-note">Metadatenquelle: Culoca (Titel/Beschreibung/Keywords aus Culoca)</p>
      <div class="stock-overlay-choice-grid">
        <label class="stock-choice">
          <input type="radio" bind:group={filenameMode} value="original" />
          <span>Dateiname</span>
        </label>
        <label class="stock-choice">
          <input type="radio" bind:group={filenameMode} value="web" />
          <span>Slug (empfohlen)</span>
        </label>
      </div>
      <div class="stock-preview">
        {#if previewThumb}
          <img src={previewThumb} alt="Vorschau 512px" loading="lazy" />
        {/if}
        <div class="stock-preview-meta">
          <div><strong>Quelle:</strong> Culoca EXIF</div>
          <div><strong>Dateiname:</strong> {filenameMode === 'web' ? 'Slug' : 'Dateiname'}</div>
          <div><strong>Titel:</strong> {activePreview.title || '—'}</div>
          <div><strong>Beschreibung:</strong> {activePreview.description || '—'}</div>
          <div><strong>Keywords:</strong> {activePreview.keywords || '—'}</div>
        </div>
      </div>
    </section>

    <div class="stock-overlay-actions">
      <button type="button" class="ghost-btn" on:click={saveStock} disabled={busy === 'save'}>
        {busy === 'save' ? 'Speichert...' : 'Speichern'}
      </button>
      <button type="button" class="primary-btn" on:click={uploadToAdobe} disabled={busy === 'upload'}>
        {busy === 'upload' ? 'Upload...' : 'Adobe Upload'}
      </button>
      <button type="button" class="ghost-btn danger" on:click={resetAdobeBranch} disabled={busy === 'reset'}>
        {busy === 'reset' ? '...' : 'Adobe zurücksetzen'}
      </button>
    </div>

    {#if flash}
      <p class="stock-overlay-flash">{flash}</p>
    {/if}

    {#if item?.adobe_stock_url}
      <a class="stock-overlay-link" href={item.adobe_stock_url} target="_blank" rel="noopener noreferrer">
        Link öffnen
      </a>
    {/if}
  </section>
</div>

<style>
  .stock-overlay-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.58);
    z-index: 1200;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding: 4rem 1rem 1rem;
  }
  .stock-overlay-panel {
    width: min(760px, 100%);
    max-height: calc(100vh - 5rem);
    overflow: auto;
    border: 1px solid var(--border-color);
    border-radius: 14px;
    background: var(--bg-secondary);
    color: var(--text-primary);
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
  }
  .stock-overlay-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }
  .stock-overlay-head h3 {
    margin: 0;
    font-size: 1.1rem;
  }
  .stock-overlay-item {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem 0.8rem;
    margin: 0;
    color: var(--text-secondary);
  }
  .stock-overlay-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
    font-size: 0.9rem;
    color: var(--text-secondary);
  }
  .stock-overlay-error {
    margin: 0;
    color: #d64545;
    font-size: 0.9rem;
  }
  .stock-overlay-label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font-size: 0.9rem;
  }
  .stock-overlay-label input {
    border: 1px solid var(--border-color);
    background: var(--bg-primary);
    color: var(--text-primary);
    border-radius: 10px;
    padding: 0.58rem 0.7rem;
    font: inherit;
  }
  .stock-overlay-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .primary-btn {
    border: 1px solid var(--culoca-orange, #ee7221);
    background: var(--culoca-orange, #ee7221);
    color: #fff;
    border-radius: 10px;
    padding: 0.45rem 0.75rem;
    cursor: pointer;
    font: inherit;
  }
  .ghost-btn {
    border: 1px solid var(--border-color);
    background: var(--bg-primary);
    color: var(--text-secondary);
    border-radius: 10px;
    padding: 0.45rem 0.75rem;
    cursor: pointer;
    font: inherit;
  }
  .ghost-btn.danger {
    color: #c73e3e;
    border-color: color-mix(in srgb, #c73e3e 35%, var(--border-color));
  }
  .ghost-btn:disabled,
  .primary-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .stock-overlay-flash {
    margin: 0;
    font-size: 0.88rem;
    color: var(--text-secondary);
  }
  .stock-overlay-link {
    font-size: 0.9rem;
    color: var(--accent-color);
  }
  .stock-upload-config {
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 0.75rem;
    background: color-mix(in srgb, var(--bg-primary) 82%, transparent);
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .stock-upload-config h4 {
    margin: 0;
    font-size: 1rem;
  }
  .stock-overlay-note {
    margin: 0;
    color: var(--text-secondary);
    font-size: 0.88rem;
  }
  .stock-overlay-choice-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .stock-choice {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    border: 1px solid var(--border-color);
    border-radius: 999px;
    padding: 0.35rem 0.6rem;
    background: var(--bg-secondary);
    font-size: 0.88rem;
  }
  .stock-preview {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.65rem;
    align-items: start;
  }
  .stock-preview img {
    width: 96px;
    height: 96px;
    object-fit: cover;
    border-radius: 8px;
    border: 1px solid var(--border-color);
  }
  .stock-preview-meta {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    font-size: 0.88rem;
  }
</style>
