<script lang="ts">
  import { appendReturnTo, getPublicItemHref } from '$lib/content/routing';
  import { getSeoImageUrl } from '$lib/utils/seoImageUrl';
  import { formatEventHubRange, formatHubEventPlace } from '$lib/content/eventHubFormat';

  type SectionItem = {
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
  };

  type Section = {
    typeId: number;
    slug: string;
    name: string;
    items: SectionItem[];
    totalCount: number;
  };

  /** Öffentliche Typ-Sektionen von der Startseiten-load */
  export let sections: Section[];
  /**
   * full = Startseite Gäste (breites Raster)
   * discover = Dashboard rechts: kompakte Köpfe, mehrspaltige Kacheln
   */
  export let variant: 'full' | 'discover' = 'full';
  /** Pro Typ maximal so viele Karten (Server liefert bis zu 8) */
  export let maxItemsPerSection = 8;
  /** Wie Dashboard-Entdecken: Entfernung auf Foto-/Event-Kacheln bei bekannter Position */
  export let referenceCoords: { lat: number; lon: number } | null = null;

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

  function itemHref(item: SectionItem): string {
    return appendReturnTo(getPublicItemHref(item), '/');
  }

  function pickPath(item: { path_512?: string | null; path_2048?: string | null }): string | null {
    return item.path_512 || item.path_2048 || null;
  }

  function thumbUrl(item: { slug: string; path_512?: string | null; path_2048?: string | null }): string {
    return getSeoImageUrl(item.slug, pickPath(item), '512');
  }

  function hubVisualThumb(slug: string): boolean {
    return slug === 'foto' || slug === 'event';
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

  function distanceForItem(item: SectionItem): number | null {
    if (!referenceCoords) return null;
    const lat = Number(item.lat);
    const lon = Number(item.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return getDistanceInMeters(referenceCoords.lat, referenceCoords.lon, lat, lon);
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

  $: isDiscover = variant === 'discover';
  $: descMax = 100;
</script>

<div class="home-sections-feed" class:home-sections-feed--discover={isDiscover}>
  {#each sections as section (section.typeId)}
    <section class="content-section" id={isDiscover ? undefined : section.slug}>
      <div class="section-inner">
        <div class="section-head">
          <h2>
            <a href="/{section.slug}">
              <span class="section-icon" aria-hidden="true">{TYPE_ICONS[section.slug] || ''}</span>
              {section.name}
            </a>
          </h2>
          <a href="/{section.slug}" class="see-all">
            {#if isDiscover}
              Alle {section.totalCount}
            {:else}
              Alle {section.totalCount} anzeigen
            {/if}
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M6 3l5 5-5 5"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </a>
        </div>

        <div class="items-grid">
          {#each section.items.slice(0, maxItemsPerSection) as item (item.id)}
            {@const visualThumb = hubVisualThumb(section.slug)}
            {@const previewUrl = thumbUrl(item)}
            {@const dist = distanceForItem(item)}
            {@const showDistBadge = visualThumb && dist != null}
            {@const eventRange = section.slug === 'event' ? formatEventHubRange(item.starts_at, item.ends_at) : ''}
            {@const eventPlace = section.slug === 'event' ? formatHubEventPlace(item) : ''}
            <article class="item-card">
              <a href={itemHref(item)} class="item-link">
                {#if pickPath(item)}
                  <div
                    class="item-thumb"
                    class:item-thumb--foto={visualThumb}
                    style={visualThumb
                      ? `--thumb-preview:url('${previewUrl.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}')`
                      : undefined}
                  >
                    {#if showDistBadge}
                      <div class="item-distance-badge">{formatDistance(dist)}</div>
                    {/if}
                    <img
                      src={previewUrl}
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
                  {#if section.slug === 'event'}
                    {#if eventRange}
                      <p class="item-event-range">{eventRange}</p>
                    {/if}
                    {#if eventPlace}
                      <p class="item-event-place">{eventPlace}</p>
                    {/if}
                  {/if}
                  {#if !isDiscover && (item.description || item.caption)}
                    <p class="item-desc">{truncate(item.description || item.caption, descMax)}</p>
                  {/if}
                  {#if section.slug !== 'foto' && section.slug !== 'event'}
                    {#if item.starts_at}
                      <time class="item-date" datetime={item.starts_at}>{formatDate(item.starts_at)}</time>
                    {:else if item.created_at}
                      <time class="item-date" datetime={item.created_at}>{formatDate(item.created_at)}</time>
                    {/if}
                  {/if}
                </div>
              </a>
            </article>
          {/each}
        </div>
      </div>
    </section>
  {/each}
</div>

<style>
  .home-sections-feed--discover .content-section {
    border-top: 1px solid var(--border-color);
  }

  .home-sections-feed--discover .content-section:first-child {
    border-top: 0;
  }

  .home-sections-feed:not(.home-sections-feed--discover) .content-section {
    border-top: 1px solid var(--border-color);
  }

  .section-inner {
    padding: 2.5rem 2rem;
  }

  .home-sections-feed--discover .section-inner {
    padding: 1rem 0;
  }

  .section-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 1.5rem;
    gap: 0.75rem;
  }

  .home-sections-feed--discover .section-head {
    margin-bottom: 0.6rem;
  }

  .section-head h2 {
    font-size: 1.35rem;
    font-weight: 700;
    margin: 0;
    min-width: 0;
  }

  .home-sections-feed--discover .section-head h2 {
    font-size: 1.05rem;
    font-weight: 600;
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
    margin-right: 0.35rem;
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
    flex-shrink: 0;
  }

  .home-sections-feed--discover .see-all {
    font-size: 0.78rem;
  }

  .see-all:hover {
    gap: 0.45rem;
  }

  .items-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
  }

  /* Mehrspaltige Entdecken-Kacheln (Breite der Spalte nutzt auto-fill) */
  .home-sections-feed--discover {
    container-type: inline-size;
    container-name: discoverfeed;
  }

  .home-sections-feed--discover .items-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.65rem;
  }

  @container discoverfeed (min-width: 400px) {
    .home-sections-feed--discover .items-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  .item-card {
    border-radius: 12px;
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

  .home-sections-feed--discover .item-thumb {
    aspect-ratio: 1 / 1;
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
    transform: scale(1.03);
  }

  .item-thumb--empty {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 5rem;
  }

  .home-sections-feed--discover .item-thumb--empty {
    min-height: 4.5rem;
    aspect-ratio: 1 / 1;
  }

  .thumb-icon {
    font-size: 1.75rem;
    opacity: 0.4;
  }

  .home-sections-feed--discover .thumb-icon {
    font-size: 1.35rem;
  }

  .item-body {
    padding: 0.75rem 0.85rem;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    flex: 1;
  }

  .home-sections-feed--discover .item-body {
    padding: 0.45rem 0.5rem 0.55rem;
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

  .item-event-range {
    font-size: 1rem;
    font-weight: 600;
    line-height: 1.35;
    margin: 0.2rem 0 0;
    color: var(--text-primary);
    letter-spacing: -0.02em;
  }

  .home-sections-feed--discover .item-event-range {
    font-size: 0.78rem;
    margin: 0.12rem 0 0;
  }

  .item-event-place {
    font-size: 0.875rem;
    font-weight: 500;
    line-height: 1.4;
    margin: 0.15rem 0 0;
    color: var(--text-secondary);
  }

  .home-sections-feed--discover .item-event-place {
    font-size: 0.68rem;
    margin: 0.08rem 0 0;
  }

  .home-sections-feed--discover .item-body h3 {
    font-size: 0.72rem;
    line-height: 1.3;
    -webkit-line-clamp: 3;
    line-clamp: 3;
  }

  .item-desc {
    font-size: 0.8rem;
    line-height: 1.4;
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
    padding-top: 0.2rem;
  }

  .home-sections-feed--discover .item-date {
    font-size: 0.62rem;
  }

  @media (max-width: 960px) {
    .home-sections-feed:not(.home-sections-feed--discover) .items-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  @media (max-width: 680px) {
    .home-sections-feed:not(.home-sections-feed--discover) .section-inner {
      padding: 2rem 1.25rem;
    }

    .home-sections-feed:not(.home-sections-feed--discover) .items-grid {
      grid-template-columns: repeat(2, 1fr);
      gap: 0.75rem;
    }
  }

  @media (max-width: 420px) {
    .home-sections-feed:not(.home-sections-feed--discover) .items-grid {
      grid-template-columns: 1fr;
    }

    .home-sections-feed:not(.home-sections-feed--discover) .item-link {
      flex-direction: row;
    }

    .home-sections-feed:not(.home-sections-feed--discover) .item-thumb {
      width: 100px;
      min-height: 80px;
      aspect-ratio: auto;
      flex-shrink: 0;
    }
  }
</style>
