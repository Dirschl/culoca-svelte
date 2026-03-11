<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import SiteNav from '$lib/SiteNav.svelte';
  import ProfileRightsManager from '$lib/ProfileRightsManager.svelte';
  import { supabase } from '$lib/supabaseClient';
  import { sanitizeReturnTo } from '$lib/returnTo';

  let user: any = null;
  let loading = true;
  let returnTo = '/';

  onMount(async () => {
    returnTo = sanitizeReturnTo($page.url.searchParams.get('returnTo'), getReferrerFallback());

    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) {
      goto('/');
      return;
    }

    user = currentUser;
    loading = false;
  });

  function getReferrerFallback() {
    if (typeof window === 'undefined' || !document.referrer) return '/profile';

    try {
      const referrerUrl = new URL(document.referrer);
      if (referrerUrl.origin !== window.location.origin) return '/profile';
      if (referrerUrl.pathname === $page.url.pathname) return '/profile';
      return sanitizeReturnTo(`${referrerUrl.pathname}${referrerUrl.search}${referrerUrl.hash}`, '/profile');
    } catch {
      return '/profile';
    }
  }
</script>

<svelte:head>
  <title>Freigaben - Culoca</title>
  <meta name="robots" content="noindex, nofollow, noarchive, nosnippet, noimageindex" />
  <meta name="googlebot" content="noindex, nofollow" />
  <meta name="bingbot" content="noindex, nofollow" />
</svelte:head>

<div class="rights-page">
  <SiteNav />

  {#if loading}
    <div class="loading-container">
      <div class="spinner"></div>
      <span>Lade Freigaben...</span>
    </div>
  {:else}
    <div class="rights-container">
      <header class="header">
        <div>
          <h1>Freigaben</h1>
          <p class="subtitle">Verwalte zentrale Berechtigungen fuer andere Benutzer auf all deine Bilder.</p>
        </div>
        <a class="profile-link" href={`/profile?returnTo=${encodeURIComponent(returnTo)}`}>Profil bearbeiten</a>
      </header>

      <section class="intro-card">
        <h2>Was diese Freigaben bedeuten</h2>
        <p>
          Freigaben gelten profilweit. Wenn du hier einer Person Rechte gibst, gelten diese Rechte fuer alle Bilder, die deinem Profil zugeordnet sind.
        </p>
        <p>
          <strong>Download</strong> erlaubt das Herunterladen deiner Bilder. <strong>Bearbeiten</strong> erlaubt Aenderungen an Metadaten und Inhalten. <strong>Loeschen</strong> erlaubt das Entfernen deiner Bilder.
        </p>
        <p>
          Vergib diese Rechte nur an Personen, denen du dauerhaft vertraust. Aendere oder entferne Freigaben sofort, wenn sich Zusammenarbeit oder Verantwortlichkeiten aendern.
        </p>
      </section>

      <section class="manager-card">
        {#if user}
          <ProfileRightsManager profileId={user.id} />
        {/if}
      </section>
    </div>
  {/if}
</div>

<style>
  .rights-page {
    min-height: 100vh;
    background: var(--bg-primary);
    color: var(--text-primary);
  }

  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
    gap: 1rem;
    color: var(--text-secondary);
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--border-color);
    border-top: 3px solid var(--accent-color);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .rights-container {
    max-width: 960px;
    margin: 0 auto;
    padding: 2rem 1rem 3rem;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  h1 {
    margin: 0;
    font-size: 2rem;
  }

  h2 {
    margin-top: 0;
    font-size: 1.25rem;
  }

  .subtitle {
    margin: 0.5rem 0 0;
    color: var(--text-secondary);
  }

  .profile-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.8rem 1rem;
    border-radius: 8px;
    text-decoration: none;
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    white-space: nowrap;
  }

  .intro-card,
  .manager-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    box-shadow: 0 2px 8px var(--shadow);
  }

  .intro-card {
    padding: 1.5rem;
    margin-bottom: 1.5rem;
  }

  .intro-card p {
    margin: 0 0 1rem;
    color: var(--text-secondary);
    line-height: 1.6;
  }

  .intro-card p:last-child {
    margin-bottom: 0;
  }

  .manager-card {
    padding: 0.5rem;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  @media (max-width: 640px) {
    .header {
      flex-direction: column;
      align-items: stretch;
    }

    .profile-link {
      width: 100%;
    }
  }
</style>
