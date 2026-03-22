<script lang="ts">
  import { appendReturnTo } from '$lib/content/routing';
  import { getSeoImageUrl } from '$lib/utils/seoImageUrl';

  type SectionItem = {
    id: string;
    slug: string;
    title: string | null;
    description: string | null;
    caption: string | null;
    canonical_path: string | null;
    path_512: string | null;
    created_at: string | null;
    starts_at: string | null;
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
  /** Schmale Spalte (Dashboard rechts): eine Karte pro Zeile, kompaktere Typografie */
  export let compact = false;
  /** Pro Typ maximal so viele Karten (Server liefert bis zu 8) */
  export let maxItemsPerSection = 8;

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
    return appendReturnTo(item.canonical_path || `/item/${item.slug}`, '/');
  }

  function thumbUrl(item: { slug: string; path_512: string | null }): string {
    return getSeoImageUrl(item.slug, item.path_512, '512');
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

  $: descMax = compact ? 72 : 100;
</script>

<div class="home-sections-feed" class:home-sections-feed--compact={compact}>
  {#each sections as section (section.typeId)}
    <section class="content-section" id={compact ? undefined : section.slug}>
      <div class="section-inner">
        <div class="section-head">
          <h2>
            <a href="/{section.slug}">
              <span class="section-icon" aria-hidden="true">{TYPE_ICONS[section.slug] || ''}</span>
              {section.name}
            </a>
          </h2>
          <a href="/{section.slug}" class="see-all">
            {#if compact}
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
                    <p class="item-desc">{truncate(item.description || item.caption, descMax)}</p>
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
</div>

<style>
  .home-sections-feed--compact .content-section {
    border-top: 1px solid var(--border-color);
  }

  .home-sections-feed--compact .content-section:first-child {
    border-top: 0;
    padding-top: 0;
  }

  .home-sections-feed:not(.home-sections-feed--compact) .content-section {
    border-top: 1px solid var(--border-color);
  }

  .section-inner {
    padding: 2.5rem 2rem;
  }

  .home-sections-feed--compact .section-inner {
    padding: 1.15rem 0;
  }

  .section-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 1.5rem;
    gap: 0.75rem;
  }

  .home-sections-feed--compact .section-head {
    margin-bottom: 0.65rem;
  }

  .section-head h2 {
    font-size: 1.35rem;
    font-weight: 700;
    margin: 0;
    min-width: 0;
  }

  .home-sections-feed--compact .section-head h2 {
    font-size: 1.02rem;
    font-weight: 650;
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

  .home-sections-feed--compact .see-all {
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

  .home-sections-feed--compact .items-grid {
    grid-template-columns: 1fr;
    gap: 0.65rem;
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
  }

  .home-sections-feed--compact .item-thumb {
    aspect-ratio: 16 / 10;
  }

  .item-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.3s;
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

  .thumb-icon {
    font-size: 1.75rem;
    opacity: 0.4;
  }

  .item-body {
    padding: 0.75rem 0.85rem;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    flex: 1;
  }

  .home-sections-feed--compact .item-body {
    padding: 0.55rem 0.65rem;
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

  .home-sections-feed--compact .item-body h3 {
    font-size: 0.84rem;
    -webkit-line-clamp: 2;
    line-clamp: 2;
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

  .home-sections-feed--compact .item-desc {
    font-size: 0.74rem;
    -webkit-line-clamp: 2;
    line-clamp: 2;
  }

  .item-date {
    font-size: 0.75rem;
    color: var(--text-muted);
    margin-top: auto;
    padding-top: 0.2rem;
  }

  .home-sections-feed--compact .item-date {
    font-size: 0.7rem;
  }

  @media (max-width: 960px) {
    .home-sections-feed:not(.home-sections-feed--compact) .items-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  @media (max-width: 680px) {
    .home-sections-feed:not(.home-sections-feed--compact) .section-inner {
      padding: 2rem 1.25rem;
    }

    .home-sections-feed:not(.home-sections-feed--compact) .items-grid {
      grid-template-columns: repeat(2, 1fr);
      gap: 0.75rem;
    }
  }

  @media (max-width: 420px) {
    .home-sections-feed:not(.home-sections-feed--compact) .items-grid {
      grid-template-columns: 1fr;
    }

    .home-sections-feed:not(.home-sections-feed--compact) .item-link {
      flex-direction: row;
    }

    .home-sections-feed:not(.home-sections-feed--compact) .item-thumb {
      width: 100px;
      min-height: 80px;
      aspect-ratio: auto;
      flex-shrink: 0;
    }
  }
</style>
