<script lang="ts">
  import type { PageData } from './$types';
  import SiteNav from '$lib/SiteNav.svelte';
  import SiteFooter from '$lib/SiteFooter.svelte';
  import { getSeoImageUrl } from '$lib/utils/seoImageUrl';

  export let data: PageData;

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

  $: icon = TYPE_ICONS[data.typeDef.slug] || '';
  $: pageTitle = `${data.typeDef.name} - Culoca`;
  $: metaDesc = `Alle ${data.typeDef.name}-Einträge auf Culoca. ${data.typeDef.description}. ${data.totalCount} Einträge verfügbar.`;

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

  function pageUrl(p: number): string {
    return p === 1 ? `/${data.typeDef.slug}` : `/${data.typeDef.slug}?seite=${p}`;
  }
</script>

<svelte:head>
  <title>{pageTitle}</title>
  <meta name="description" content={metaDesc} />
  <link rel="canonical" href="https://culoca.com/{data.typeDef.slug}" />
  <meta name="robots" content="index, follow" />

  <meta property="og:locale" content="de_DE" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content={pageTitle} />
  <meta property="og:description" content={metaDesc} />
  <meta property="og:url" content="https://culoca.com/{data.typeDef.slug}" />
  <meta property="og:site_name" content="Culoca" />
  <meta name="twitter:card" content="summary" />

  {#if data.page > 1}
    <link rel="prev" href={pageUrl(data.page - 1)} />
  {/if}
  {#if data.page < data.totalPages}
    <link rel="next" href={pageUrl(data.page + 1)} />
  {/if}

  {@html `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": data.typeDef.name + " auf Culoca",
    "description": data.typeDef.description,
    "url": "https://culoca.com/" + data.typeDef.slug,
    "numberOfItems": data.totalCount,
    "isPartOf": { "@type": "WebSite", "name": "Culoca", "url": "https://culoca.com" }
  })}</script>`}
</svelte:head>

<div class="page">
  <SiteNav />

  <main>
    <header class="hub-header">
      <div class="hub-inner">
        <nav class="breadcrumb" aria-label="Breadcrumb">
          <a href="/">Culoca</a>
          <span aria-hidden="true">/</span>
          <span>{data.typeDef.name}</span>
        </nav>
        <h1>
          <span class="hub-icon" aria-hidden="true">{icon}</span>
          {data.typeDef.name}
        </h1>
        <p class="hub-meta">
          {data.totalCount.toLocaleString('de-DE')} {data.totalCount === 1 ? 'Eintrag' : 'Einträge'}
          {#if data.typeDef.description}
            <span class="hub-sep" aria-hidden="true">&mdash;</span>
            {data.typeDef.description}
          {/if}
        </p>
      </div>
    </header>

    <section class="hub-content">
      <div class="hub-inner">
        {#if data.items.length === 0}
          <p class="empty">Noch keine Einträge vorhanden.</p>
        {:else}
          <div class="items-grid">
            {#each data.items as item (item.id)}
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
                      <span class="thumb-icon">{icon || '📄'}</span>
                    </div>
                  {/if}
                  <div class="item-body">
                    <h3>{item.title || item.slug}</h3>
                    {#if item.description || item.caption}
                      <p class="item-desc">{truncate(item.description || item.caption, 120)}</p>
                    {/if}
                    <div class="item-meta">
                      {#if item.starts_at}
                        <time datetime={item.starts_at}>{formatDate(item.starts_at)}</time>
                      {:else if item.created_at}
                        <time datetime={item.created_at}>{formatDate(item.created_at)}</time>
                      {/if}
                    </div>
                  </div>
                </a>
              </article>
            {/each}
          </div>

          <!-- SSR Pagination -->
          {#if data.totalPages > 1}
            <nav class="pagination" aria-label="Seitennavigation">
              {#if data.page > 1}
                <a href={pageUrl(data.page - 1)} class="pg-link" rel="prev">Zurück</a>
              {/if}

              {#each Array.from({length: data.totalPages}, (_, i) => i + 1) as p}
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
  main { flex: 1; }

  /* ---- Header ---- */
  .hub-header {
    border-bottom: 1px solid var(--border-color);
    background:
      radial-gradient(ellipse 60% 80% at 80% 30%, rgba(238, 114, 33, 0.06) 0%, transparent 100%),
      var(--bg-primary);
  }
  .hub-inner {
    max-width: 1120px;
    margin: 0 auto;
    padding: 2rem;
  }
  .hub-header .hub-inner {
    padding-top: 2.5rem;
    padding-bottom: 2rem;
  }

  .breadcrumb {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
    color: var(--text-muted);
    margin-bottom: 0.75rem;
  }
  .breadcrumb a {
    color: var(--text-muted);
    text-decoration: none;
    transition: color 0.15s;
  }
  .breadcrumb a:hover {
    color: var(--culoca-orange);
  }

  .hub-header h1 {
    font-size: clamp(1.6rem, 3.5vw, 2.4rem);
    font-weight: 800;
    margin: 0 0 0.5rem;
    letter-spacing: -0.02em;
  }
  .hub-icon {
    margin-right: 0.35rem;
  }
  .hub-meta {
    font-size: 0.95rem;
    color: var(--text-secondary);
    margin: 0;
  }
  .hub-sep {
    margin: 0 0.3rem;
    opacity: 0.5;
  }

  /* ---- Content ---- */
  .hub-content .hub-inner {
    padding-top: 2rem;
    padding-bottom: 3rem;
  }
  .empty {
    text-align: center;
    padding: 3rem 1rem;
    color: var(--text-muted);
    font-size: 1.1rem;
  }

  /* ---- Grid ---- */
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
  .item-meta {
    margin-top: auto;
    padding-top: 0.25rem;
  }
  .item-meta time {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  /* ---- Pagination ---- */
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
    transition: background 0.15s, color 0.15s, border-color 0.15s;
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

  /* ---- Responsive ---- */
  @media (max-width: 960px) {
    .items-grid { grid-template-columns: repeat(3, 1fr); }
  }
  @media (max-width: 680px) {
    .hub-inner { padding-left: 1.25rem; padding-right: 1.25rem; }
    .items-grid { grid-template-columns: repeat(2, 1fr); gap: 0.75rem; }
  }
  @media (max-width: 420px) {
    .items-grid { grid-template-columns: 1fr; }
    .item-link { flex-direction: row; }
    .item-thumb {
      width: 100px;
      min-height: 80px;
      aspect-ratio: auto;
      flex-shrink: 0;
    }
    .item-body { padding: 0.6rem 0.75rem; }
  }
</style>
