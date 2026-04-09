<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import SiteNav from '$lib/SiteNav.svelte';
  import SiteFooter from '$lib/SiteFooter.svelte';
  import { getSeoImageUrl } from '$lib/utils/seoImageUrl';
  import { appendReturnTo } from '$lib/content/routing';
  import { getEffectiveGpsPosition } from '$lib/filterStore';
  import {
    absoluteUrl,
    buildBreadcrumbJsonLd,
    buildGeoCollectionPageJsonLd,
    buildGeoPlaceGraph,
    DEFAULT_OG_IMAGE,
    trimText
  } from '$lib/seo/site';

  type HubItem = {
    id: string;
    slug: string;
    title: string | null;
    description: string | null;
    caption: string | null;
    canonical_path: string | null;
    path_512: string | null;
    lat?: number | null;
    lon?: number | null;
    child_count?: number;
    variants?: Array<{ slug: string; path_512: string | null }>;
    distance?: number | null;
  };

  export let data: any;

  const canonicalUrl = absoluteUrl(data.seoPolicy.canonicalPath);
  const pageTitle =
    data.seoTitle ||
    (data.page > 1
      ? `${data.hubLabel}: Seite ${data.page} | Culoca`
      : `${data.hubLabel}: Orte, Motive und Inhalte | Culoca`);
  const metaDescription = trimText(
    data.metaDescription ||
      `Entdecke ${data.totalCount} öffentliche Inhalte zu ${data.hubLabel} auf Culoca. Ortsbezogene Hub-Seite mit Bildern, Themen und Detailseiten.`
  );
  const geoPlaceGraph = buildGeoPlaceGraph({
    currentPath: data.hubPath,
    currentName: data.hubLabel,
    countryName: data.countryName,
    countryPath: data.countryPath,
    stateName: data.stateName,
    statePath: data.statePath,
    regionName: data.regionName,
    regionPath: data.regionPath,
    districtName: data.districtName,
    districtPath: data.districtPath,
    municipalityName: data.municipalityName,
    municipalityPath: data.municipalityPath
  });
  const hubCollectionJsonLd = buildGeoCollectionPageJsonLd({
    path: data.hubPath,
    name: pageTitle,
    description: metaDescription,
    breadcrumbPath: data.hubPath,
    placeId: geoPlaceGraph.currentPlaceId
  });

  function itemHref(item: { canonical_path: string | null; slug: string }) {
    return appendReturnTo(item.canonical_path || `/item/${item.slug}`, data.hubPath);
  }

  function thumbUrl(item: { slug: string; path_512: string | null }) {
    return getSeoImageUrl(item.slug, item.path_512, '512');
  }

  function pageUrl(page: number): string {
    if (page <= 1) return data.hubPath;
    return `${data.hubPath}?seite=${page}`;
  }

  function truncate(text: string | null | undefined, maxLength = 120) {
    return trimText(text || '', maxLength);
  }

  const geoTrail = (data.breadcrumbs || []).filter((crumb: { path: string }) => crumb.path !== '/');

  let currentGpsPosition: { lat: number; lon: number } | null = browser ? getStoredGpsPosition() : null;
  let variantImageIndexes: Record<string, number> = {};
  let animatedPreviewUrls: Record<string, string> = {};
  let variantTimer: ReturnType<typeof setInterval> | null = null;
  let lastRotationKey = '';
  let previewImageElements: Record<string, HTMLImageElement | null> = {};
  let previewThumbElements: Record<string, HTMLDivElement | null> = {};

  function getStoredGpsPosition(): { lat: number; lon: number } | null {
    if (typeof window === 'undefined') return null;
    const directLat = Number(localStorage.getItem('userLat'));
    const directLon = Number(localStorage.getItem('userLon'));
    if (Number.isFinite(directLat) && Number.isFinite(directLon) && (directLat !== 0 || directLon !== 0)) {
      return { lat: directLat, lon: directLon };
    }
    const effectiveGps = getEffectiveGpsPosition();
    if (effectiveGps && Number.isFinite(effectiveGps.lat) && Number.isFinite(effectiveGps.lon)) {
      return { lat: effectiveGps.lat, lon: effectiveGps.lon };
    }
    try {
      const raw = localStorage.getItem('culoca-filters');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const lat = Number(parsed?.lastGpsPosition?.lat);
      const lon = Number(parsed?.lastGpsPosition?.lon);
      if (Number.isFinite(lat) && Number.isFinite(lon) && (lat !== 0 || lon !== 0)) return { lat, lon };
    } catch {
      return null;
    }
    return null;
  }

  function getDistanceInMeters(userLat: number, userLon: number, itemLat: number, itemLon: number): number {
    const R = 6371000;
    const lat1 = (userLat * Math.PI) / 180;
    const lat2 = (itemLat * Math.PI) / 180;
    const dLat = ((itemLat - userLat) * Math.PI) / 180;
    const dLon = ((itemLon - userLon) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function formatDistance(distance: number | null | undefined): string {
    if (distance == null || Number.isNaN(distance)) return '';
    if (distance < 1000) return `${Math.round(distance)}m`;
    return `${(distance / 1000).toFixed(1)}km`;
  }

  $: displayedItems = (() => {
    const items = (data.items || []) as HubItem[];
    const gps = currentGpsPosition;
    if (!gps) return items;
    return items.map((item) => {
      const lat = Number(item.lat);
      const lon = Number(item.lon);
      const hasCoords = Number.isFinite(lat) && Number.isFinite(lon);
      const distance = hasCoords ? getDistanceInMeters(gps.lat, gps.lon, lat, lon) : null;
      return { ...item, lat: hasCoords ? lat : item.lat, lon: hasCoords ? lon : item.lon, distance };
    });
  })();

  $: hasDistanceData = displayedItems.some((i: HubItem) => i?.distance != null);

  function variantThumbUrls(item: HubItem): string[] {
    const variants = Array.isArray(item.variants) ? item.variants : [];
    const rootUrl = thumbUrl(item);
    return variants
      .filter((v) => v?.slug && v?.path_512)
      .map((v) => getSeoImageUrl(v.slug, v.path_512, '512'))
      .filter((url): url is string => Boolean(url) && url !== rootUrl);
  }

  function rotationThumbUrls(item: HubItem): string[] {
    const rootUrl = thumbUrl(item);
    const variantUrls = variantThumbUrls(item);
    return variantUrls.length ? [rootUrl, ...variantUrls] : [rootUrl];
  }

  function currentThumbUrl(item: HubItem): string {
    return animatedPreviewUrls[item.id] ?? thumbUrl(item);
  }

  function applyPreviewUrl(itemId: string, url: string) {
    const imageEl = previewImageElements[itemId];
    if (imageEl && imageEl.src !== url) imageEl.src = url;
    const thumbEl = previewThumbElements[itemId];
    if (thumbEl) thumbEl.style.setProperty('--thumb-preview', `url('${url}')`);
  }

  function preloadVariantImages() {
    if (typeof window === 'undefined') return;
    for (const item of displayedItems) {
      for (const url of rotationThumbUrls(item).slice(1)) {
        const img = new Image();
        img.decoding = 'async';
        img.src = url;
      }
    }
  }

  function startVariantRotation() {
    variantTimer = setInterval(() => {
      const nextUrls: Record<string, string> = {};
      const nextIndexes = { ...variantImageIndexes };
      for (const item of displayedItems) {
        const urls = rotationThumbUrls(item);
        if (urls.length <= 1) continue;
        const nextIndex = ((nextIndexes[item.id] ?? 0) + 1) % urls.length;
        nextIndexes[item.id] = nextIndex;
        nextUrls[item.id] = urls[nextIndex];
        applyPreviewUrl(item.id, urls[nextIndex]);
      }
      variantImageIndexes = nextIndexes;
      animatedPreviewUrls = nextUrls;
    }, 2800);
  }

  function refreshVariantRotation() {
    if (typeof window === 'undefined') return;
    const nextKey = displayedItems.map((i) => `${i.id}:${i.child_count ?? 0}`).join('|');
    if (nextKey === lastRotationKey) return;
    lastRotationKey = nextKey;
    if (variantTimer) {
      clearInterval(variantTimer);
      variantTimer = null;
    }
    animatedPreviewUrls = {};
    variantImageIndexes = {};
    const hasVariants = displayedItems.some((item) => variantThumbUrls(item).length > 0);
    if (!hasVariants) return;
    preloadVariantImages();
    startVariantRotation();
  }

  $: if (displayedItems.length > 0) refreshVariantRotation();

  onMount(() => {
    currentGpsPosition = getStoredGpsPosition();
    const hasVariants = displayedItems.some((item) => variantThumbUrls(item).length > 0);
    if (hasVariants) {
      preloadVariantImages();
      startVariantRotation();
    }
  });

  onDestroy(() => {
    if (variantTimer) clearInterval(variantTimer);
  });
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

  {#if data.page > 1}
    <link rel="prev" href={absoluteUrl(pageUrl(data.page - 1))} />
  {/if}
  {#if data.page < data.totalPages}
    <link rel="next" href={absoluteUrl(pageUrl(data.page + 1))} />
  {/if}

  {@html `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [buildBreadcrumbJsonLd(data.breadcrumbs), hubCollectionJsonLd, ...geoPlaceGraph.nodes]
  })}</script>`}
</svelte:head>

<div class="page">
  <SiteNav />

  <main>
    <header class="hub-header">
      <div class="hub-inner">
        <nav class="breadcrumb" aria-label="Breadcrumb">
          {#each data.breadcrumbs as crumb, index}
            {#if index > 0}
              <span aria-hidden="true">/</span>
            {/if}
            {#if index < data.breadcrumbs.length - 1}
              <a href={crumb.path}>{crumb.name}</a>
            {:else}
              <span>{crumb.name}</span>
            {/if}
          {/each}
        </nav>

        <div class="hub-header-row">
          <div>
            <p class="hub-kicker">{data.kicker}</p>
            <h1>{data.hubLabel}</h1>
            <p class="hub-meta">
              {data.visibleCount.toLocaleString('de-DE')} {data.visibleCountLabel}
            </p>
            <p class="hub-intro">
              {#if data.page > 1}
                Seite {data.page} erweitert diesen Orts-Hub mit weiteren Inhalten. Die erste Seite bleibt der kanonische Einstieg.
              {:else}
                {data.intro}
              {/if}
            </p>
          </div>

          <div class="hub-actions">
            <a class="hub-action hub-action--primary" href="/foto">Zu Foto</a>
            <a class="hub-action" href="/foto/upload">Foto anlegen</a>
            <a class="hub-action" href="/profile/review">Daten prüfen</a>
          </div>
        </div>

        {#if geoTrail.length > 0}
          <div class="geo-levels" aria-label="Ortsnavigation">
            {#each geoTrail as crumb, index}
              <a
                href={crumb.path}
                class="geo-pill"
                class:geo-pill--active={index === geoTrail.length - 1}
                aria-current={index === geoTrail.length - 1 ? 'page' : undefined}
              >
                {crumb.name}
              </a>
            {/each}
          </div>
        {/if}

        {#if data.currentLevelKey === 'country' && data.countryOptions?.length > 1}
          <section class="geo-country-switcher" aria-labelledby="geo-country-switcher-heading">
            <div class="geo-country-switcher__header">
              <h2 id="geo-country-switcher-heading">Länder</h2>
              <p>Direkte Einstiege in weitere Länder-Hubs.</p>
            </div>
            <div class="geo-children__grid">
              {#each data.countryOptions as country}
                <a href={country.path} class="geo-child-card">
                  <span class="geo-child-card__label">{country.label}</span>
                  <span class="geo-child-card__count">
                    {country.count.toLocaleString('de-DE')} {country.count === 1 ? 'Eintrag' : 'Einträge'}
                  </span>
                </a>
              {/each}
            </div>
          </section>
        {/if}

        {#if data.geoChildren?.length}
          <section class="geo-children" aria-labelledby="geo-children-heading">
            <div class="geo-children__header">
              <h2 id="geo-children-heading">{data.geoChildLevelLabel || 'Weitere Ebenen'}</h2>
              <p>Klicke dich strukturiert zur nächsten Ebene weiter.</p>
            </div>
            <div class="geo-children__grid">
              {#each data.geoChildren as child}
                <a href={child.path} class="geo-child-card">
                  <span class="geo-child-card__label">{child.label}</span>
                  <span class="geo-child-card__count">
                    {child.count.toLocaleString('de-DE')} {child.count === 1 ? 'Eintrag' : 'Einträge'}
                  </span>
                </a>
              {/each}
            </div>
          </section>
        {/if}
      </div>
    </header>

    <section class="hub-content">
      <div class="hub-inner">
        {#if !data.hasItemFeed}
          <p class="empty">Wähle eine Gemeinde, um die zugehörigen Bilder und Inhalte zu sehen.</p>
        {:else if !data.items?.length}
          <p class="empty">Noch keine Einträge vorhanden.</p>
        {:else}
          <div class="items-grid">
            {#each displayedItems as item (item.id)}
              <article class="item-card">
                <a href={itemHref(item)} class="item-link">
                  {#if item.path_512}
                    {@const previewUrl = currentThumbUrl(item)}
                    <div
                      class="item-thumb item-thumb--foto"
                      style={`--thumb-preview:url('${previewUrl}')`}
                      bind:this={previewThumbElements[item.id]}
                    >
                      {#if (item.child_count || 0) > 0}
                        <div class="item-variant-count">+{(item.child_count || 0) + 1}</div>
                      {/if}
                      {#if hasDistanceData && item.distance != null}
                        <div class="item-distance-badge">{formatDistance(item.distance)}</div>
                      {/if}
                      <img
                        src={previewUrl}
                        alt={item.title || data.hubLabel}
                        width="320"
                        height="213"
                        loading="lazy"
                        decoding="async"
                        bind:this={previewImageElements[item.id]}
                      />
                    </div>
                  {:else}
                    <div class="item-thumb item-thumb--empty">
                      <span class="thumb-icon">📷</span>
                    </div>
                  {/if}

                  <div class="item-body">
                    <h2>{item.title || item.slug}</h2>
                    <p class="item-desc">
                      {truncate(item.description || item.caption || data.fallbackDescription || `Mehr Inhalte aus ${data.hubLabel}.`, 120)}
                    </p>
                  </div>
                </a>
              </article>
            {/each}
          </div>

          {#if data.totalPages > 1}
            <nav class="pagination" aria-label="Seitennavigation">
              {#if data.page > 1}
                <a href={pageUrl(data.page - 1)} class="pg-link" rel="prev">Zurück</a>
              {/if}

              {#each Array.from({ length: data.totalPages }, (_, i) => i + 1) as p}
                {#if p === 1 || p === data.totalPages || (p >= data.page - 2 && p <= data.page + 2)}
                  <a
                    href={pageUrl(p)}
                    class="pg-link"
                    class:pg-active={p === data.page}
                    aria-current={p === data.page ? 'page' : undefined}
                  >{p}</a>
                {:else if p === data.page - 3 || p === data.page + 3}
                  <span class="pg-dots" aria-hidden="true">...</span>
                {/if}
              {/each}

              {#if data.page < data.totalPages}
                <a href={pageUrl(data.page + 1)} class="pg-link" rel="next">Weiter</a>
              {/if}
            </nav>
          {/if}
        {/if}
      </div>
    </section>
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
  .hub-header {
    border-bottom: 1px solid var(--border-color);
    background:
      radial-gradient(ellipse 60% 80% at 80% 30%, rgba(238, 114, 33, 0.06) 0%, transparent 100%),
      var(--bg-primary);
  }
  .hub-inner {
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
  .hub-header-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 1.25rem;
  }
  .hub-kicker {
    margin: 0 0 0.35rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--culoca-orange);
    font-size: 0.82rem;
    font-weight: 700;
  }
  .hub-header h1 {
    margin: 0 0 0.45rem;
    font-size: clamp(1.8rem, 3vw, 2.7rem);
    line-height: 1.05;
  }
  .hub-meta {
    margin: 0;
    color: var(--text-secondary);
    font-size: 0.95rem;
  }
  .hub-intro {
    margin: 0.8rem 0 0;
    max-width: 42rem;
    color: var(--text-secondary);
    line-height: 1.6;
  }
  .hub-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    justify-content: flex-end;
  }
  .hub-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 0.75rem 1rem;
    border-radius: 999px;
    border: 1px solid var(--border-color);
    background: var(--bg-secondary);
    color: var(--text-primary);
    text-decoration: none;
    font-weight: 600;
  }
  .hub-action--primary {
    background: var(--culoca-orange);
    color: #fff;
    border-color: var(--culoca-orange);
  }
  .geo-levels {
    display: flex;
    flex-wrap: wrap;
    gap: 0.65rem;
    margin-top: 1rem;
  }
  .geo-pill {
    display: inline-flex;
    align-items: center;
    min-height: 38px;
    padding: 0.5rem 0.9rem;
    border-radius: 999px;
    border: 1px solid var(--border-color);
    background: var(--bg-secondary);
    color: var(--text-primary);
    text-decoration: none;
    font-weight: 600;
  }
  .geo-pill--active {
    border-color: rgba(238, 114, 33, 0.65);
    box-shadow: 0 10px 22px rgba(238, 114, 33, 0.1);
  }
  .hub-content .hub-inner {
    padding-top: 2rem;
    padding-bottom: 3rem;
    background: var(--bg-primary);
  }
  .geo-children {
    margin-top: 1.5rem;
    padding-top: 1.25rem;
    border-top: 1px solid var(--border-color);
  }
  .geo-country-switcher {
    margin-top: 1.5rem;
    padding-top: 1.25rem;
    border-top: 1px solid var(--border-color);
  }
  .geo-country-switcher__header h2 {
    margin: 0;
    font-size: 1rem;
  }
  .geo-country-switcher__header p {
    margin: 0.35rem 0 0;
    color: var(--text-secondary);
    font-size: 0.95rem;
  }
  .geo-children__header h2 {
    margin: 0;
    font-size: 1rem;
  }
  .geo-children__header p {
    margin: 0.35rem 0 0;
    color: var(--text-secondary);
    font-size: 0.95rem;
  }
  .geo-children__grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 0.85rem;
    margin-top: 1rem;
  }
  .geo-child-card {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.95rem 1rem;
    border-radius: 1rem;
    border: 1px solid var(--border-color);
    background: var(--bg-secondary);
    text-decoration: none;
    color: var(--text-primary);
    transition: transform 0.16s ease, border-color 0.16s ease;
  }
  .geo-child-card:hover {
    transform: translateY(-1px);
    border-color: rgba(238, 114, 33, 0.4);
  }
  .geo-child-card__label {
    font-weight: 700;
  }
  .geo-child-card__count {
    color: var(--text-secondary);
    font-size: 0.9rem;
  }
  .empty {
    text-align: center;
    padding: 3rem 1rem;
    color: var(--text-muted);
    font-size: 1.1rem;
  }
  .items-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
  }
  .item-card {
    overflow: hidden;
    background: var(--bg-secondary);
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
    position: relative;
  }
  .item-thumb--foto::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image: var(--thumb-preview);
    background-size: cover;
    background-position: center;
    transform: scale(1.08);
    filter: blur(14px) saturate(0.9);
    opacity: 0.5;
  }
  .item-thumb img {
    position: relative;
    z-index: 1;
    width: 100%;
    height: 100%;
    object-fit: contain;
    transition: transform 0.3s;
  }
  /* Varianten-Zahl: wie Galerie, links oben, Dark/Light-Mode, ohne Abrundung */
  .item-variant-count {
    position: absolute;
    top: 0;
    left: 0;
    z-index: 2;
    background: var(--bg-overlay);
    color: var(--text-overlay);
    padding: 0 5px;
    font-size: 12.5px;
    font-weight: 600;
    line-height: 1.35;
    pointer-events: none;
    -webkit-backdrop-filter: blur(var(--overlay-blur));
    backdrop-filter: blur(var(--overlay-blur));
  }
  /* Entfernung: wie Galerie, rechts oben, Dark/Light-Mode, ohne Abrundung */
  .item-distance-badge {
    position: absolute;
    top: 0;
    right: 0;
    z-index: 2;
    background: var(--bg-overlay);
    color: var(--text-overlay);
    padding: 0 4px;
    font-size: 12.5px;
    font-weight: 600;
    line-height: 1.35;
    pointer-events: none;
    -webkit-backdrop-filter: blur(var(--overlay-blur));
    backdrop-filter: blur(var(--overlay-blur));
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
  .item-body h2 {
    margin: 0;
    font-size: 0.92rem;
    font-weight: 600;
    line-height: 1.35;
    color: var(--text-primary);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .item-desc {
    margin: 0;
    font-size: 0.8rem;
    line-height: 1.45;
    color: var(--text-muted);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 0.35rem;
    margin-top: 2.5rem;
    flex-wrap: wrap;
  }
  .pg-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 36px;
    height: 36px;
    padding: 0 0.6rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-secondary);
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    text-decoration: none;
  }
  .pg-link:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
    border-color: var(--text-muted);
  }
  .pg-active {
    background: var(--culoca-orange);
    color: #fff;
    border-color: var(--culoca-orange);
    pointer-events: none;
  }
  .pg-dots {
    padding: 0 0.25rem;
    color: var(--text-muted);
  }
  @media (max-width: 960px) {
    .items-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }
  @media (max-width: 680px) {
    .hub-inner {
      padding-left: 1.25rem;
      padding-right: 1.25rem;
    }
    .hub-header-row {
      flex-direction: column;
      align-items: flex-start;
    }
    .hub-actions {
      justify-content: flex-start;
    }
    .items-grid {
      grid-template-columns: repeat(2, 1fr);
      gap: 0.75rem;
    }
  }
  @media (max-width: 420px) {
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
