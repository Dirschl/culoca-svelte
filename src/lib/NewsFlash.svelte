<script lang="ts">
import { onMount, onDestroy } from 'svelte';
import { goto } from '$app/navigation';
import type { NewsFlashImage } from './types';
import { galleryStats } from './galleryStats';
import { supabase } from './supabaseClient';

// Modus: 'eigene', 'alle', 'aus'
export let mode: 'eigene' | 'alle' | 'aus' = 'alle';
export let userId: string | null = null;
export let layout: 'justified' | 'grid' | 'strip' = 'strip';
export let limit: number = 15;
export let showToggles: boolean = true;
export let showDistance: boolean = false;
export let userLat: number | null = null;
export let userLon: number | null = null;
export let getDistanceFromLatLonInMeters: ((lat1: number, lon1: number, lat2: number, lon2: number) => string) | null = null;
export let displayedImageCount: number = 0;

// NEU: Serverseitige initiale Daten für SEO
export let initialItems: any[] = [];
export let currentPage: number = 1;
export let totalPages: number = 1;

let images: NewsFlashImage[] = [];
let loading = true;
let loadingMore = false;
let errorMsg = '';
let lastUpdate = new Date();
let lastImageId: string | null = null;
let hasMoreImages = true;
let currentOffset = 0;
let refreshInterval: number | null = null;
let mounted = false;
let usedInitialItems = false; // NEU: Merker, ob SSR-Items verwendet wurden

// Container references for auto-scroll
let stripContainer: HTMLElement;
let gridContainer: HTMLElement;

// Track last page to detect changes
let lastLoadedPage = currentPage;

// NEU: Verwende initialItems wenn verfügbar (für SEO) oder wenn Seite gewechselt wurde
$: if (initialItems && initialItems.length > 0 && (images.length === 0 || currentPage !== lastLoadedPage)) {
  console.log('[NewsFlash] Using server-side initial items:', initialItems.length, 'Page:', currentPage);
  console.log('[NewsFlash] First item:', initialItems[0]);
  images = initialItems.map(item => ({
    id: item.id,
    slug: item.slug,
    lat: item.lat,
    lon: item.lon,
    path_512: item.path_512,
    title: item.title,
    description: item.description,
    original_name: item.original_name
  }));
  loading = false;
  lastImageId = images[0]?.id || null;
  usedInitialItems = true;
  lastLoadedPage = currentPage;
  currentOffset = (currentPage - 1) * limit + initialItems.length; // Correct offset calculation
  hasMoreImages = currentPage < totalPages;
  console.log('[NewsFlash] Server-side items loaded:', images.length, 'Page:', currentPage, 'Total pages:', totalPages, 'Has more:', hasMoreImages);
}

// Direct database query for NewsFlash images (bypasses API limitations)
async function loadNewsFlashImagesDirectFromDB(): Promise<NewsFlashImage[]> {
  try {
    console.log('[NewsFlash DirectDB] Loading images directly from database...');
    
    // Get current session to determine privacy filtering
    const { data: { session } } = await supabase.auth.getSession();
    const currentUserId = session?.user?.id || null;
    
    // Use dedicated SQL function for NewsFlash with proper sorting
    const { data, error } = await supabase.rpc('newsflash_items_postgis', {
      page_value: Math.floor(currentOffset / limit),
      page_size_value: limit,
      current_user_id: currentUserId,
      mode: mode
    });
    
    if (error) {
      console.error('[NewsFlash DirectDB] Database error:', error);
      return [];
    }
    
    const images = (data || []).map(item => ({
      id: item.id,
      slug: item.slug,
      lat: item.lat,
      lon: item.lon,
      path_512: item.path_512!,
      title: item.title,
      description: item.description,
      original_name: item.original_name
    }));
    
    console.log('[NewsFlash] Geladene Images:', images.slice(0, 5));
    console.log(`[NewsFlash DirectDB] Successfully loaded ${images.length} images`);
    return images;
    
  } catch (error) {
    console.error('[NewsFlash DirectDB] Error:', error);
    return [];
  }
}

