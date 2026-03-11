<script lang="ts">
  import { onMount } from 'svelte';
  import type { PageData } from './$types';
  import SiteNav from '$lib/SiteNav.svelte';
  import SiteFooter from '$lib/SiteFooter.svelte';
  import { getSeoImageUrl } from '$lib/utils/seoImageUrl';
  import { isAuthenticated } from '$lib/sessionStore';
  import { readRememberedLocation, type RememberedLocation } from '$lib/locationPreferences';

  export let data: PageData;
  let savedLocation: RememberedLocation | null = null;

  const TYPE_ICONS: Record<string, string> = {
    foto: '📷',
    event: '📅',
    firma: '🏢',
    link: '🔗',
    text: '📝',
    video: '🎬',
    musik: '🎵',
    'ki-bild': '✨'
  };

  function itemHref(item: { canonical_path: string | null; slug: string }): string {
    return item.canonical_path || `/item/${item.slug}`;
  }

  function thumbUrl(item: { slug: string; path_512: string | null }): string {
    return getSeoImageUrl(item.slug, item.path_512, '512');
  }

  function truncate(text: string | null | undefined, max: number): string {
    if (!text) return '';
    return text.length > max ? text.slice(0, max).trimEnd() + '...' : text;
  }

  function formatDate(iso: string | null): string {
    if (!iso) return '';
    try {
      return new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
    } catch {
      return '';
    }
  }

  onMount(() => {
    savedLocation = readRememberedLocation();
  });
</script>

<svelte:head>
  <title>Culoca - Entdecke die Welt durch Fotos &amp; GPS-Inhalte</title>
  <meta name="description" content="Entdecke und teile Fotos, Events, Firmen und mehr mit GPS-Standort. Culoca zeigt lokale Inhalte aus deiner Umgebung." />
  <meta name="keywords" content="GPS, Fotos, Events, Firmen, Galerie, lokale Suche, Culoca, Standort, Entdecken" />
  <link rel="canonical" href="https://culoca.com/" />
  <meta name="robots" content="index, follow" />

  <meta property="og:locale" content="de_DE" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="Culoca - Entdecke die Welt durch Fotos & GPS-Inhalte" />
  <meta property="og:description" content="Entdecke und teile Fotos, Events, Firmen und mehr mit GPS-Standort." />
  <meta property="og:url" content="https://culoca.com/" />
  <meta property="og:site_name" content="Culoca" />
  <meta property="og:image" content="https://culoca.com/culoca-logo-512px.png" />
  <meta name="twitter:card" content="summary_large_image" />

  {@html `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Culoca",
    "url": "https://culoca.com",
    "description": "GPS-basierte Plattform zum Entdecken und Teilen von Fotos, Events, Firmen und mehr.",
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://culoca.com/galerie?search={search_term_string}",
      "query-input": "required name=search_term_string"
    }
  })}</script>`}
</svelte:head>

