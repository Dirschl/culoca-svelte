<script lang="ts">
  import SiteNav from '$lib/SiteNav.svelte';
  import SiteFooter from '$lib/SiteFooter.svelte';
  import { getSeoImageUrl } from '$lib/utils/seoImageUrl';
  import { appendReturnTo } from '$lib/content/routing';
  import { absoluteUrl, buildBreadcrumbJsonLd, DEFAULT_OG_IMAGE, trimText } from '$lib/seo/site';

  export let data: any;

  const canonicalUrl = absoluteUrl(data.seoPolicy.canonicalPath);
  const creatorName = data.profile.full_name || data.profile.accountname;
  const pageTitle =
    data.page > 1
      ? `${creatorName}: Seite ${data.page} | Culoca`
      : `${creatorName} auf Culoca`;
  const metaDescription = trimText(
    data.profile.bio || `${creatorName} zeigt ${data.totalCount} öffentliche Inhalte auf Culoca. Galerie mit Bildern, Themen und Detailseiten.`
  );

  function itemHref(item: { canonical_path: string | null; slug: string }) {
    return appendReturnTo(item.canonical_path || `/item/${item.slug}`, data.hubPath);
  }
</script>

<svelte:head>
  <title>{pageTitle}</title>
  <meta name="description" content={metaDescription} />
  <link rel="canonical" href={canonicalUrl} />
  <meta name="robots" content={data.seoPolicy.robots} />
  <meta property="og:type" content="profile" />
  <meta property="og:title" content={pageTitle} />
  <meta property="og:description" content={metaDescription} />
  <meta property="og:url" content={canonicalUrl} />
  <meta property="og:image" content={DEFAULT_OG_IMAGE} />
  <meta name="twitter:card" content="summary_large_image" />
  {@html `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      buildBreadcrumbJsonLd([
        { name: 'Culoca', path: '/' },
        { name: creatorName, path: data.seoPolicy.canonicalPath }
      ]),
      {
        "@type": "Person",
        "name": creatorName,
        ...(data.profile.website ? { "url": data.profile.website } : {}),
        ...(data.profile.avatar_url ? { "image": data.profile.avatar_url } : {})
      }
    ]
  })}</script>`}
</svelte:head>

<div class="page">
  <SiteNav />
  <main class="hub-page">
    <div class="hub-inner">
      <nav class="breadcrumb" aria-label="Breadcrumb">
        <a href="/">Culoca</a>
        <span>/</span>
        <span>{creatorName}</span>
      </nav>
      <header class="hub-header">
        <p class="hub-kicker">Profil</p>
        <h1>{creatorName}</h1>
        <p class="hub-copy">
          {metaDescription}
        </p>
      </header>
      <div class="items-grid">
        {#each data.items as item (item.id)}
          <article class="item-card">
            <a href={itemHref(item)}>
              {#if item.path_512}
                <img
                  src={getSeoImageUrl(item.slug, item.path_512, '512')}
                  alt={item.title || creatorName}
                  loading="lazy"
                  decoding="async"
                  width="320"
                  height="213"
                />
              {/if}
              <h2>{item.title || item.slug}</h2>
              <p>{trimText(item.description || item.caption || `Mehr Inhalte von ${creatorName}.`, 110)}</p>
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