async function fetchImages(isLoadMore: boolean = false) {
  // Paging Steuerung
  if (isLoadMore) {
    if (loadingMore || !hasMoreImages) return;
    loadingMore = true;
    currentOffset += limit; // Offset erhöhen beim Nachladen
  } else {
    // WICHTIG: Bei Auto-Refresh oder initialem Laden immer die neuesten Items laden
    // Nur bei initialem Laden mit Server-Daten den Offset beibehalten
    if (usedInitialItems && initialItems && initialItems.length > 0 && !mounted) {
      currentOffset = initialItems.length; // Weiter nach den Server-Daten
    } else {
      currentOffset = 0; // Von Anfang an - neueste Items
    }
    hasMoreImages = true;
  }

  try {
    // Use direct database query instead of API
    const newImages = await loadNewsFlashImagesDirectFromDB();

    if (isLoadMore) {
      if (newImages.length > 0) {
        // Nur neue, noch nicht vorhandene Items anhängen
        const existingIds = new Set(images.map(img => img.id));
        const uniqueNewImages = newImages.filter(img => !existingIds.has(img.id));
        images = [...images, ...uniqueNewImages];
        hasMoreImages = uniqueNewImages.length === limit;
      } else {
        hasMoreImages = false;
      }
      loadingMore = false;
    } else {
      // NEU: Verbesserte Logik für neue Bilder
      const hasNewImages = newImages.length > 0 && (
        images.length === 0 || 
        newImages[0]?.id !== images[0]?.id ||
        newImages.length !== images.length
      );
      
      // NEU: Wenn neue Bilder vorhanden sind, ersetze die gesamte Liste
      // um sicherzustellen, dass die neuesten Bilder vorne stehen
      if (hasNewImages) {
        console.log('[NewsFlash] Neue Bilder gefunden, ersetze Liste');
        images = newImages;
        // Auto-scroll to the beginning (newest images)
        setTimeout(() => {
          scrollToRight();
        }, 100);
      } else {
        // Nur aktualisieren wenn keine neuen Bilder
        images = newImages;
      }
      
      lastImageId = images[0]?.id || null;
      lastUpdate = new Date();
      loading = false;
      errorMsg = '';
    }
  } catch (err) {
    console.error('NewsFlash: Unexpected error', err);
    errorMsg = 'Fehler beim Laden der Bilder.';
    if (isLoadMore) loadingMore = false;
  }
}

function scrollToRight() {
  const container = stripContainer || gridContainer;
  if (container) {
    container.scrollTo({
      left: 0, // Scroll to the beginning (newest images are on the left)
      behavior: 'smooth'
    });
  }
}

function startAutoRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
  if (mode !== 'aus') {
    refreshInterval = setInterval(() => {
      console.log('NewsFlash: Auto-refresh triggered - loading newest items');
      // WICHTIG: Auto-Refresh soll die neuesten Items laden und die Liste ersetzen
      // nicht anhängen! Deshalb currentOffset auf 0 setzen
      currentOffset = 0;
      fetchImages(false); // false = nicht nachladen, sondern ersetzen
    }, 60000); // Alle 60 Sekunden (1 Minute)
  }
}

function stopAutoRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}

onMount(() => {
  mounted = true;
  // WICHTIG: Server-Daten nicht überschreiben!
  // Nur laden wenn keine Server-Daten vorhanden sind
  if (!initialItems || initialItems.length === 0) {
    console.log('[NewsFlash] No server data, loading from client');
    fetchImages();
  } else {
    console.log('[NewsFlash] Using server data, setting offset for continuation');
    // Offset für Nachladen setzen, aber nicht die Server-Daten überschreiben
    currentOffset = initialItems.length;
    // WICHTIG: Kein fetchImages() hier - Server-Daten beibehalten!
  }
  startAutoRefresh();
});

onDestroy(() => {
  stopAutoRefresh();
});

// Nur beim ersten Mount und bei expliziter Mode-Änderung laden
// $: if (mounted && mode !== 'aus') {
//   fetchImages();
//   startAutoRefresh();
// }

function handleImageClick(img: NewsFlashImage) {
  console.log('[NewsFlash] handleImageClick:', img);
  goto(`/item/${img.slug}`);
}

function toggleMode() {
  if (mode === 'alle') mode = 'eigene';
  else if (mode === 'eigene') mode = 'aus';
  else mode = 'alle';
  
  // Explizit laden und Auto-Refresh starten statt reaktiver Block
  if (mode !== 'aus') {
    fetchImages();
    startAutoRefresh();
  } else {
    stopAutoRefresh();
  }
}

