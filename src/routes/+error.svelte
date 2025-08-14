<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  export let error: any = null;
  export let status: number = 404;

  onMount(() => {
    // Bei 404 zur Web-Seite weiterleiten
    if (status === 404) {
      setTimeout(() => {
        goto('/web');
      }, 3000); // 3 Sekunden warten
    }
    // Bei 410 (Gone) - keine automatische Weiterleitung, da URL permanent weg ist
  });
</script>

<svelte:head>
  <title>{status === 410 ? 'URL nicht mehr verfügbar - Culoca' : 'Seite nicht gefunden - Culoca'}</title>
  <meta name="robots" content="noindex, nofollow" />
  {#if status === 410}
    <meta name="googlebot" content="noindex, nofollow" />
    <meta name="bingbot" content="noindex, nofollow" />
  {/if}
</svelte:head>

<div class="error-page">
  <div class="error-content">
    {#if status === 410}
      <h1>410 - URL nicht mehr verfügbar</h1>
      <p>
        Diese URL existiert nicht mehr aufgrund von Korrekturen in der Schreibweise von Ortsnamen.
        Die Seite wurde dauerhaft entfernt.
      </p>
      {#if error?.slug}
        <p><strong>Betroffener Slug:</strong> {error.slug}</p>
      {/if}
    {:else}
      <h1>404 - Seite nicht gefunden</h1>
      <p>
        Die angeforderte Seite existiert nicht oder wurde verschoben. 
        Du wirst in 3 Sekunden zur System-Übersicht weitergeleitet.
      </p>
    {/if}
    
    <div class="error-actions">
      <a href="/" class="btn primary">Zurück zur Galerie</a>
      <a href="/system" class="btn secondary">System-Übersicht</a>
    </div>

    <div class="error-details">
      <p><strong>Angeforderte URL:</strong> {$page.url.pathname}</p>
      {#if error?.message}
        <p><strong>Fehler:</strong> {error.message}</p>
      {/if}
    </div>
  </div>
</div>

<style>
  .error-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    background: var(--bg-primary);
  }

  .error-content {
    max-width: 600px;
    text-align: center;
    background: var(--bg-secondary);
    padding: 3rem;
    border-radius: 12px;
    box-shadow: 0 4px 20px var(--shadow);
  }

  .error-content h1 {
    font-size: 2.5rem;
    margin: 0 0 1rem 0;
    color: var(--text-primary);
  }

  .error-content p {
    font-size: 1.1rem;
    color: var(--text-secondary);
    line-height: 1.6;
    margin: 0 0 2rem 0;
  }

  .error-actions {
    display: flex;
    gap: 1rem;
    justify-content: center;
    margin-bottom: 2rem;
  }

  .btn {
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    text-decoration: none;
    font-weight: 500;
    transition: all 0.2s ease;
  }

  .btn.primary {
    background: var(--accent-color);
    color: white;
  }

  .btn.primary:hover {
    background: var(--accent-hover);
  }

  .btn.secondary {
    background: var(--bg-tertiary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }

  .btn.secondary:hover {
    background: var(--bg-primary);
  }

  .error-details {
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 1rem;
    text-align: left;
  }

  .error-details p {
    margin: 0.5rem 0;
    font-size: 0.9rem;
    color: var(--text-secondary);
  }

  @media (max-width: 768px) {
    .error-content {
      padding: 2rem;
    }

    .error-content h1 {
      font-size: 2rem;
    }

    .error-actions {
      flex-direction: column;
    }
  }
</style> 