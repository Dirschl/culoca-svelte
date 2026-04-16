<script lang="ts">
  import SiteNav from '$lib/SiteNav.svelte';
  import SiteFooter from '$lib/SiteFooter.svelte';
  import { FOTO_SEARCH_LANDING_PATH } from '$lib/content/routing';
  import { absoluteUrl, buildBreadcrumbJsonLd, DEFAULT_OG_IMAGE, trimText } from '$lib/seo/site';
  import type { PageData } from './$types';

  export let data: PageData;

  const canonicalUrl = absoluteUrl(data.seoPolicy.canonicalPath);
  const pageTitle = 'Region: Land wählen | Culoca';
  const metaDescription = trimText(
    'Einstieg in die geografische Verzeichnisstruktur: zuerst nur das Land, danach Bundesland, Region und Gemeinde. Alle öffentlichen Inhalte pro Ebene.'
  );
</script>

<svelte:head>
  <title>{pageTitle}</title>
  <meta name="description" content={metaDescription} />
  <link rel="canonical" href={canonicalUrl} />
  <meta name="robots" content={data.seoPolicy.robots} />
  <meta property="og:type" content="website" />
  <meta property="og:title" content={pageTitle} />
  <meta property="og:description" content={metaDescription} />
  <meta property="og:url" content={canonicalUrl} />
  <meta property="og:image" content={DEFAULT_OG_IMAGE} />
  <meta name="twitter:card" content="summary_large_image" />
  {@html `<script type="application/ld+json">${JSON.stringify(
    buildBreadcrumbJsonLd([
      { name: 'Culoca', path: '/' },
      { name: 'Region', path: data.seoPolicy.canonicalPath }
    ])
  )}</script>`}
</svelte:head>

<div class="page">
  <SiteNav />
  <main>
    <header class="region-header">
      <div class="region-inner">
        <nav class="breadcrumb" aria-label="Breadcrumb">
          <a href="/">Culoca</a>
          <span>/</span>
          <span>Region</span>
        </nav>
        <p class="region-kicker">Geografischer Einstieg</p>
        <h1>Region: Land wählen</h1>
        <p class="region-lead">
          Schritt 1: nur das Land. Anschließend öffnet sich pro Land zuerst die Bundesland-Ebene, dann jeweils nur die
          nächste Unterebene (Region, Landkreis, Gemeinde). Alle öffentlichen Items — ohne Typfilter. Für Suche, Varianten
          und Upload: <a href={FOTO_SEARCH_LANDING_PATH}>/foto</a>.
        </p>

        {#if data.countryOptions?.length}
          <section class="country-section" aria-labelledby="country-heading">
            <h2 id="country-heading">Länder</h2>
            <p class="country-hint">Nächster Schritt: z. B. <strong>/region/de</strong> für Deutschland.</p>
            <div class="country-grid">
              {#each data.countryOptions as country}
                <a href={country.path} class="country-card">
                  <span class="country-card__label">{country.label}</span>
                  <span class="country-card__count" aria-label={`${country.count.toLocaleString('de-DE')} Inhalte`}>
                    {country.count.toLocaleString('de-DE')}
                  </span>
                </a>
              {/each}
            </div>
          </section>
        {:else}
          <p class="empty">Noch keine regionalen Einträge.</p>
        {/if}
      </div>
    </header>
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
  .region-header {
    border-bottom: 1px solid var(--border-color);
    background:
      radial-gradient(ellipse 55% 70% at 75% 25%, rgba(238, 114, 33, 0.07) 0%, transparent 100%),
      var(--bg-primary);
  }
  .region-inner {
    padding: 2rem;
  }
  .breadcrumb {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    font-size: 0.85rem;
    color: var(--text-muted);
    margin-bottom: 0.75rem;
  }
  .breadcrumb a {
    color: var(--text-muted);
    text-decoration: none;
  }
  .breadcrumb a:hover {
    color: var(--culoca-orange);
  }
  .region-kicker {
    margin: 0 0 0.35rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--culoca-orange);
    font-size: 0.82rem;
    font-weight: 700;
  }
  .region-header h1 {
    margin: 0 0 0.6rem;
    font-size: clamp(1.75rem, 3vw, 2.5rem);
    line-height: 1.08;
  }
  .region-lead {
    margin: 0 0 1.75rem;
    max-width: 40rem;
    color: var(--text-secondary);
    line-height: 1.6;
  }
  .region-lead a {
    color: var(--culoca-orange);
    font-weight: 600;
  }
  .country-section h2 {
    margin: 0 0 0.35rem;
    font-size: 1.25rem;
  }
  .country-hint {
    margin: 0 0 1rem;
    color: var(--text-muted);
    font-size: 0.92rem;
  }
  .country-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 0.85rem;
  }
  .country-card {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 1rem 1.1rem;
    border-radius: 1rem;
    border: 1px solid var(--border-color);
    background: var(--bg-secondary);
    text-decoration: none;
    color: var(--text-primary);
    transition: transform 0.16s ease, border-color 0.16s ease;
  }
  .country-card:hover {
    transform: translateY(-2px);
    border-color: rgba(238, 114, 33, 0.45);
  }
  .country-card__label {
    font-weight: 700;
    font-size: 1.05rem;
  }
  .country-card__count {
    color: var(--text-secondary);
    font-size: 0.9rem;
  }
  .empty {
    color: var(--text-muted);
    padding: 2rem 0;
  }
  @media (max-width: 680px) {
    .region-inner {
      padding: 1.25rem;
    }
  }
</style>
