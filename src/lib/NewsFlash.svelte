<script lang="ts">
import { onMount, onDestroy } from 'svelte';
import { goto } from '$app/navigation';
import type { NewsFlashImage } from './types';

// Modus: 'eigene', 'alle', 'aus'
export let mode: 'eigene' | 'alle' | 'aus' = 'alle';
export let userId: string | null = null;
export let layout: 'justified' | 'grid' | 'strip' = 'strip';
export let limit: number = 12;
export let showToggles: boolean = true;

let images: NewsFlashImage[] = [];
let loading = true;
let errorMsg = '';
let mounted = false;
let refreshInterval: number | null = null;
let lastUpdate = new Date();
let lastImageId: string | null = null;

async function fetchImages() {
  let url = `/api/images?limit=${limit}`;
  if (mode === 'eigene' && userId) {
    url += `&user_id=${userId}`;
  }
  console.log('NewsFlash: Fetching images from:', url, 'Mode:', mode, 'UserId:', userId);
  try {
    const res = await fetch(url);
    const data = await res.json();
    console.log('NewsFlash: Response:', data);
    if (data.status === 'success') {
      const newImages = data.images || [];
      
      // Incremental Update: Nur neue Bilder vorne dran setzen
      if (newImages.length > 0 && lastImageId && newImages[0].id !== lastImageId) {
        // Neue Bilder gefunden - nur die neuen vorne dran setzen
        const existingIds = new Set(images.map(img => img.id));
        const newImagesToAdd = newImages.filter(img => !existingIds.has(img.id));
        
        if (newImagesToAdd.length > 0) {
          console.log('NewsFlash: Adding', newImagesToAdd.length, 'new images');
          images = [...newImagesToAdd, ...images].slice(0, limit);
          lastUpdate = new Date();
        }
      } else if (newImages.length > 0 && !lastImageId) {
        // Erster Load
        images = newImages;
        lastUpdate = new Date();
        console.log('NewsFlash: Initial load of', images.length, 'images');
      }
      
      if (newImages.length > 0) {
        lastImageId = newImages[0].id;
      }
      
      loading = false;
      errorMsg = '';
    } else {
      errorMsg = data.message || 'Fehler beim Laden der Bilder.';
      console.log('NewsFlash: Error:', errorMsg);
    }
  } catch (e) {
    errorMsg = 'Netzwerkfehler beim Laden der NewsFlash-Bilder.';
    console.log('NewsFlash: Network error:', e);
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
    }, 30000); // Alle 30 Sekunden
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

$: if (mounted && mode !== 'aus') {
  fetchImages();
  startAutoRefresh();
}

function handleImageClick(img: NewsFlashImage) {
  goto(`/image/${img.id}`);
}

function toggleMode() {
  if (mode === 'alle') mode = 'eigene';
  else if (mode === 'eigene') mode = 'aus';
  else mode = 'alle';
  // fetchImages() wird automatisch durch den reaktiven Block aufgerufen
}

function toggleLayout() {
  if (layout === 'strip') layout = 'justified';
  else if (layout === 'justified') layout = 'grid';
  else layout = 'strip';
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
        <div class="newsflash-strip" tabindex="0">
          <div class="newsflash-time">{lastUpdate.toLocaleTimeString()}</div>
          {#each images as img (img.id)}
            <div class="newsflash-thumb" on:click={() => handleImageClick(img)} tabindex="0" role="button" aria-label={img.title || img.original_name || 'Bild'}>
              <img src={"https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-512/" + img.path_512} alt={img.title || img.original_name || 'Bild'} />
            </div>
          {/each}
        </div>
      {:else if layout === 'grid'}
        <div class="newsflash-grid" tabindex="0">
          <div class="newsflash-time">{lastUpdate.toLocaleTimeString()}</div>
          {#each images as img (img.id)}
            <div class="newsflash-thumb" on:click={() => handleImageClick(img)} tabindex="0" role="button" aria-label={img.title || img.original_name || 'Bild'}>
              <img src={"https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-512/" + img.path_512} alt={img.title || img.original_name || 'Bild'} />
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  </div>
{/if}

<style>
.newsflash-bar {
  width: 100%;
  background: var(--color-bg, #181c24);
  border-bottom: 1px solid #222;
  box-sizing: border-box;
  overflow-x: auto;
  min-height: 80px;
}
.newsflash-toggles {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}
.toggle-btn {
  background: #222;
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 0.25rem 0.75rem;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background 0.2s;
}
.toggle-btn:hover {
  background: #444;
}
.newsflash-loading, .newsflash-error, .newsflash-empty {
  color: #aaa;
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
  padding: 0;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
}
.newsflash-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(256px, 1fr));
  gap: 2px;
  width: 100%;
  margin: 0 auto;
  padding: 0;
  background: transparent;
  border: none;
  box-shadow: none;
}
@media (max-width: 768px) {
  .newsflash-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 1px;
  }
}
@media (max-width: 480px) {
  .newsflash-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 1px;
  }
}
.newsflash-grid .newsflash-thumb {
  aspect-ratio: 1/1;
  width: 100%;
  height: 100%;
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
}
.newsflash-grid .newsflash-thumb:focus, .newsflash-grid .newsflash-thumb:hover {
  outline: none !important;
  border: none !important;
}
.newsflash-grid .newsflash-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  aspect-ratio: 1/1;
  display: block;
  background: #222;
  border-radius: 0;
  margin: 0;
  padding: 0;
  transition: transform 0.3s cubic-bezier(.4,0,.2,1);
}
.newsflash-grid .newsflash-thumb:hover img {
  transform: scale(1.01);
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
  transform: scale(1.02);
}
.newsflash-time {
  color: #4fa3f7;
  font-size: 0.8rem;
  writing-mode: vertical-rl;
  text-orientation: mixed;
  transform: rotate(180deg);
  align-self: flex-end;
  margin-right: 8px;
  font-weight: 500;
  white-space: nowrap;
}
</style> 