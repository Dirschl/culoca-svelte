<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { browser } from '$app/environment';
  import type { PageData } from './$types';
  import SiteNav from '$lib/SiteNav.svelte';
  import SiteFooter from '$lib/SiteFooter.svelte';
  import { supabase } from '$lib/supabaseClient';
  import { getSeoImageUrl } from '$lib/utils/seoImageUrl';
  import { appendReturnTo } from '$lib/content/routing';
  import { getEffectiveGpsPosition } from '$lib/filterStore';
  import { absoluteUrl, buildBreadcrumbJsonLd, DEFAULT_OG_IMAGE, trimText } from '$lib/seo/site';

  type FotoListItem = {
    id: string;
    slug: string;
    title?: string | null;
    description?: string | null;
    caption?: string | null;
    canonical_path: string | null;
    path_512: string | null;
    width?: number | null;
    height?: number | null;
    created_at?: string | null;
    starts_at?: string | null;
    ends_at?: string | null;
    external_url?: string | null;
    lat?: number | null;
    lon?: number | null;
    is_private?: boolean | null;
    profile_id?: string | null;
    original_name?: string | null;
    child_count?: number;
    variants?: Array<{ slug: string; path_512: string | null }>;
    distance?: number | null;
  };

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
  $: isFotoType = data.typeDef.slug === 'foto';
  $: pageTitle = data.page > 1
    ? `${data.typeDef.name}: Seite ${data.page} | Culoca`
    : `${data.typeDef.name}: Inhalte, Motive und Übersichten | Culoca`;
  $: metaDesc = trimText(
    data.search
      ? `${data.typeDef.name} Suche auf Culoca für "${data.search}". Suchergebnisse bleiben crawlbar verlinkt, werden aber nicht indexiert.`
      : `Alle ${data.typeDef.name}-Einträge auf Culoca. ${data.typeDef.description}. ${data.totalCount} Einträge verfügbar.`
  );
  let clientItems: FotoListItem[] | null = null;
  let clientTotalCount: number | null = null;
  let clientPage = 1;
  let currentGpsPosition: { lat: number; lon: number } | null = browser ? getStoredGpsPosition() : null;
  let activeSearchTerm = data.search || '';
  let searchQuery = activeSearchTerm;
  let isClientLoading = false;
  let lastSearchValue = activeSearchTerm;
  let suppressNextEmptySubmit = false;
  let _lastDataKey = '';
  $: _dataKey = `${data.page}-${data.search ?? ''}`;
  $: if (typeof window !== 'undefined' && _dataKey !== _lastDataKey) {
    _lastDataKey = _dataKey;
    clientItems = null;
    clientTotalCount = null;
    clientPage = data.page;
    activeSearchTerm = data.search || '';
    searchQuery = data.search || '';
    lastSearchValue = data.search || '';
  }
  $: shouldPreferGpsSorting = isFotoType && currentGpsPosition != null;
  $: serverItemsWithDistance = shouldPreferGpsSorting
    ? data.items.map((item: any) => {
        const lat = Number(item.lat);
        const lon = Number(item.lon);
        const hasCoordinates = Number.isFinite(lat) && Number.isFinite(lon);
        return {
          ...item,
          lat: hasCoordinates ? lat : item.lat,
          lon: hasCoordinates ? lon : item.lon,
          distance: hasCoordinates ? getDistanceInMeters(currentGpsPosition!.lat, currentGpsPosition!.lon, lat, lon) : null
        };
      })
    : data.items;
  $: useGpsApi = shouldPreferGpsSorting && clientItems != null;
  $: effectivePage = useGpsApi ? clientPage : data.page;
  $: displayedItems = useGpsApi ? clientItems! : shouldPreferGpsSorting ? [] : serverItemsWithDistance;
  $: displayedTotalCount = (useGpsApi ? clientTotalCount : null) ?? data.totalCount;
  $: displayedTotalPages = Math.max(1, Math.ceil(displayedTotalCount / data.pageSize));
  $: hasDistanceData = displayedItems.some((item: any) => item?.distance !== undefined && item?.distance !== null);
  $: currentListPath = pageUrl(effectivePage);
  $: canonicalUrl = absoluteUrl(data.seoPolicy.canonicalPath);
  $: typeHubJsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      buildBreadcrumbJsonLd([
        { name: 'Culoca', path: '/' },
        { name: data.typeDef.name, path: data.seoPolicy.canonicalPath }
      ]),
      {
        '@type': 'CollectionPage',
        name: `${data.typeDef.name} auf Culoca`,
        description: data.typeDef.description,
        url: canonicalUrl,
        numberOfItems: data.totalCount,
        isPartOf: { '@type': 'WebSite', name: 'Culoca', url: 'https://culoca.com' }
      }
    ]
  };
  let animatedPreviewUrls: Record<string, string> = {};
  let variantImageIndexes: Record<string, number> = {};
  let variantTimer: ReturnType<typeof setInterval> | null = null;
  let idleHandle: number | null = null;
  let gpsRetryTimer: ReturnType<typeof setInterval> | null = null;
  let lastRotationKey = '';
  let previewImageElements: Record<string, HTMLImageElement | null> = {};
  let previewThumbElements: Record<string, HTMLDivElement | null> = {};

  function itemHref(item: { canonical_path: string | null; slug: string }): string {
    return appendReturnTo(item.canonical_path || `/item/${item.slug}`, currentListPath);
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
    const params = new URLSearchParams();
    if (activeSearchTerm.trim()) params.set('suche', activeSearchTerm.trim());
    if (p > 1) params.set('seite', String(p));
    const qs = params.toString();
    return qs ? `/${data.typeDef.slug}?${qs}` : `/${data.typeDef.slug}`;
  }

  function formatDistance(distance: number | null | undefined): string {
    if (distance == null || Number.isNaN(distance)) return '';
    if (distance < 1000) return `${Math.round(distance)}m`;
    return `${(distance / 1000).toFixed(1)}km`;
  }

  function clearFotoSearch() {
    searchQuery = '';
    suppressNextEmptySubmit = true;
    if (typeof window !== 'undefined') {
      window.location.replace(`/${data.typeDef.slug}`);
    }
  }

  function handleFotoSearchSubmit(event: SubmitEvent) {
    const trimmedQuery = searchQuery.trim();
    if (trimmedQuery) {
      searchQuery = trimmedQuery;
      lastSearchValue = trimmedQuery;
      return;
    }

    event.preventDefault();
    if (suppressNextEmptySubmit) {
      suppressNextEmptySubmit = false;
      return;
    }
    clearFotoSearch();
  }

  function handleFotoSearchInput(event: Event) {
    const nextValue = (event.currentTarget as HTMLInputElement).value;
    searchQuery = nextValue;

    if (!nextValue.trim() && lastSearchValue.trim()) {
      clearFotoSearch();
      return;
    }

    lastSearchValue = nextValue;
  }

  function handleFotoSearchEvent(event: Event) {
    const nextValue = (event.currentTarget as HTMLInputElement).value;
    if (!nextValue.trim()) {
      clearFotoSearch();
    }
  }

  function getStoredGpsPosition(): { lat: number; lon: number } | null {
    if (typeof window === 'undefined') return null;

    const windowLat = Number((window as any).userLat);
    const windowLon = Number((window as any).userLon);
    if (Number.isFinite(windowLat) && Number.isFinite(windowLon) && (windowLat !== 0 || windowLon !== 0)) {
      return { lat: windowLat, lon: windowLon };
    }

    const directLat = Number(localStorage.getItem('userLat'));
    const directLon = Number(localStorage.getItem('userLon'));
    if (Number.isFinite(directLat) && Number.isFinite(directLon) && (directLat !== 0 || directLon !== 0)) {
      return { lat: directLat, lon: directLon };
    }

    const effectiveGps = getEffectiveGpsPosition();
    if (
      effectiveGps &&
      effectiveGps.source !== 'locationFilter' &&
      Number.isFinite(effectiveGps.lat) &&
      Number.isFinite(effectiveGps.lon)
    ) {
      return { lat: effectiveGps.lat, lon: effectiveGps.lon };
    }

    try {
      const raw = localStorage.getItem('culoca-filters');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const lat = Number(parsed?.lastGpsPosition?.lat);
      const lon = Number(parsed?.lastGpsPosition?.lon);
      if (Number.isFinite(lat) && Number.isFinite(lon) && (lat !== 0 || lon !== 0)) {
        return { lat, lon };
      }
    } catch {
      return null;
    }

    return null;
  }

  function applyMultiWordSearch(query: any, search: string, includeExtendedFotoFields = false) {
    const words = search
      .trim()
      .split(/\s+/)
      .map((word) => word.trim())
      .filter(Boolean);

    const clauses = words.flatMap((word) => {
      const escaped = word.replace(/%/g, '\\%').replace(/_/g, '\\_');
      const baseClauses = [
        `title.ilike.%${escaped}%`,
        `description.ilike.%${escaped}%`,
        `caption.ilike.%${escaped}%`,
        `slug.ilike.%${escaped}%`
      ];

      if (includeExtendedFotoFields) {
        baseClauses.push(`original_name.ilike.%${escaped}%`);
      }

      return baseClauses;
    });

    if (!clauses.length) return query;
    return query.or(clauses.join(','));
  }

  function matchesAllSearchWords(
    item: {
      title?: string | null;
      description?: string | null;
      caption?: string | null;
      slug?: string | null;
      original_name?: string | null;
    },
    search: string
  ) {
    const words = search
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .map((word) => word.trim())
      .filter(Boolean);

    if (!words.length) return true;

    const haystack = [
      item.title,
      item.description,
      item.caption,
      item.slug,
      item.original_name
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return words.every((word) => haystack.includes(word));
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

  async function attachVariants(items: any[]) {
    if (!items.length) return items;

    const rootIds = items.map((item) => item.id);
    const { data: variantRows } = await supabase
      .from('items')
      .select('id, slug, path_512, width, height, group_root_item_id')
      .in('group_root_item_id', rootIds)
      .eq('is_private', false)
      .eq('admin_hidden', false)
      .not('slug', 'is', null)
      .not('path_512', 'is', null)
      .order('created_at', { ascending: false });

    const variantsByRoot = new Map<string, any[]>();
    for (const row of variantRows || []) {
      const rootId = row.group_root_item_id as string | null;
      if (!rootId) continue;
      const current = variantsByRoot.get(rootId) || [];
      if (current.length >= 5) continue;
      current.push(row);
      variantsByRoot.set(rootId, current);
    }

    return items.map((item) => ({
      ...item,
      variants: variantsByRoot.get(item.id) || [],
      child_count: item.child_count ?? (variantsByRoot.get(item.id) || []).length
    }));
  }

  async function loadFotoPageFromGps(pageIndex0Based: number) {
    if (!isFotoType || typeof window === 'undefined') return;
    const gps = getStoredGpsPosition();
    currentGpsPosition = gps;
    if (!gps) return;

    isClientLoading = true;
    try {
      const search = activeSearchTerm.trim();
      const { data: authData } = await supabase.auth.getUser();
      const currentUserId = authData.user?.id || null;
      const pageFetchSize = 1000;
      let from = 0;
      const allRows: FotoListItem[] = [];
      while (true) {
        let pageQuery = supabase
          .from('items')
          .select('id, slug, title, description, caption, canonical_path, path_512, width, height, created_at, starts_at, ends_at, external_url, lat, lon, is_private, profile_id')
          .eq('type_id', data.typeDef.id)
          .eq('admin_hidden', false)
          .is('group_root_item_id', null)
          .not('slug', 'is', null)
          .not('path_512', 'is', null)
          .range(from, from + pageFetchSize - 1);

        if (search) {
          pageQuery = applyMultiWordSearch(pageQuery, search, true);
        }

        const { data: rows, error: rowsError } = await pageQuery;
        if (rowsError) {
          throw rowsError;
        }

        if (!rows || rows.length === 0) {
          break;
        }

        allRows.push(
          ...rows.filter((item: FotoListItem) => {
            const isVisible =
              (currentUserId && item.profile_id === currentUserId) ||
              item.is_private === false ||
              item.is_private == null;

            if (!isVisible) return false;
            return !search || matchesAllSearchWords(item, search);
          })
        );

        if (rows.length < pageFetchSize) {
          break;
        }

        from += pageFetchSize;
      }

      const totalMatching = allRows.length;
      const sortedRows = allRows
        .map((item) => {
          const lat = Number(item.lat);
          const lon = Number(item.lon);
          const hasCoordinates = Number.isFinite(lat) && Number.isFinite(lon);
          const distance = hasCoordinates
            ? getDistanceInMeters(gps.lat, gps.lon, lat, lon)
            : null;

          return {
            ...item,
            lat: hasCoordinates ? lat : item.lat,
            lon: hasCoordinates ? lon : item.lon,
            distance
          };
        })
        .sort((a, b) => {
          const aDistance = a.distance ?? Number.POSITIVE_INFINITY;
          const bDistance = b.distance ?? Number.POSITIVE_INFINITY;
          if (aDistance !== bDistance) return aDistance - bDistance;

          const aCreated = a.created_at ? new Date(a.created_at).getTime() : 0;
          const bCreated = b.created_at ? new Date(b.created_at).getTime() : 0;
          return bCreated - aCreated;
        });

      const pageStart = pageIndex0Based * data.pageSize;
      const pageRows = sortedRows.slice(pageStart, pageStart + data.pageSize);
      const enriched = await attachVariants(pageRows);
      clientItems = enriched.map((item) => ({
        ...item,
        caption: item.caption ?? item.description ?? null
      }));
      clientTotalCount = totalMatching;
      clientPage = pageIndex0Based + 1;
    } catch (err) {
      console.error('[foto-list] GPS photo load failed:', err);
      clientItems = null;
      clientTotalCount = null;
    } finally {
      isClientLoading = false;
    }
  }

  async function refreshFotoItemsByGps() {
    if (!isFotoType) return;
    const gps = getStoredGpsPosition();
    currentGpsPosition = gps;
    if (!gps) return;
    await loadFotoPageFromGps(data.page - 1);
  }

  async function syncGpsState() {
    const gps = getStoredGpsPosition();
    const gpsChanged =
      (!!gps !== !!currentGpsPosition) ||
      (gps != null && currentGpsPosition != null && (gps.lat !== currentGpsPosition.lat || gps.lon !== currentGpsPosition.lon));

    currentGpsPosition = gps;
    if (!gps) return;
    if (gpsChanged || clientItems == null) {
      await loadFotoPageFromGps(data.page - 1);
    }
  }

  async function goToPage(p: number) {
    if (useGpsApi) {
      clientPage = p;
      await loadFotoPageFromGps(p - 1);
      if (typeof window !== 'undefined') {
        const url = pageUrl(p);
        window.history.replaceState({}, '', url);
      }
    }
  }

  function variantThumbUrls(item: FotoListItem): string[] {
    if (!isFotoType) return [];
    const variants = Array.isArray(item.variants) ? item.variants : [];
    const rootUrl = thumbUrl(item);
    return variants
      .filter((variant: { slug: string; path_512: string | null } | undefined) => variant?.slug && variant?.path_512)
      .map((variant: { slug: string; path_512: string | null }) => getSeoImageUrl(variant.slug, variant.path_512, '512'))
      .filter((url): url is string => Boolean(url) && url !== rootUrl);
  }

  function rotationThumbUrls(item: FotoListItem): string[] {
    const rootUrl = thumbUrl(item);
    const variantUrls = variantThumbUrls(item);
    return variantUrls.length ? [rootUrl, ...variantUrls] : [rootUrl];
  }

  function currentThumbUrl(item: FotoListItem): string {
    return animatedPreviewUrls[item.id] || thumbUrl(item);
  }

  function applyPreviewUrl(itemId: string, url: string) {
    const imageEl = previewImageElements[itemId];
    if (imageEl && imageEl.src !== url) {
      imageEl.src = url;
    }

    const thumbEl = previewThumbElements[itemId];
    if (thumbEl) {
      thumbEl.style.setProperty('--thumb-preview', `url('${url}')`);
    }
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
    if (!isFotoType) return;

    console.log(
      '[foto-list] starting rotation for items:',
      displayedItems
        .map((item: any) => ({
          id: item.id,
          slug: item.slug,
          child_count: item.child_count || 0,
          rotation_frames: rotationThumbUrls(item).length
        }))
        .filter((item: any) => item.child_count > 0)
    );

    variantTimer = setInterval(() => {
      const nextUrls: Record<string, string> = {};
      const nextIndexes: Record<string, number> = { ...variantImageIndexes };

      for (const item of displayedItems) {
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

  function refreshVariantRotation() {
    if (!isFotoType || typeof window === 'undefined') return;
    const nextKey = displayedItems.map((item: any) => `${item.id}:${item.child_count || 0}`).join('|');
    if (nextKey === lastRotationKey) return;
    lastRotationKey = nextKey;

    if (variantTimer) {
      clearInterval(variantTimer);
      variantTimer = null;
    }

    animatedPreviewUrls = {};
    variantImageIndexes = {};

    const hasVariants = displayedItems.some((item: any) => variantThumbUrls(item).length > 0);
    if (!hasVariants) return;
    preloadVariantImages();
    startVariantRotation();
  }

  $: if (isFotoType && displayedItems.length > 0) {
    refreshVariantRotation();
  }

  onMount(() => {
    if (!isFotoType) return;
    console.log(
      '[foto-list] loaded items:',
      displayedItems.map((item: FotoListItem) => ({
        id: item.id,
        slug: item.slug,
        child_count: item.child_count || 0,
        variant_count: variantThumbUrls(item).length
      }))
    );
    currentGpsPosition = getStoredGpsPosition();

    void refreshFotoItemsByGps();

    gpsRetryTimer = setInterval(() => {
      void syncGpsState();
    }, 1000);

    const start = async () => {
      const hasVariants = displayedItems.some((item: FotoListItem) => variantThumbUrls(item).length > 0);
      if (hasVariants) {
        preloadVariantImages();
        startVariantRotation();
      }
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      idleHandle = window.requestIdleCallback(start, { timeout: 900 });
    } else {
      idleHandle = (window as Window).setTimeout(start, 600);
    }
  });

  onDestroy(() => {
    if (variantTimer) clearInterval(variantTimer);
    if (gpsRetryTimer) clearInterval(gpsRetryTimer);
    if (idleHandle !== null) {
      if (typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleHandle);
      } else {
        clearTimeout(idleHandle);
      }
    }
  });
</script>

<svelte:head>
  <title>{pageTitle}</title>
  <meta name="description" content={metaDesc} />
  <link rel="canonical" href={canonicalUrl} />
  <meta name="robots" content={data.seoPolicy.robots} />

  <meta property="og:locale" content="de_DE" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content={pageTitle} />
  <meta property="og:description" content={metaDesc} />
  <meta property="og:url" content={canonicalUrl} />
  <meta property="og:site_name" content="Culoca" />
  <meta property="og:image" content={DEFAULT_OG_IMAGE} />
  <meta name="twitter:card" content="summary_large_image" />

  {#if data.page > 1}
    <link rel="prev" href={pageUrl(data.page - 1)} />
  {/if}
  {#if data.page < data.totalPages}
    <link rel="next" href={pageUrl(data.page + 1)} />
  {/if}

  {@html `<script type="application/ld+json">${JSON.stringify(typeHubJsonLd)}</script>`}
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
          {displayedTotalCount.toLocaleString('de-DE')} {displayedTotalCount === 1 ? 'Eintrag' : 'Einträge'}
          {#if data.typeDef.description}
            <span class="hub-sep" aria-hidden="true">&mdash;</span>
            {data.typeDef.description}
          {/if}
        </p>
        <p class="hub-intro">
          {#if data.search}
            Diese Seite zeigt gefilterte Treffer für <strong>{data.search}</strong>. Die Trefferlisten bleiben für interne Links nutzbar, indexiert wird aber nur die kuratierte Hauptseite.
          {:else if data.page > 1}
            Seite {data.page} vertieft den Hub mit weiteren Einträgen, während die erste Seite den kanonischen Einstieg für Suchmaschinen bildet.
          {:else}
            Dieser Hub kombiniert Themenkontext, interne Navigation und aktuelle Inhalte, damit die Übersicht mehr ist als eine reine Liste.
          {/if}
        </p>
        {#if isFotoType}
          <form class="foto-search" action={`/${data.typeDef.slug}`} method="GET" on:submit={handleFotoSearchSubmit}>
            <input
              type="search"
              name="suche"
              placeholder="Fotos durchsuchen"
              bind:value={searchQuery}
              on:input={handleFotoSearchInput}
            />
          </form>
          {#if shouldPreferGpsSorting && !useGpsApi}
            <p class="foto-search-hint">Sortiere nach aktuellem Standort ...</p>
          {:else if isClientLoading}
            <p class="foto-search-hint">Sortiere nach aktuellem Standort ...</p>
          {:else if currentGpsPosition}
            <p class="foto-search-hint">Sortierung wie Galerie, nach Entfernung ab deinem aktuellen Standort.</p>
          {:else}
            <p class="foto-search-hint">Ohne GPS werden die neuesten Fotos zuerst gezeigt.</p>
          {/if}

          <div class="foto-upload-panel">
            <div class="foto-upload-copy">
              <p class="foto-upload-eyebrow">Foto Upload</p>
              <h2>Fotos auf Culoca brauchen einen Ortsbezug</h2>
              <p>
                Fotos, die du hier veröffentlichst, können alle Culoca-Nutzer sehen. Deshalb sollten Motiv,
                Beschreibung und vor allem die Ortsdaten sauber gepflegt sein.
              </p>
              <ul>
                <li>Neue oder unvollständige Fotos am besten über den neuen Foto-Upload anlegen.</li>
                <li>Bereits vollständig vorbereitete Serien können weiter über den Batch-Uploader laufen.</li>
                <li>Fehlende Angaben erscheinen danach rot im Konto unter Daten prüfen.</li>
              </ul>
            </div>

            <div class="foto-upload-actions">
              <a class="foto-upload-link foto-upload-link--primary" href="/foto/upload">Zum Foto-Upload</a>
              <a class="foto-upload-link" href="/bulk-upload">Zum Batch-Uploader</a>
              <a class="foto-upload-link" href="/profile/review">Daten prüfen</a>
            </div>
          </div>
        {/if}
      </div>
    </header>

    <section class="hub-content">
      <div class="hub-inner">
        {#if displayedItems.length === 0}
          <p class="empty">Noch keine Einträge vorhanden.</p>
        {:else}
          <div class="items-grid">
            {#each displayedItems as item (item.id)}
              <article class="item-card">
                <a href={itemHref(item)} class="item-link">
                  {#if item.path_512}
                    {@const previewUrl = currentThumbUrl(item)}
                    <div
                      class="item-thumb"
                      class:item-thumb--foto={isFotoType}
                      style={isFotoType ? `--thumb-preview:url('${previewUrl}')` : undefined}
                      bind:this={previewThumbElements[item.id]}
                    >
                      {#if isFotoType && (item.child_count || 0) > 0}
                        <div class="item-variant-count">+{(item.child_count || 0) + 1}</div>
                      {/if}
                      {#if isFotoType && hasDistanceData && item.distance !== undefined && item.distance !== null}
                        <div class="item-distance-badge">{formatDistance(item.distance)}</div>
                      {/if}
                      <img
                        src={previewUrl}
                        alt={item.title || item.slug}
                        width="320"
                        height="213"
                        loading="lazy"
                        decoding="async"
                        bind:this={previewImageElements[item.id]}
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
                    {#if !isFotoType}
                      <div class="item-meta">
                        {#if item.starts_at}
                          <time datetime={item.starts_at}>{formatDate(item.starts_at)}</time>
                        {:else if item.created_at}
                          <time datetime={item.created_at}>{formatDate(item.created_at)}</time>
                        {/if}
                      </div>
                    {/if}
                  </div>
                </a>
              </article>
            {/each}
          </div>

          <!-- SSR Pagination -->
          {#if displayedTotalPages > 1}
            <nav class="pagination" aria-label="Seitennavigation">
              {#if effectivePage > 1}
                {#if useGpsApi}
                  <button type="button" class="pg-link" on:click={() => goToPage(effectivePage - 1)}>Zurück</button>
                {:else}
                  <a href={pageUrl(effectivePage - 1)} class="pg-link" rel="prev">Zurück</a>
                {/if}
              {/if}

              {#each Array.from({length: displayedTotalPages}, (_, i) => i + 1) as p}
                {#if p === 1 || p === displayedTotalPages || (p >= effectivePage - 2 && p <= effectivePage + 2)}
                  {#if useGpsApi}
                    <button
                      type="button"
                      class="pg-link"
                      class:pg-active={p === effectivePage}
                      aria-current={p === effectivePage ? 'page' : undefined}
                      on:click={() => goToPage(p)}
                    >{p}</button>
                  {:else}
                    <a
                      href={pageUrl(p)}
                      class="pg-link"
                      class:pg-active={p === effectivePage}
                      aria-current={p === effectivePage ? 'page' : undefined}
                    >{p}</a>
                  {/if}
                {:else if p === effectivePage - 3 || p === effectivePage + 3}
                  <span class="pg-dots" aria-hidden="true">...</span>
                {/if}
              {/each}

              {#if effectivePage < displayedTotalPages}
                {#if useGpsApi}
                  <button type="button" class="pg-link" on:click={() => goToPage(effectivePage + 1)}>Weiter</button>
                {:else}
                  <a href={pageUrl(effectivePage + 1)} class="pg-link" rel="next">Weiter</a>
                {/if}
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
  .foto-search {
    margin-top: 1rem;
    display: flex;
    gap: 0.65rem;
    max-width: 34rem;
  }
  .foto-search input {
    flex: 1;
    min-width: 0;
    border: 1px solid var(--border-color);
    border-radius: 999px;
    background: var(--bg-secondary);
    color: var(--text-primary);
    padding: 0.78rem 1rem;
    font-size: 0.95rem;
  }
  .foto-search button {
    border: none;
    border-radius: 999px;
    background: var(--culoca-orange);
    color: #fff;
    padding: 0.78rem 1rem;
    font-weight: 700;
    cursor: pointer;
  }
  .foto-search-clear {
    background: var(--bg-tertiary) !important;
    color: var(--text-primary) !important;
    padding-inline: 0.95rem !important;
  }
  .foto-search-hint {
    margin: 0.65rem 0 0;
    color: var(--text-muted);
    font-size: 0.82rem;
  }
  .foto-upload-panel {
    display: grid;
    grid-template-columns: minmax(0, 1.65fr) minmax(240px, 0.9fr);
    gap: 1rem;
    margin-top: 1rem;
    padding: 1rem 1.1rem;
    border-radius: 20px;
    border: 1px solid var(--border-color);
    background:
      linear-gradient(135deg, rgba(238, 114, 33, 0.09), transparent 48%),
      var(--bg-secondary);
  }
  .foto-upload-eyebrow {
    margin: 0 0 0.3rem;
    font-size: 0.76rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--culoca-orange);
  }
  .foto-upload-copy h2 {
    margin: 0 0 0.45rem;
    font-size: clamp(1.1rem, 2.2vw, 1.45rem);
    line-height: 1.15;
  }
  .foto-upload-copy p {
    margin: 0;
    color: var(--text-secondary);
  }
  .foto-upload-copy ul {
    margin: 0.8rem 0 0;
    padding-left: 1.15rem;
    color: var(--text-secondary);
  }
  .foto-upload-actions {
    display: grid;
    gap: 0.75rem;
    align-content: start;
  }
  .foto-upload-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 46px;
    padding: 0.8rem 1rem;
    border-radius: 999px;
    border: 1px solid var(--border-color);
    background: var(--bg-primary);
    color: var(--text-primary);
    text-decoration: none;
    font-weight: 600;
  }
  .foto-upload-link--primary {
    background: var(--culoca-orange);
    color: #fff;
    border-color: var(--culoca-orange);
  }
  .hub-sep {
    margin: 0 0.3rem;
    opacity: 0.5;
  }
  .hub-shortcuts {
    padding-top: 1.2rem;
  }
  .shortcut-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 1rem;
    margin-bottom: 1rem;
  }
  .shortcut-kicker {
    margin: 0 0 0.35rem;
    font-size: 0.76rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--culoca-orange);
  }
  .shortcut-head h2 {
    margin: 0;
    font-size: clamp(1.1rem, 2vw, 1.5rem);
  }
  .shortcut-actions {
    display: flex;
    gap: 0.8rem;
    flex-wrap: wrap;
  }
  .shortcut-actions a {
    color: var(--text-secondary);
    text-decoration: none;
    font-weight: 600;
  }
  .shortcut-actions a:hover {
    color: var(--culoca-orange);
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
  .item-variant-count {
    position: absolute;
    top: 0.55rem;
    left: 0.55rem;
    z-index: 2;
    min-width: 2rem;
    padding: 0.18rem 0.42rem;
    border-radius: 999px;
    background: rgba(15, 23, 42, 0.82);
    color: #fff;
    font-size: 0.78rem;
    font-weight: 700;
    line-height: 1;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
    backdrop-filter: blur(8px);
  }
  .item-distance-badge {
    position: absolute;
    top: 0.55rem;
    right: 0.55rem;
    z-index: 2;
    padding: 0.22rem 0.48rem;
    border-radius: 999px;
    background: rgba(15, 23, 42, 0.82);
    color: #fff;
    font-size: 0.76rem;
    font-weight: 700;
    line-height: 1;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
    backdrop-filter: blur(8px);
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
  .pagination button.pg-link {
    font-family: inherit;
    cursor: pointer;
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
    .shortcut-head {
      flex-direction: column;
      align-items: flex-start;
    }
    .items-grid { grid-template-columns: repeat(2, 1fr); gap: 0.75rem; }
    .foto-search {
      flex-direction: column;
      max-width: none;
    }
    .foto-upload-panel {
      grid-template-columns: 1fr;
    }
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
