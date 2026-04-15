<script lang="ts">
  import { onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { appendReturnTo, getPublicItemHref, PRIMARY_REGIONAL_FEED_PATH } from '$lib/content/routing';
  import { getSeoImageUrl } from '$lib/utils/seoImageUrl';
  import { formatEventHubRange, formatHubEventPlace } from '$lib/content/eventHubFormat';

  type DiscoverListItem = {
    id: string;
    slug: string;
    title: string | null;
    description: string | null;
    caption: string | null;
    canonical_path: string | null;
    path_512: string | null;
    path_2048: string | null;
    created_at: string | null;
    starts_at: string | null;
    ends_at: string | null;
    lat: number | null;
    lon: number | null;
    country_slug?: string | null;
    state_slug?: string | null;
    region_slug?: string | null;
    district_slug?: string | null;
    municipality_slug?: string | null;
    country_name?: string | null;
    district_name?: string | null;
    municipality_name?: string | null;
    locality_name?: string | null;
    variants?: Array<{ slug: string; path_512: string | null; path_2048: string | null }>;
    child_count?: number;
  };

  export let upcomingEvents: DiscoverListItem[] = [];
  export let latestPhotos: DiscoverListItem[] = [];
  export let latestFirms: DiscoverListItem[] = [];
  /** Wie regionaler Hub: userLat/userLon, Filter-Store, Fallback savedLocation */
  export let referenceCoords: { lat: number; lon: number } | null = null;

  let animatedPreviewUrls: Record<string, string> = {};
  let variantImageIndexes: Record<string, number> = {};
  let variantTimer: ReturnType<typeof setInterval> | null = null;
  let lastRotationKey = '';
  let previewImageElements: Record<string, HTMLImageElement | null> = {};
  let previewThumbElements: Record<string, HTMLDivElement | null> = {};

  function itemHref(item: DiscoverListItem): string {
    return appendReturnTo(getPublicItemHref(item), '/');
  }

  function pickPath(item: { path_512?: string | null; path_2048?: string | null }): string | null {
    return item.path_512 || item.path_2048 || null;
  }

  function thumbUrl(item: { slug: string; path_512?: string | null; path_2048?: string | null }): string {
    return getSeoImageUrl(item.slug, pickPath(item), '512');
  }

  function truncate(text: string | null | undefined, max: number): string {
    if (!text) return '';
    return text.length > max ? text.slice(0, max).trimEnd() + '…' : text;
  }

  function formatDate(iso: string | null): string {
    if (!iso) return '';
    try {
      return new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
    } catch {
      return '';
    }
  }

  function getDistanceInMeters(userLat: number, userLon: number, itemLat: number, itemLon: number) {
    const earthRadius = 6371000;
    const lat1 = (userLat * Math.PI) / 180;
    const lat2 = (itemLat * Math.PI) / 180;
    const dLat = ((itemLat - userLat) * Math.PI) / 180;
    const dLon = ((itemLon - userLon) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadius * c;
  }

  function formatDistance(distance: number | null | undefined): string {
    if (distance == null || Number.isNaN(distance)) return '';
    if (distance < 1000) return `${Math.round(distance)}m`;
    return `${(distance / 1000).toFixed(1)}km`;
  }

  function distanceForItem(item: DiscoverListItem): number | null {
    if (!referenceCoords) return null;
    const lat = Number(item.lat);
    const lon = Number(item.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return getDistanceInMeters(referenceCoords.lat, referenceCoords.lon, lat, lon);
  }

  function variantThumbUrls(item: DiscoverListItem): string[] {
    const variants = Array.isArray(item.variants) ? item.variants : [];
    const rootUrl = thumbUrl(item);
    return variants
      .filter((v) => v?.slug && pickPath(v))
      .map((v) => getSeoImageUrl(v.slug, pickPath(v), '512'))
      .filter((url) => Boolean(url) && url !== rootUrl);
  }

  function rotationThumbUrls(item: DiscoverListItem): string[] {
    const rootUrl = thumbUrl(item);
    const variantUrls = variantThumbUrls(item);
    return variantUrls.length ? [rootUrl, ...variantUrls] : [rootUrl];
  }

  function currentThumbUrl(item: DiscoverListItem): string {
    return animatedPreviewUrls[item.id] || thumbUrl(item);
  }

  function applyPreviewUrl(itemId: string, url: string) {
    const imageEl = previewImageElements[itemId];
    if (imageEl && imageEl.src !== url) {
      imageEl.src = url;
    }
    const thumbEl = previewThumbElements[itemId];
    if (thumbEl) {
      const safe = url.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      thumbEl.style.setProperty('--thumb-preview', `url('${safe}')`);
    }
  }

  function preloadVariantImages(items: DiscoverListItem[]) {
    if (!browser) return;
    for (const item of items) {
      for (const url of rotationThumbUrls(item).slice(1)) {
        const img = new Image();
        img.decoding = 'async';
        img.src = url;
      }
    }
  }

  function startVariantRotation(items: DiscoverListItem[]) {
    variantTimer = setInterval(() => {
      const nextUrls: Record<string, string> = {};
      const nextIndexes: Record<string, number> = { ...variantImageIndexes };

      for (const item of items) {
        const variants = rotationThumbUrls(item);
        if (variants.length <= 1) continue;
        const nextIndex = ((nextIndexes[item.id] ?? 0) + 1) % variants.length;
        nextIndexes[item.id] = nextIndex;
        nextUrls[item.id] = variants[nextIndex];
        applyPreviewUrl(item.id, variants[nextIndex]);
      }

      variantImageIndexes = nextIndexes;
      animatedPreviewUrls = nextUrls;
    }, 2800);
  }

  function refreshVariantRotation(items: DiscoverListItem[]) {
    if (!browser) return;
    const nextKey = items.map((item) => `${item.id}:${item.child_count || 0}`).join('|');
    if (nextKey === lastRotationKey) return;
    lastRotationKey = nextKey;

    if (variantTimer) {
      clearInterval(variantTimer);
      variantTimer = null;
    }

    animatedPreviewUrls = {};
    variantImageIndexes = {};

    const hasVariants = items.some((item) => variantThumbUrls(item).length > 0);
    if (!hasVariants) return;
    preloadVariantImages(items);
    startVariantRotation(items);
  }

  $: allRotationItems = [...upcomingEvents, ...latestPhotos, ...latestFirms];
  $: if (browser && allRotationItems.length > 0) {
    refreshVariantRotation(allRotationItems);
  }

  onDestroy(() => {
    if (variantTimer) clearInterval(variantTimer);
  });
</script>

<div class="discover-hub">
  {#if upcomingEvents.length > 0}
    <section class="discover-block" aria-labelledby="discover-events-heading">
      <div class="discover-head">
        <h2 id="discover-events-heading">
          <a href="/event"><span class="discover-icon" aria-hidden="true">📅</span>Nächste Termine</a>
        </h2>
        <a href="/event" class="discover-all">Alle anzeigen</a>
      </div>
      <div class="items-grid">
        {#each upcomingEvents as item (item.id)}
          {@const previewUrl = currentThumbUrl(item)}
          {@const dist = distanceForItem(item)}
          {@const eventRange = formatEventHubRange(item.starts_at, item.ends_at)}
          {@const eventPlace = formatHubEventPlace(item)}
          <article class="item-card">
            <a href={itemHref(item)} class="item-link">
              {#if pickPath(item)}
                <div
                  class="item-thumb item-thumb--foto"
                  bind:this={previewThumbElements[item.id]}
                  style={`--thumb-preview:url('${previewUrl.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}')`}
                >
                  {#if (item.child_count || 0) > 0}
                    <div class="item-variant-count">+{(item.child_count || 0) + 1}</div>
                  {/if}
                  {#if dist != null}
                    <div class="item-distance-badge">{formatDistance(dist)}</div>
                  {/if}
                  <img
                    src={previewUrl}
                    alt={item.title || item.slug}
                    width="400"
                    height="267"
                    loading="lazy"
                    decoding="async"
                    bind:this={previewImageElements[item.id]}
                  />
                </div>
              {:else}
                <div class="item-thumb item-thumb--empty">
                  <span class="thumb-icon">📅</span>
                </div>
              {/if}
              <div class="item-body">
                <h3>{item.title || item.slug}</h3>
                {#if eventRange}
                  <p class="item-event-range">{eventRange}</p>
                {/if}
                {#if eventPlace}
                  <p class="item-event-place">{eventPlace}</p>
                {/if}
                {#if item.description || item.caption}
                  <p class="item-desc">{truncate(item.description || item.caption, 100)}</p>
                {/if}
              </div>
            </a>
          </article>
        {/each}
      </div>
    </section>
  {/if}

  {#if latestPhotos.length > 0}
    <section class="discover-block" aria-labelledby="discover-foto-heading">
      <div class="discover-head">
        <h2 id="discover-foto-heading">
          <a href={PRIMARY_REGIONAL_FEED_PATH}><span class="discover-icon" aria-hidden="true">📷</span>Neueste Fotos</a>
        </h2>
        <a href={PRIMARY_REGIONAL_FEED_PATH} class="discover-all">Alle anzeigen</a>
      </div>
      <div class="items-grid">
        {#each latestPhotos as item (item.id)}
          {@const previewUrl = currentThumbUrl(item)}
          {@const dist = distanceForItem(item)}
          <article class="item-card">
            <a href={itemHref(item)} class="item-link">
              {#if pickPath(item)}
                <div
                  class="item-thumb item-thumb--foto"
                  bind:this={previewThumbElements[item.id]}
                  style={`--thumb-preview:url('${previewUrl.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}')`}
                >
                  {#if (item.child_count || 0) > 0}
                    <div class="item-variant-count">+{(item.child_count || 0) + 1}</div>
                  {/if}
                  {#if dist != null}
                    <div class="item-distance-badge">{formatDistance(dist)}</div>
                  {/if}
                  <img
                    src={previewUrl}
                    alt={item.title || item.slug}
                    width="400"
                    height="267"
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
                <h3>{item.title || item.slug}</h3>
              </div>
            </a>
          </article>
        {/each}
      </div>
    </section>
  {/if}

  {#if latestFirms.length > 0}
    <section class="discover-block" aria-labelledby="discover-firma-heading">
      <div class="discover-head">
        <h2 id="discover-firma-heading">
          <a href="/firma"><span class="discover-icon" aria-hidden="true">🏢</span>Firmen</a>
        </h2>
        <a href="/firma" class="discover-all">Alle anzeigen</a>
      </div>
      <div class="items-grid">
        {#each latestFirms as item (item.id)}
          {@const previewUrl = currentThumbUrl(item)}
          {@const dist = distanceForItem(item)}
          <article class="item-card">
            <a href={itemHref(item)} class="item-link">
              {#if pickPath(item)}
                <div
                  class="item-thumb item-thumb--foto"
                  bind:this={previewThumbElements[item.id]}
                  style={`--thumb-preview:url('${previewUrl.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}')`}
                >
                  {#if (item.child_count || 0) > 0}
                    <div class="item-variant-count">+{(item.child_count || 0) + 1}</div>
                  {/if}
                  {#if dist != null}
                    <div class="item-distance-badge">{formatDistance(dist)}</div>
                  {/if}
                  <img
                    src={previewUrl}
                    alt={item.title || item.slug}
                    width="400"
                    height="267"
                    loading="lazy"
                    decoding="async"
                    bind:this={previewImageElements[item.id]}
                  />
                </div>
              {:else}
                <div class="item-thumb item-thumb--empty">
                  <span class="thumb-icon">🏢</span>
                </div>
              {/if}
              <div class="item-body">
                <h3>{item.title || item.slug}</h3>
                {#if item.description || item.caption}
                  <p class="item-desc">{truncate(item.description || item.caption, 100)}</p>
                {/if}
                <div class="item-meta">
                  {#if item.created_at}
                    <time datetime={item.created_at}>{formatDate(item.created_at)}</time>
                  {/if}
                </div>
              </div>
            </a>
          </article>
        {/each}
      </div>
    </section>
  {/if}
</div>

<style>
  .discover-hub {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .discover-block {
    min-width: 0;
  }

  .discover-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 1rem;
    margin-bottom: 1rem;
    flex-wrap: wrap;
  }

  .discover-head h2 {
    margin: 0;
    font-size: clamp(1.1rem, 2vw, 1.35rem);
    font-weight: 700;
  }

  .discover-head h2 a {
    color: var(--text-primary);
    text-decoration: none;
  }

  .discover-head h2 a:hover {
    color: var(--culoca-orange);
  }

  .discover-icon {
    margin-right: 0.35rem;
  }

  .discover-all {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--culoca-orange);
    text-decoration: none;
    white-space: nowrap;
  }

  .discover-all:hover {
    text-decoration: underline;
  }

  /* Größere Kacheln als zuvor (4 → 3 Spalten) */
  .items-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1.15rem;
  }

  .item-card {
    overflow: hidden;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    transition: transform 0.2s, box-shadow 0.2s;
  }

  .item-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
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
    object-fit: cover;
    transition: transform 0.3s;
  }

  .item-thumb--foto img {
    object-fit: contain;
  }

  .item-card:hover .item-thumb img {
    transform: scale(1.04);
  }

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
    padding: 0.85rem 0.95rem;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    flex: 1;
  }

  .item-body h3 {
    font-size: 0.95rem;
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

  .item-event-range {
    font-size: 1rem;
    font-weight: 600;
    line-height: 1.35;
    margin: 0.2rem 0 0;
    color: var(--text-primary);
    letter-spacing: -0.02em;
  }

  .item-event-place {
    font-size: 0.875rem;
    font-weight: 500;
    line-height: 1.4;
    margin: 0.15rem 0 0;
    color: var(--text-secondary);
  }

  .item-desc {
    font-size: 0.82rem;
    line-height: 1.45;
    color: var(--text-muted);
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .item-meta {
    font-size: 0.78rem;
    color: var(--text-muted);
    margin-top: auto;
    padding-top: 0.2rem;
  }

  @media (max-width: 1100px) {
    .items-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 720px) {
    .items-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.85rem;
    }
  }

  @media (max-width: 420px) {
    .items-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
