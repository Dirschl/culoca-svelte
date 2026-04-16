<script lang="ts">
  import SiteNav from '$lib/SiteNav.svelte';
  import SiteFooter from '$lib/SiteFooter.svelte';
  import { getSeoImageUrl } from '$lib/utils/seoImageUrl';
  import { appendReturnTo, FOTO_SEARCH_LANDING_PATH, getPublicItemHref } from '$lib/content/routing';
  import { absoluteUrl, buildBreadcrumbJsonLd, DEFAULT_OG_IMAGE, trimText } from '$lib/seo/site';

  export let data: any;

  const canonicalUrl = absoluteUrl(data.seoPolicy.canonicalPath);
  const pageTitle =
    data.page > 1
      ? `${data.hubLabel}: Seite ${data.page} | Culoca`
      : `${data.hubLabel}: Fotos, Motive und Inhalte | Culoca`;
  const metaDescription = trimText(
    `Entdecke ${data.totalCount} öffentliche Inhalte zum Thema ${data.hubLabel} auf Culoca. Redaktionelle Hub-Seite mit thematisch passenden Bildern und Detailseiten.`
  );

  function itemHref(item: {
    slug: string;
    canonical_path?: string | null;
    country_slug?: string | null;
    state_slug?: string | null;
    region_slug?: string | null;
    district_slug?: string | null;
    municipality_slug?: string | null;
  }) {
    return appendReturnTo(getPublicItemHref(item), data.hubPath);
  }

  function pageUrl(page: number) {
    return page > 1 ? `${data.hubPath}?seite=${page}` : data.hubPath;
  }
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
  {@html `<script type="application/ld+json">${JSON.stringify(buildBreadcrumbJsonLd([
    { name: 'Culoca', path: '/' },
    { name: 'Schlagworte', path: FOTO_SEARCH_LANDING_PATH },
    { name: data.hubLabel, path: data.seoPolicy.canonicalPath }
  ]))}</script>`}
</svelte:head>

<div class="page">
  <SiteNav />
  <main class="hub-page">
    <div class="hub-inner">
      <nav class="breadcrumb" aria-label="Breadcrumb">
        <a href="/">Culoca</a>
        <span>/</span>
        <a href={FOTO_SEARCH_LANDING_PATH}>Fotos</a>
        <span>/</span>
        <span>{data.hubLabel}</span>
      </nav>
      <header class="hub-header">
        <p class="hub-kicker">Schlagwort-Hub</p>
        <h1>{data.hubLabel}</h1>
        <p class="hub-copy">
          Diese Seite bündelt redaktionell alle aktuell öffentlichen Inhalte mit dem Schlagwort
          <strong>{data.hubLabel}</strong>. So entstehen stabile interne Hubs statt verstreuter Filter-URLs.
        </p>
      </header>

      <div class="items-grid">
        {#each data.items as item (item.id)}
          <article class="item-card">
            <a href={itemHref(item)}>
              {#if item.path_512}
                <img
                  src={getSeoImageUrl(item.slug, item.path_512, '512')}
                  alt={item.title || data.hubLabel}
                  loading="lazy"
                  decoding="async"
                  width="320"
                  height="213"
                />
              {/if}
              <h2>{item.title || item.slug}</h2>
              <p>{trimText(item.description || item.caption || `Mehr Inhalte zum Thema ${data.hubLabel}.`, 110)}</p>
            </a>
          </article>
        {/each}
      </div>
    </div>
  </main>
  <SiteFooter />
</div>

<style>
  .hub-page { padding: 2rem 1rem 4rem; }
  .hub-inner { max-width: 1100px; margin: 0 auto; }
  .breadcrumb { display: flex; gap: 0.45rem; flex-wrap: wrap; margin-bottom: 1rem; color: var(--text-secondary); }
  .hub-header { margin-bottom: 1.5rem; }
  .hub-kicker { text-transform: uppercase; letter-spacing: 0.08em; color: var(--accent-color); font-size: 0.85rem; }
  .hub-copy { max-width: 70ch; }
  .items-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; }
  .item-card a { display: block; color: inherit; text-decoration: none; }
  .item-card img { width: 100%; height: auto; border-radius: 12px; margin-bottom: 0.75rem; background: var(--bg-secondary); }
</style>
