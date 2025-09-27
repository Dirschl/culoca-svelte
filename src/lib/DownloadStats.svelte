<script lang="ts">
  import { onMount } from 'svelte';
  import { authFetch } from '$lib/authFetch';

  export let itemId: string | null = null; // null = all items, specific UUID = single item

  let downloadStats: any[] = [];
  let downloadHistory: any[] = [];
  let loading = false;
  let error = '';

  onMount(() => {
    loadDownloadStats();
  });

  async function loadDownloadStats() {
    try {
      loading = true;
      error = '';
      
      const url = itemId ? `/api/download-stats/${itemId}` : '/api/download-stats/all';
      const response = await authFetch(url);
      
      if (response.ok) {
        const data = await response.json();
        downloadStats = data.downloadStats || [];
        downloadHistory = data.downloadHistory || [];
      } else {
        const errorData = await response.json();
        error = errorData.error || 'Fehler beim Laden der Statistiken';
      }
    } catch (err) {
      console.error('Error loading download stats:', err);
      error = 'Fehler beim Laden der Statistiken';
    } finally {
      loading = false;
    }
  }

  function formatNumber(num: number): string {
    return num.toLocaleString('de-DE');
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString('de-DE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function getDownloadTypeLabel(type: string): string {
    switch (type) {
      case 'full_resolution': return 'Vollauflösung';
      case 'preview': return 'Vorschau';
      case 'purchased': return 'Gekauft';
      default: return type;
    }
  }

  function getDownloadSourceLabel(source: string): string {
    switch (source) {
      case 'rights': return 'Berechtigung';
      case 'purchase': return 'Kauf';
      case 'owner': return 'Eigentümer';
      default: return source;
    }
  }

  function getTotalStats() {
    if (!downloadStats || downloadStats.length === 0) return null;
    
    return downloadStats.reduce((total, stat) => ({
      total_downloads: total.total_downloads + stat.total_downloads,
      unique_downloaders: total.unique_downloaders + stat.unique_downloaders,
      full_resolution_downloads: total.full_resolution_downloads + stat.full_resolution_downloads,
      unique_full_res_downloaders: total.unique_full_res_downloaders + stat.unique_full_res_downloaders,
      preview_downloads: total.preview_downloads + stat.preview_downloads,
      unique_preview_downloaders: total.unique_preview_downloaders + stat.unique_preview_downloaders
    }), {
      total_downloads: 0,
      unique_downloaders: 0,
      full_resolution_downloads: 0,
      unique_full_res_downloaders: 0,
      preview_downloads: 0,
      unique_preview_downloaders: 0
    });
  }
</script>

<div class="download-stats">
  <h3>Download-Statistiken {itemId ? 'für dieses Item' : '(alle Items)'}</h3>
  
  {#if error}
    <div class="error-message">
      {error}
    </div>
  {/if}

  {#if loading}
    <div class="loading">
      Lade Statistiken...
    </div>
  {:else if downloadStats.length === 0}
    <div class="no-stats">
      Noch keine Download-Statistiken verfügbar
    </div>
  {:else}
    <!-- Gesamt-Statistiken -->
    {#if !itemId}
      {@const totalStats = getTotalStats()}
      {#if totalStats}
        <div class="total-stats">
          <h4>Gesamt-Übersicht</h4>
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-number">{formatNumber(totalStats.total_downloads)}</div>
              <div class="stat-label">Downloads gesamt</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">{formatNumber(totalStats.unique_downloaders)}</div>
              <div class="stat-label">Einzigartige Downloader</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">{formatNumber(totalStats.full_resolution_downloads)}</div>
              <div class="stat-label">Vollauflösung Downloads</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">{formatNumber(totalStats.unique_full_res_downloaders)}</div>
              <div class="stat-label">Einzigartige Vollauflösung Downloader</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">{formatNumber(totalStats.preview_downloads)}</div>
              <div class="stat-label">Vorschau Downloads</div>
            </div>
            <div class="stat-card">
              <div class="stat-number">{formatNumber(totalStats.unique_preview_downloaders)}</div>
              <div class="stat-label">Einzigartige Vorschau Downloader</div>
            </div>
          </div>
        </div>
      {/if}
    {/if}

    <!-- Einzelne Item-Statistiken -->
    <div class="item-stats">
      <h4>{itemId ? 'Item-Statistiken' : 'Statistiken nach Items'}</h4>
      <div class="stats-table">
        <table>
          <thead>
            <tr>
              {#if !itemId}
                <th>Item ID</th>
              {/if}
              <th>Downloads gesamt</th>
              <th>Einzigartige Downloader</th>
              <th>Vollauflösung</th>
              <th>Einzigartige Vollauflösung</th>
              <th>Vorschau</th>
              <th>Einzigartige Vorschau</th>
            </tr>
          </thead>
          <tbody>
            {#each downloadStats as stat}
              <tr>
                {#if !itemId}
                  <td class="item-id">{stat.item_id}</td>
                {/if}
                <td>{formatNumber(stat.total_downloads)}</td>
                <td>{formatNumber(stat.unique_downloaders)}</td>
                <td>{formatNumber(stat.full_resolution_downloads)}</td>
                <td>{formatNumber(stat.unique_full_res_downloaders)}</td>
                <td>{formatNumber(stat.preview_downloads)}</td>
                <td>{formatNumber(stat.unique_preview_downloaders)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Download History -->
    {#if downloadHistory.length > 0}
      <div class="download-history">
        <h4>Download-Historie (nach Datum sortiert)</h4>
        <div class="history-table">
          <table>
            <thead>
              <tr>
                {#if !itemId}
                  <th>Item</th>
                {/if}
                <th>Benutzer</th>
                <th>Download-Typ</th>
                <th>Quelle</th>
                <th>Datum</th>
              </tr>
            </thead>
            <tbody>
              {#each downloadHistory as history}
                <tr>
                  {#if !itemId}
                    <td class="item-info">
                      {#if history.items}
                        <a href={`/item/${history.items.slug}`} class="item-link" target="_blank">
                          {history.items.title || 'Unbenannt'}
                        </a>
                        <div class="item-id">ID: {history.item_id.slice(0, 8)}...</div>
                      {:else}
                        <span class="item-id">ID: {history.item_id.slice(0, 8)}...</span>
                      {/if}
                    </td>
                  {/if}
                  <td class="user-info">
                    <div class="user-name">
                      {history.profiles?.full_name || 'Unbekannt'}
                    </div>
                    <div class="user-account">
                      @{history.profiles?.accountname || 'unbekannt'}
                    </div>
                  </td>
                  <td>
                    <span class="download-type download-type-{history.download_type}">
                      {getDownloadTypeLabel(history.download_type)}
                    </span>
                  </td>
                  <td>
                    <span class="download-source download-source-{history.download_source}">
                      {getDownloadSourceLabel(history.download_source)}
                    </span>
                  </td>
                  <td class="download-date">
                    {formatDate(history.created_at)}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .download-stats {
    background: var(--bg-secondary);
    padding: 1.5rem;
    border-radius: 8px;
    margin: 1rem 0;
  }

  h3 {
    margin: 0 0 1.5rem 0;
    color: var(--text-primary);
    font-size: 1.3rem;
  }

  h4 {
    margin: 1.5rem 0 1rem 0;
    color: var(--text-primary);
  }

  .error-message {
    background: var(--error-bg);
    color: var(--error-color);
    padding: 0.75rem 1rem;
    border-radius: 4px;
    margin-bottom: 1rem;
  }

  .loading {
    color: var(--text-secondary);
    font-style: italic;
    text-align: center;
    padding: 2rem;
  }

  .no-stats {
    color: var(--text-secondary);
    font-style: italic;
    text-align: center;
    padding: 2rem;
  }

  .total-stats {
    background: var(--bg-primary);
    padding: 1.5rem;
    border-radius: 8px;
    margin-bottom: 1.5rem;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }

  .stat-card {
    background: var(--bg-secondary);
    padding: 1rem;
    border-radius: 4px;
    text-align: center;
  }

  .stat-number {
    font-size: 1.5rem;
    font-weight: bold;
    color: var(--accent-color);
    margin-bottom: 0.5rem;
  }

  .stat-label {
    font-size: 0.9rem;
    color: var(--text-secondary);
  }

  .stats-table {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    background: var(--bg-primary);
    border-radius: 4px;
    overflow: hidden;
  }

  th, td {
    padding: 0.75rem;
    text-align: left;
    border-bottom: 1px solid var(--border-color);
  }

  th {
    background: var(--bg-secondary);
    font-weight: 600;
    color: var(--text-primary);
  }

  td {
    color: var(--text-primary);
  }

  .item-id {
    font-family: monospace;
    font-size: 0.9rem;
  }

  /* Download History Styles */
  .download-history {
    margin-top: 2rem;
    background: var(--bg-primary);
    padding: 1.5rem;
    border-radius: 8px;
  }

  .history-table {
    overflow-x: auto;
  }

  .user-info {
    min-width: 150px;
  }

  .user-name {
    font-weight: 500;
    color: var(--text-primary);
  }

  .user-account {
    font-size: 0.8rem;
    color: var(--text-secondary);
    font-style: italic;
  }

  .item-info {
    min-width: 200px;
  }

  .item-link {
    color: var(--primary-color);
    text-decoration: none;
    font-weight: 500;
  }

  .item-link:hover {
    text-decoration: underline;
  }

  .download-type {
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.8rem;
    font-weight: 500;
  }

  .download-type-full_resolution {
    background: var(--success-bg);
    color: var(--success-color);
  }

  .download-type-preview {
    background: var(--warning-bg);
    color: var(--warning-color);
  }

  .download-type-purchased {
    background: var(--info-bg);
    color: var(--info-color);
  }

  .download-source {
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.8rem;
    font-weight: 500;
  }

  .download-source-rights {
    background: var(--primary-bg);
    color: var(--primary-color);
  }

  .download-source-purchase {
    background: var(--success-bg);
    color: var(--success-color);
  }

  .download-source-owner {
    background: var(--info-bg);
    color: var(--info-color);
  }

  .download-date {
    font-family: monospace;
    font-size: 0.9rem;
    color: var(--text-secondary);
  }

  @media (max-width: 768px) {
    .stats-grid {
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    }

    .stats-table, .history-table {
      font-size: 0.9rem;
    }

    th, td {
      padding: 0.5rem;
    }

    .user-info, .item-info {
      min-width: auto;
    }
  }
</style>
