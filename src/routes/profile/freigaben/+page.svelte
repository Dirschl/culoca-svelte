<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import SiteNav from '$lib/SiteNav.svelte';
  import ProfileRightsManager from '$lib/ProfileRightsManager.svelte';
  import { supabase } from '$lib/supabaseClient';

  let user: any = null;
  let loading = true;

  const useCases = [
    {
      title: 'Kunden mit pauschaler Nutzung',
      text: 'Ideal fuer Kunden, die pauschal abrechnen und alle Items deines Profils ohne Einzelfreigaben herunterladen oder weiterverwenden duerfen.'
    },
    {
      title: 'Kollegen fuer Redaktion und Pflege',
      text: 'Geeignet fuer Teammitglieder, die deine gesamten Eintraege laufend ueberarbeiten, ergaenzen oder bei Bedarf auch entfernen sollen.'
    },
    {
      title: 'Einzelrechte pro Item bleiben moeglich',
      text: 'Wenn Rechte nur punktuell fuer bestimmte Eintraege gelten sollen, vergib sie direkt am jeweiligen Item anstatt hier profilweit.'
    }
  ];

  const rightsLegend = [
    { label: 'Download', text: 'Erlaubt die Nutzung und das Herunterladen aller Items dieses Profils.' },
    { label: 'Bearbeiten', text: 'Erlaubt Aenderungen an Titeln, Beschreibungen, Metadaten und weiteren Inhalten.' },
    { label: 'Loeschen', text: 'Erlaubt das Entfernen von Eintraegen aus deinem Profil. Dieses Recht nur sehr gezielt vergeben.' }
  ];

  onMount(async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) {
      goto('/');
      return;
    }

    user = currentUser;
    loading = false;
  });
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
    <main class="rights-main">
      <section class="hero">
        <div class="hero-copy">
          <span class="eyebrow">Profilweite Rechte</span>
          <h1>Freigaben fuer dein gesamtes Profil klar und zentral steuern</h1>
          <p class="hero-text">
            Diese Freigaben gelten nicht nur fuer Fotos, sondern fuer alle Items deines Profils. Sie sind fuer Situationen gedacht, in denen Personen dauerhaft und umfassend mit deinem gesamten Bestand arbeiten duerfen.
          </p>
          <div class="hero-note">
            Einzelne Rechte direkt an einem Item bleiben weiterhin moeglich, wenn du nur gezielt Eintraege fuer Dritte freigeben willst.
          </div>
        </div>

        <div class="hero-panel">
          <div class="panel-card panel-card--primary">
            <h2>Typische Einsaetze</h2>
            <div class="use-case-list">
              {#each useCases as useCase}
                <article class="use-case">
                  <h3>{useCase.title}</h3>
                  <p>{useCase.text}</p>
                </article>
              {/each}
            </div>
          </div>
        </div>
      </section>

      <section class="content-grid">
        <aside class="sidebar">
          <div class="sidebar-card">
            <h2>Was jedes Recht bedeutet</h2>
            <div class="legend-list">
              {#each rightsLegend as right}
                <div class="legend-item">
                  <span class="legend-badge">{right.label}</span>
                  <p>{right.text}</p>
                </div>
              {/each}
            </div>
          </div>

          <div class="sidebar-card sidebar-card--warning">
            <h2>Hinweis</h2>
            <p>
              Vergib profilweite Rechte nur an Personen, denen du dauerhaft vertraust. Eine Freigabe wirkt auf deinen kompletten Bestand und ist bewusst fuer langfristige Zusammenarbeit gedacht.
            </p>
          </div>
        </aside>

        <section class="manager-shell">
          <div class="manager-header">
            <h2>Freigaben verwalten</h2>
            <p>Suche Benutzer, vergebe profilweite Rechte und passe bestehende Freigaben jederzeit an.</p>
          </div>

          <div class="manager-card">
            {#if user}
              <ProfileRightsManager profileId={user.id} />
            {/if}
          </div>
        </section>
      </section>
    </main>
  {/if}
</div>

<style>
  .rights-page {
    min-height: 100vh;
    background:
      radial-gradient(circle at top right, rgba(238, 114, 33, 0.16), transparent 28%),
      linear-gradient(180deg, color-mix(in srgb, var(--bg-primary) 92%, #0d1724 8%) 0%, var(--bg-primary) 28rem);
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

  .rights-main {
    padding: 0 2rem 4rem;
  }

  .hero,
  .content-grid {
    max-width: 1440px;
    margin: 0 auto;
  }

  .hero {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr);
    gap: 1.5rem;
    padding: 3rem 0 2rem;
    align-items: stretch;
  }

  .hero-copy,
  .panel-card,
  .sidebar-card,
  .manager-card {
    background: color-mix(in srgb, var(--bg-secondary) 88%, transparent);
    border: 1px solid color-mix(in srgb, var(--border-color) 80%, white 8%);
    box-shadow: 0 18px 60px rgba(0, 0, 0, 0.12);
    backdrop-filter: blur(18px);
  }

  .hero-copy {
    border-radius: 28px;
    padding: 2.5rem;
  }

  .eyebrow {
    display: inline-flex;
    align-items: center;
    padding: 0.4rem 0.75rem;
    border-radius: 999px;
    background: rgba(238, 114, 33, 0.14);
    color: var(--culoca-orange);
    font-size: 0.82rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  h1 {
    margin: 1rem 0;
    font-size: clamp(2.4rem, 5vw, 4.2rem);
    line-height: 1.02;
    letter-spacing: -0.04em;
    max-width: 12ch;
  }

  .hero-text {
    max-width: 62ch;
    font-size: 1.08rem;
    line-height: 1.75;
    color: var(--text-secondary);
    margin: 0;
  }

  .hero-note {
    margin-top: 1.5rem;
    padding: 1rem 1.1rem;
    border-left: 3px solid var(--culoca-orange);
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.04);
    color: var(--text-primary);
    max-width: 60ch;
  }

  .hero-panel {
    display: flex;
  }

  .panel-card {
    border-radius: 28px;
    padding: 1.5rem;
    width: 100%;
  }

  .panel-card--primary {
    background:
      linear-gradient(180deg, rgba(238, 114, 33, 0.12), transparent 32%),
      color-mix(in srgb, var(--bg-secondary) 88%, transparent);
  }

  .panel-card h2,
  .sidebar-card h2,
  .manager-header h2 {
    margin: 0 0 1rem;
    font-size: 1.15rem;
  }

  .use-case-list,
  .legend-list {
    display: grid;
    gap: 0.9rem;
  }

  .use-case {
    padding: 1rem 1rem 1.05rem;
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .use-case h3 {
    margin: 0 0 0.45rem;
    font-size: 1rem;
  }

  .use-case p,
  .legend-item p,
  .sidebar-card p,
  .manager-header p {
    margin: 0;
    line-height: 1.65;
    color: var(--text-secondary);
  }

  .content-grid {
    display: grid;
    grid-template-columns: minmax(300px, 380px) minmax(0, 1fr);
    gap: 1.5rem;
    align-items: start;
  }

  .sidebar {
    display: grid;
    gap: 1.5rem;
    position: sticky;
    top: 88px;
  }

  .sidebar-card {
    padding: 1.5rem;
    border-radius: 24px;
  }

  .sidebar-card--warning {
    background:
      linear-gradient(180deg, rgba(238, 114, 33, 0.08), transparent 80%),
      color-mix(in srgb, var(--bg-secondary) 88%, transparent);
  }

  .legend-item {
    padding: 1rem;
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.03);
  }

  .legend-badge {
    display: inline-flex;
    margin-bottom: 0.6rem;
    padding: 0.35rem 0.6rem;
    border-radius: 999px;
    background: rgba(238, 114, 33, 0.12);
    color: var(--culoca-orange);
    font-size: 0.78rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .manager-shell {
    min-width: 0;
  }

  .manager-header {
    margin-bottom: 1rem;
    padding: 0.25rem 0.25rem 0 0.25rem;
  }

  .manager-card {
    border-radius: 30px;
    padding: 0.75rem;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  @media (max-width: 1100px) {
    .hero,
    .content-grid {
      grid-template-columns: 1fr;
    }

    .sidebar {
      position: static;
    }
  }

  @media (max-width: 720px) {
    .rights-main {
      padding: 0 1rem 3rem;
    }

    .hero {
      padding-top: 1.5rem;
    }

    .hero-copy,
    .panel-card,
    .sidebar-card,
    .manager-card {
      border-radius: 22px;
    }

    .hero-copy {
      padding: 1.5rem;
    }

    h1 {
      max-width: none;
      font-size: clamp(2rem, 11vw, 3rem);
    }
  }
</style>
