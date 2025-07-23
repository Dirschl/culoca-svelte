<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { get } from 'svelte/store';
  import GalleryLayout from './GalleryLayout.svelte';
  import { galleryItems, isGalleryLoading, galleryTotalCount, hasMoreGalleryItems, loadMoreGallery, resetGallery } from './galleryStore';
  import { updateGalleryStats } from '$lib/galleryStats';
  
  export let useJustifiedLayout = true;
  export let showDistance = true;
  export let showCompass = false;
  export let userLat: number | null = null;
  export let userLon: number | null = null;
  export let getDistanceFromLatLonInMeters: any;
  export let filterStore;
  export let sessionStore;

  let displayedImageCount = 0;
  let scrollTimeout: any = null;

  // Reactive statement to update stats when gallery items change
  $: {
    displayedImageCount = $galleryItems.length;
    updateGalleryStats($galleryTotalCount, displayedImageCount);
  }

  function handleScroll() {
    if (scrollTimeout) clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      if ((window.innerHeight + window.scrollY) >= (document.documentElement.scrollHeight - 1000)) {
        if ($hasMoreGalleryItems && !$isGalleryLoading) {
          console.log('[NormalGallery] Loading more images via galleryStore');
          loadMoreGallery({
            lat: userLat || undefined,
            lon: userLon || undefined
          });
        }
      }
    }, 100);
  }

  onMount(() => {
    console.log('[NormalGallery] Component mounted');
    
    // Scroll-Handler hinzufügen
    window.addEventListener('scroll', handleScroll);
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimeout) clearTimeout(scrollTimeout);
    };
  });

  onDestroy(() => {
    if (scrollTimeout) clearTimeout(scrollTimeout);
  });
</script>

{#if $galleryItems.length > 0}
  <GalleryLayout 
    items={$galleryItems}
    layout={useJustifiedLayout ? 'justified' : 'grid'}
    {showDistance}
    {showCompass}
    {userLat}
    {userLon}
    {getDistanceFromLatLonInMeters}
  />
{:else if $isGalleryLoading}
  <div class="loading-container">
    <div class="spinner"></div>
    <p>Lade Galerie...</p>
  </div>
{:else}
  <div class="no-images">
    <h3>Keine Bilder gefunden</h3>
    <p>Es wurden keine Bilder in der Galerie gefunden.</p>
  </div>
{/if}

{#if $isGalleryLoading && $galleryItems.length > 0}
  <div class="loading-more">
    <div class="spinner-small"></div>
    <span>Lade weitere Bilder...</span>
  </div>
{/if}

<style>
  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 2rem;
    text-align: center;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid var(--border-color);
    border-top: 4px solid var(--accent-color);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 1rem;
  }

  .loading-more {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    gap: 0.5rem;
    color: var(--text-secondary);
  }

  .spinner-small {
    width: 20px;
    height: 20px;
    border: 2px solid var(--border-color);
    border-top: 2px solid var(--accent-color);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .no-images {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 2rem;
    text-align: center;
    color: var(--text-secondary);
  }

  .no-images h3 {
    margin-bottom: 1rem;
    color: var(--text-primary);
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
</style> 