function toggleLayout() {
  if (layout === 'strip') layout = 'justified';
  else if (layout === 'justified') layout = 'grid';
  else layout = 'strip';
}

function handleScroll(event: Event) {
  const target = event.target as HTMLElement;
  const scrollLeft = target.scrollLeft;
  const scrollWidth = target.scrollWidth;
  const clientWidth = target.clientWidth;
  
  // Wenn der User fast am Ende ist (80% der Scroll-Breite), lade mehr Bilder
  if (scrollLeft + clientWidth >= scrollWidth * 0.8 && hasMoreImages && !loadingMore) {
    console.log('NewsFlash: Near end of scroll, loading more images');
    fetchImages(true);
  }
}

// Truncate text for display - works without CSS
function truncateText(text: string, maxLength: number = 20): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}
</script>

{#if mode !== 'aus'}
  <div class="newsflash-bar">
    {#if showToggles}
      <div class="newsflash-toggles">
        <button class="toggle-btn" on:click={toggleMode} title="Modus wechseln">
          {#if mode === 'alle'}Alle{/if}
          {#if mode === 'eigene'}Eigene{/if}
          {#if mode === 'aus'}Aus{/if}
        </button>
        <button class="toggle-btn" on:click={toggleLayout} title="Layout wechseln">
          {#if layout === 'strip'}Streifen{/if}
          {#if layout === 'justified'}Justified{/if}
          {#if layout === 'grid'}Grid{/if}
        </button>
      </div>
    {/if}
    {#if loading}
      <div class="newsflash-loading">Lade NewsFlash...</div>
    {:else if errorMsg}
      <div class="newsflash-error">{errorMsg}</div>
    {:else if images.length === 0}
      <div class="newsflash-empty">Keine Uploads gefunden.</div>
    {:else}
      {#if layout === 'strip' || layout === 'justified'}
        <div class="newsflash-strip" tabindex="0" on:scroll={handleScroll} bind:this={stripContainer}>
          <div class="newsflash-time">{lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} {displayedImageCount}/{$galleryStats.totalCount}</div>
          {#each images as img (img.id)}
            <div class="newsflash-item">
              <a href={`/item/${img.slug}`} class="newsflash-thumb" tabindex="0" role="button" aria-label={img.title || img.original_name || 'Bild'} title={img.title || img.original_name || 'Bild'}>
                <img src={"https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-512/" + img.path_512} alt={img.title || img.original_name || 'Bild'} />
                {#if showDistance && userLat !== null && userLon !== null && img.lat && img.lon && getDistanceFromLatLonInMeters}
                  <div class="gallery-distance">
                    {getDistanceFromLatLonInMeters(userLat, userLon, img.lat, img.lon)}
                  </div>
                {/if}
              </a>
              <a href={`/item/${img.slug}`} class="newsflash-link" title={img.title || img.original_name || 'Bild'}>
                {truncateText(img.title || img.original_name || 'Bild ansehen', 20)}
              </a>
            </div>
          {/each}
          {#if loadingMore}
            <div class="newsflash-loading-more">Lade mehr...</div>
          {/if}
          {#if hasMoreImages && !loadingMore}
            <!-- Sichtbarer Link für Bots und Benutzer -->
            <div class="newsflash-load-more">
              <a href="/?page={currentPage + 1}" rel="next" class="newsflash-more-link">
                Weitere Bilder laden (Seite {currentPage + 1})
              </a>
            </div>
          {/if}
        </div>
      {:else if layout === 'grid'}
        <div class="newsflash-grid" tabindex="0" on:scroll={handleScroll} bind:this={gridContainer}>
          <div class="newsflash-time">{lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} {displayedImageCount}/{$galleryStats.totalCount}</div>
          {#each images as img (img.id)}
            <div class="newsflash-item">
              <a href={`/item/${img.slug}`} class="newsflash-thumb" tabindex="0" role="button" aria-label={img.title || img.original_name || 'Bild'} title={img.title || img.original_name || 'Bild'}>
                <img src={"https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-512/" + img.path_512} alt={img.title || img.original_name || 'Bild'} />
                {#if showDistance && userLat !== null && userLon !== null && img.lat && img.lon && getDistanceFromLatLonInMeters}
                  <div class="gallery-distance">
                    {getDistanceFromLatLonInMeters(userLat, userLon, img.lat, img.lon)}
                  </div>
                {/if}
              </a>
              <a href={`/item/${img.slug}`} class="newsflash-link" title={img.title || img.original_name || 'Bild'}>
                {truncateText(img.title || img.original_name || 'Bild ansehen', 15)}
              </a>
            </div>
          {/each}
          {#if loadingMore}
            <div class="newsflash-loading-more">Lade mehr...</div>
          {/if}
          {#if hasMoreImages && !loadingMore}
            <!-- Sichtbarer Link für Bots und Benutzer -->
            <div class="newsflash-load-more">
              <a href="/?page={currentPage + 1}" rel="next" class="newsflash-more-link">
                Weitere Bilder laden (Seite {currentPage + 1})
              </a>
            </div>
          {/if}
        </div>
      {/if}
      {#if initialItems && initialItems.length === 50}
        <!-- SEO-Paginierung für Bots - komplett versteckt für normale Benutzer -->
        <div class="newsflash-pagination-ssr" aria-hidden="true">
          {#if currentPage > 1}
            <a href="/?page={currentPage - 1}" rel="prev" class="pagination-link" tabindex="-1">← Vorherige Seite</a>
          {/if}
          <span class="pagination-info">Seite {currentPage} von {totalPages}</span>
          {#if currentPage < totalPages}
            <a href="/?page={currentPage + 1}" rel="next" class="pagination-link" tabindex="-1">Weitere Bilder →</a>
          {/if}
        </div>
      {/if}
    {/if}
  </div>
{/if}



<style>
.newsflash-bar {
  width: 100%;
  background: var(--bg-secondary);
  border-bottom: 2px solid var(--border-color);
  box-sizing: border-box;
  overflow-x: auto;
  overflow-y: hidden;
  min-height: 80px;
  /* Verstecke Scrollbalken */
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE and Edge */
}
.newsflash-bar::-webkit-scrollbar {
  display: none; /* Chrome, Safari and Opera */
}
.newsflash-toggles {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}
.toggle-btn {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: none;
  border-radius: 4px;
  padding: 0.25rem 0.75rem;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background 0.2s;
}
.toggle-btn:hover {
  background: var(--border-color);
}
.newsflash-loading, .newsflash-error, .newsflash-empty {
  color: var(--text-secondary);
  font-size: 0.95rem;
  padding: 0.5rem 0;
}

/* SEO-Paginierung für Bots - komplett versteckt für normale Benutzer, aber sichtbar für Bots */
.newsflash-pagination-ssr {
  position: absolute;
  left: -9999px;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
}

/* Nur für Screen Reader und Bots sichtbar - NICHT für normale Benutzer */
@media (prefers-reduced-motion: no-preference) {
  .newsflash-pagination-ssr {
    position: absolute;
    left: -9999px;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
  }
}

.newsflash-load-more {
  display: flex;
  justify-content: center;
  padding: 1rem;
  flex-shrink: 0;
}

.newsflash-more-link {
  display: inline-block;
  padding: 0.5rem 1rem;
  background: var(--bg-tertiary);
  color: var(--text-primary);
  text-decoration: none;
  border-radius: 4px;
  font-size: 0.85rem;
  transition: background 0.2s, color 0.2s;
  white-space: nowrap;
}

.newsflash-more-link:hover {
  background: var(--accent-color);
  color: white;
}
  
  .pagination-link:hover {
    background: var(--bg-secondary);
  }
  
  .pagination-info {
    color: var(--text-secondary);
    font-size: 0.9rem;
  }
.newsflash-info {
  color: #4fa3f7;
  font-size: 0.9rem;
  padding: 0.25rem 0;
  font-weight: 500;
}
.newsflash-strip {
  display: flex;
  gap: 2px;
  align-items: flex-end;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 0;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  /* Verstecke Scrollbalken */
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE and Edge */
}
.newsflash-strip::-webkit-scrollbar {
  display: none; /* Chrome, Safari and Opera */
}
.newsflash-grid {
  display: flex;
  gap: 2px;
  align-items: flex-end;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 0;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  /* Verstecke Scrollbalken */
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE and Edge */
}
.newsflash-grid::-webkit-scrollbar {
  display: none; /* Chrome, Safari and Opera */
}
@media (max-width: 768px) {
  .newsflash-grid .newsflash-item {
    width: 100px;
  }
  .newsflash-grid .newsflash-thumb,
  .newsflash-grid .newsflash-thumb img {
    width: 100px;
    height: 100px;
  }
}
@media (max-width: 480px) {
  .newsflash-grid .newsflash-item {
    width: 80px;
  }
  .newsflash-grid .newsflash-thumb,
  .newsflash-grid .newsflash-thumb img {
    width: 80px;
    height: 80px;
  }
}
.newsflash-grid .newsflash-item {
  display: inline-flex;
  flex-direction: column;
  align-items: stretch;
  gap: 2px;
  flex-shrink: 0;
  scroll-snap-align: start;
  width: 128px;
  min-width: 0;
}

.newsflash-grid .newsflash-thumb {
  width: 128px;
  height: 128px;
  border-radius: 0;
  overflow: hidden;
  background: #222;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border: none;
  transition: box-shadow 0.2s, transform 0.2s;
  position: relative;
  flex-shrink: 0;
}

.newsflash-grid .newsflash-thumb:focus, .newsflash-grid .newsflash-thumb:hover {
  outline: none !important;
  border: none !important;
}
.newsflash-grid .newsflash-thumb img {
  width: 128px;
  height: 128px;
  object-fit: cover;
  display: block;
  background: #222;
  border-radius: 0;
  margin: 0;
  padding: 0;
  transition: transform 0.3s cubic-bezier(.4,0,.2,1);
}
.newsflash-grid .newsflash-thumb:hover img {
  transform: scale(1.04);
}
.newsflash-item {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  scroll-snap-align: start;
  min-width: 0;
  max-width: min-content;
}

.newsflash-thumb {
  height: 140px;
  min-width: 0;
  background: #222;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  cursor: pointer;
  border: none;
  transition: border 0.2s;
  flex-shrink: 0;
  margin: 0;
  padding: 0;
  overflow: hidden;
  position: relative;
  text-decoration: none;
  color: inherit;
}

.newsflash-link {
  /* Sichtbar für Bots, klein und unauffällig für Benutzer */
  display: block;
  font-size: 0.7rem;
  text-align: center;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 0;
  margin: 0;
  color: var(--text-secondary);
  text-decoration: none;
  transition: color 0.2s;
  flex-shrink: 1;
  box-sizing: border-box;
}

.newsflash-link:hover {
  color: var(--accent-color);
}
.newsflash-thumb:focus, .newsflash-thumb:hover {
  outline: none !important;
  border: none !important;
}
.newsflash-thumb img {
  height: 140px;
  width: auto;
  object-fit: contain;
  display: block;
  background: #222;
  border-radius: 0;
  margin: 0;
  padding: 0;
  transition: transform 0.3s cubic-bezier(.4,0,.2,1);
}
.newsflash-thumb:hover img {
  transform: scale(1.04);
}
.newsflash-time {
  color: #4fa3f7;
  font-size: 0.8rem;
  writing-mode: vertical-rl;
  text-orientation: mixed;
  transform: rotate(180deg);
  align-self: center;
  margin-right: 8px;
  font-weight: 500;
  white-space: nowrap;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  line-height: 1.2;
}

.newsflash-loading-more {
  color: var(--text-secondary);
  font-size: 0.8rem;
  padding: 0.5rem;
  text-align: center;
  background: var(--bg-tertiary);
  border-radius: 4px;
  margin: 0.5rem;
  min-width: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.newsflash-pagination-ssr {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  margin: 1rem 0;
  padding: 0.5rem;
  background: var(--bg-secondary);
  border-radius: 4px;
  font-size: 0.9rem;
}

.pagination-link {
  color: var(--accent-color);
  text-decoration: none;
  padding: 0.25rem 0.5rem;
  border-radius: 3px;
  transition: background 0.2s;
}

.pagination-link:hover {
  background: var(--border-color);
}

.pagination-info {
  color: var(--text-secondary);
  font-weight: 500;
}

</style> 