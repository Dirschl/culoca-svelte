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

// Direct database query for NewsFlash images (bypasses API limitations)
async function loadNewsFlashImagesDirectFromDB(): Promise<NewsFlashImage[]> {
  try {
    console.log('[NewsFlash DirectDB] Loading images directly from database...');
    
    // Get current session to determine privacy filtering
    const { data: { session } } = await supabase.auth.getSession();
    const currentUserId = session?.user?.id || null;
    
    let query = supabase
      .from('items')
      .select('id, slug, lat, lon, path_512, title, description, original_name, profile_id, is_private, created_at')
      .not('path_512', 'is', null)
      .eq('gallery', true) // Only show images with gallery = true
      .order('created_at', { ascending: false })
      .range(currentOffset, currentOffset + limit - 1);
    
    // Apply privacy filtering based on mode and user
    if (currentUserId && mode !== 'aus') {
      if (mode === 'eigene') {
        // For 'eigene' mode: only show user's own images
        query = query.eq('profile_id', currentUserId);
      } else if (mode === 'alle') {
        // For 'alle' mode: show user's own images + other users' public images
        query = query.or(`profile_id.eq.${currentUserId},is_private.eq.false,is_private.is.null`);
      }
    } else {
      // For anonymous users or 'aus' mode: only show public images
      query = query.or('is_private.eq.false,is_private.is.null');
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('[NewsFlash DirectDB] Database error:', error);
      return [];
    }
    
    const images = (data || []).map(item => ({
      id: item.id,
      slug: item.slug, // Slug mitgeben!
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
    currentOffset += limit;
  } else {
    currentOffset = 0;
    hasMoreImages = true;
  }

  try {
    // Use direct database query instead of API
    const newImages = await loadNewsFlashImagesDirectFromDB();

    if (isLoadMore) {
      if (newImages.length > 0) {
        images = [...images, ...newImages];
        hasMoreImages = newImages.length === limit;
      } else {
        hasMoreImages = false;
      }
      loadingMore = false;
    } else {
      images = newImages;
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

function startAutoRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
  if (mode !== 'aus') {
    refreshInterval = setInterval(() => {
      console.log('NewsFlash: Auto-refresh triggered');
      fetchImages();
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
  fetchImages();
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
        <div class="newsflash-strip" tabindex="0" on:scroll={handleScroll}>
          <div class="newsflash-time">{lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} {displayedImageCount}/{$galleryStats.totalCount}</div>
          {#each images as img (img.id)}
            <div class="newsflash-thumb" on:click={() => handleImageClick(img)} tabindex="0" role="button" aria-label={img.title || img.original_name || 'Bild'}>
              <img src={"https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-512/" + img.path_512} alt={img.title || img.original_name || 'Bild'} />
              {#if showDistance && userLat !== null && userLon !== null && img.lat && img.lon && getDistanceFromLatLonInMeters}
                <div class="gallery-distance">
                  {getDistanceFromLatLonInMeters(userLat, userLon, img.lat, img.lon)}
                </div>
              {/if}
            </div>
          {/each}
          {#if loadingMore}
            <div class="newsflash-loading-more">Lade mehr...</div>
          {/if}
        </div>
      {:else if layout === 'grid'}
        <div class="newsflash-grid" tabindex="0" on:scroll={handleScroll}>
          <div class="newsflash-time">{lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} {displayedImageCount}/{$galleryStats.totalCount}</div>
          {#each images as img (img.id)}
            <div class="newsflash-thumb" on:click={() => handleImageClick(img)} tabindex="0" role="button" aria-label={img.title || img.original_name || 'Bild'}>
              <img src={"https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-512/" + img.path_512} alt={img.title || img.original_name || 'Bild'} />
              {#if showDistance && userLat !== null && userLon !== null && img.lat && img.lon && getDistanceFromLatLonInMeters}
                <div class="gallery-distance">
                  {getDistanceFromLatLonInMeters(userLat, userLon, img.lat, img.lon)}
                </div>
              {/if}
            </div>
          {/each}
          {#if loadingMore}
            <div class="newsflash-loading-more">Lade mehr...</div>
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
  .newsflash-grid .newsflash-thumb,
  .newsflash-grid .newsflash-thumb img {
    width: 100px;
    height: 100px;
  }
}
@media (max-width: 480px) {
  .newsflash-grid .newsflash-thumb,
  .newsflash-grid .newsflash-thumb img {
    width: 80px;
    height: 80px;
  }
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
  scroll-snap-align: start;
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
  scroll-snap-align: start;
  margin: 0;
  padding: 0;
  overflow: hidden;
  position: relative;
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


</style> 