<div class="page">
  <SiteNav />

  <main>
    <!-- Hero -->
    <section class="hero">
      <div class="hero-inner">
        <div class="hero-layout">
          <div class="hero-copy">
            <h1>
              <span class="hero-line">Entdecke die Welt</span>
              <span class="hero-line hero-accent">durch GPS-Inhalte</span>
            </h1>
            <p class="hero-sub">
              Fotos, Events, Firmen und mehr - georeferenziert und aus deiner Umgebung.
              {#if data.totalItems > 0}
                <span class="hero-count">Aktuell {data.totalItems.toLocaleString('de-DE')} Einträge.</span>
              {/if}
            </p>
            <div class="hero-actions">
              <a href="/galerie" class="btn-primary">Galerie öffnen</a>
              <a href="/map-view" class="btn-secondary">Karte anzeigen</a>
              {#if !$isAuthenticated}
                <a href="/login?returnTo=%2F" class="btn-secondary">Login für eigene Inhalte</a>
              {/if}
            </div>
          </div>

          <aside class="hero-side surface-responsive surface-responsive--panel">
            <section class="hero-side-section">
              <span class="hero-side-kicker">Standort</span>
              <h2>{savedLocation?.source === 'gps' ? 'Live-Standort aktiv' : savedLocation ? 'Location manuell gesetzt' : 'Standort freigeben'}</h2>
              <p>
                {#if savedLocation?.source === 'gps'}
                  Culoca nutzt deinen aktuellen Live-Standort und kann Inhalte, Distanzen und Sortierung laufend an deine Position anpassen.
                {:else if savedLocation}
                  Bei einem manuell gesetzten Location Punkt, wird der Standort nicht verändert. Die mobile Galerie kann daher nicht verwendet werden.
                {:else}
                  Ohne Standort bleiben Distanzangaben und nahe Inhalte allgemeiner. Mit Freigabe wird Culoca interaktiver und reagiert auf deine Position.
                {/if}
              </p>

              {#if savedLocation}
                <div class="hero-location-status">
                  <strong>{savedLocation.label || 'Standort gespeichert'}</strong>
                  <span>{savedLocation.lat.toFixed(5)}, {savedLocation.lon.toFixed(5)}</span>
                </div>
              {/if}

              <div class="hero-side-actions">
                <a href="/standort?returnTo=%2F" class="btn-primary hero-wide-btn">
                  {savedLocation ? 'Standortfreigabe ändern' : 'Standort jetzt festlegen'}
                </a>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </section>

    <!-- Content sections per type -->
    {#each data.sections as section (section.typeId)}
      <section class="content-section" id={section.slug}>
        <div class="section-inner">
          <div class="section-head">
            <h2>
              <a href="/{section.slug}">
                <span class="section-icon" aria-hidden="true">{TYPE_ICONS[section.slug] || ''}</span>
                {section.name}
              </a>
            </h2>
            <a href="/{section.slug}" class="see-all">
              Alle {section.totalCount} anzeigen
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M6 3l5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </a>
          </div>

          <div class="items-grid">
            {#each section.items as item (item.id)}
              <article class="item-card">
                <a href={itemHref(item)} class="item-link">
                  {#if item.path_512}
                    <div class="item-thumb">
                      <img
                        src={thumbUrl(item)}
                        alt={item.title || item.slug}
                        width="320"
                        height="213"
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                  {:else}
                    <div class="item-thumb item-thumb--empty">
                      <span class="thumb-icon">{TYPE_ICONS[section.slug] || '📄'}</span>
                    </div>
                  {/if}
                  <div class="item-body">
                    <h3>{item.title || item.slug}</h3>
                    {#if item.description || item.caption}
                      <p class="item-desc">{truncate(item.description || item.caption, 100)}</p>
                    {/if}
                    {#if item.starts_at}
                      <time class="item-date" datetime={item.starts_at}>{formatDate(item.starts_at)}</time>
                    {:else if item.created_at}
                      <time class="item-date" datetime={item.created_at}>{formatDate(item.created_at)}</time>
                    {/if}
                  </div>
                </a>
              </article>
            {/each}
          </div>
        </div>
      </section>
    {/each}
  </main>

  <SiteFooter />
</div>

<style>
  .page {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: var(--bg-primary);
    color: var(--text-primary);
  }

  main {
    flex: 1;
  }

  /* ---- Hero ---- */
  .hero {
    position: relative;
    overflow: hidden;
    background:
      radial-gradient(ellipse 70% 60% at 80% 40%, rgba(238, 114, 33, 0.07) 0%, transparent 100%),
      var(--bg-primary);
  }
  .hero-inner {
    padding: 5rem 2rem 4rem;
  }
  .hero-layout {
    display: grid;
    grid-template-columns: minmax(0, 1.25fr) minmax(320px, 0.75fr);
    gap: 1.5rem;
    align-items: stretch;
  }
  .hero-copy {
    min-width: 0;
  }
  .hero h1 {
    font-size: clamp(2.2rem, 5vw, 3.5rem);
    font-weight: 800;
    line-height: 1.15;
    letter-spacing: -0.025em;
    margin: 0 0 1.25rem;
  }
  .hero-line {
    display: block;
  }
  .hero-accent {
    background: linear-gradient(135deg, var(--culoca-orange) 0%, #f5a623 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .hero-sub {
    max-width: 520px;
    font-size: 1.1rem;
    line-height: 1.6;
    color: var(--text-secondary);
    margin: 0 0 2rem;
  }
  .hero-count {
    white-space: nowrap;
    color: var(--text-muted);
  }
  .hero-actions {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
  }
  .hero-side {
    display: grid;
    gap: 1rem;
    align-self: stretch;
  }
  .hero-side-section {
    display: grid;
    gap: 0.75rem;
  }
  .hero-side-kicker {
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--culoca-orange);
  }
  .hero-side h2 {
    margin: 0;
    font-size: 1.35rem;
    line-height: 1.2;
    color: var(--text-primary);
  }
  .hero-side p {
    margin: 0;
    color: var(--text-secondary);
    line-height: 1.6;
  }
  .hero-side-actions {
    display: grid;
    gap: 0.75rem;
  }
  .hero-wide-btn {
    width: 100%;
    justify-content: center;
  }
  .hero-location-status {
    display: grid;
    gap: 0.2rem;
    padding: 0.85rem 0.95rem;
    border-radius: 14px;
    background: color-mix(in srgb, var(--bg-secondary) 86%, transparent);
    border: 1px solid var(--border-color);
    color: var(--text-secondary);
  }

  .btn-primary,
  .btn-secondary {
    display: inline-flex;
    align-items: center;
    padding: 0.7rem 1.5rem;
    font-size: 0.95rem;
    font-weight: 600;
    border-radius: 10px;
    text-decoration: none;
    transition: transform 0.15s, box-shadow 0.15s, background 0.15s;
  }
  .btn-primary {
    background: var(--culoca-orange);
    color: #fff;
    box-shadow: 0 2px 12px rgba(238, 114, 33, 0.3);
  }
  .btn-primary:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 20px rgba(238, 114, 33, 0.4);
  }
  .btn-secondary {
    background: var(--bg-tertiary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
  }
  .btn-secondary:hover {
    background: var(--border-color);
    transform: translateY(-1px);
  }

  /* ---- Content Sections ---- */
  .content-section {
    border-top: 1px solid var(--border-color);
  }
  .section-inner {
    padding: 2.5rem 2rem;
  }
  .section-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 1.5rem;
    gap: 1rem;
  }
  .section-head h2 {
    font-size: 1.35rem;
    font-weight: 700;
    margin: 0;
  }
  .section-head h2 a {
    color: var(--text-primary);
    text-decoration: none;
    transition: color 0.15s;
  }
  .section-head h2 a:hover {
    color: var(--culoca-orange);
  }
  .section-icon {
    margin-right: 0.4rem;
  }
  .see-all {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--culoca-orange);
    text-decoration: none;
    white-space: nowrap;
    transition: gap 0.15s;
  }
  .see-all:hover {
    gap: 0.5rem;
  }
  .see-all svg {
    flex-shrink: 0;
  }

  /* ---- Items Grid ---- */
  .items-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
  }

  .item-card {
    border-radius: 12px;
    overflow: hidden;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    transition: transform 0.2s, box-shadow 0.2s;
  }
  .item-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.1);
  }

  .item-link {
    display: flex;
    flex-direction: column;
    text-decoration: none;
    color: inherit;
    height: 100%;
  }

  .item-thumb {
    aspect-ratio: 3 / 2;
    overflow: hidden;
    background: var(--bg-tertiary);
  }
  .item-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.3s;
  }
  .item-card:hover .item-thumb img {
    transform: scale(1.04);
  }
  .item-thumb--empty {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .thumb-icon {
    font-size: 2rem;
    opacity: 0.4;
  }

  .item-body {
    padding: 0.75rem 0.85rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    flex: 1;
  }
  .item-body h3 {
    font-size: 0.9rem;
    font-weight: 600;
    line-height: 1.35;
    margin: 0;
    color: var(--text-primary);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .item-desc {
    font-size: 0.8rem;
    line-height: 1.45;
    color: var(--text-muted);
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .item-date {
    font-size: 0.75rem;
    color: var(--text-muted);
    margin-top: auto;
    padding-top: 0.25rem;
  }

  /* ---- Responsive ---- */
  @media (max-width: 960px) {
    .hero-layout {
      grid-template-columns: 1fr;
    }
    .items-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }
  @media (max-width: 680px) {
    .hero-inner {
      padding: 3.5rem 1.25rem 2.5rem;
    }
    .section-inner {
      padding: 2rem 1.25rem;
    }
    .items-grid {
      grid-template-columns: repeat(2, 1fr);
      gap: 0.75rem;
    }
  }
  @media (max-width: 420px) {
    .hero h1 {
      font-size: 1.8rem;
    }
    .hero-sub {
      font-size: 1rem;
    }
    .items-grid {
      grid-template-columns: 1fr;
    }
    .item-link {
      flex-direction: row;
    }
    .item-thumb {
      width: 100px;
      min-height: 80px;
      aspect-ratio: auto;
      flex-shrink: 0;
    }
    .item-body {
      padding: 0.6rem 0.75rem;
    }
  }
</style>
