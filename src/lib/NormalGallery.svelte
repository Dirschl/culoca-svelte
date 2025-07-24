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
  export let originalGalleryLat: number | null = null;
  export let originalGalleryLon: number | null = null;
  export let getDistanceFromLatLonInMeters: any;
  export let filterStore;
  export let sessionStore;

  let displayedImageCount = 0;
  let scrollTimeout: any = null;
  let lastScrollTime = 0;
  let lastScrollTop = 0;
  let scrollVelocity = 0;

  // Reactive statement to update stats when gallery items change
  $: {
    displayedImageCount = $galleryItems.length;
    updateGalleryStats($galleryTotalCount, displayedImageCount);
      }
      
  // WICHTIG: Reagiere auf Filter-Änderungen und lade neue Daten
  $: if (filterStore && $filterStore.locationFilter) {
    console.log('[NormalGallery] Location filter changed, resetting gallery:', $filterStore.locationFilter);
    resetGallery({
      lat: $filterStore.locationFilter.lat,
      lon: $filterStore.locationFilter.lon,
      fromItem: true // explizit setzen!
    });
  }

  function handleScroll() {
    if (scrollTimeout) clearTimeout(scrollTimeout);
    
    // Berechne Scroll-Geschwindigkeit
    const now = Date.now();
    const currentScrollTop = window.scrollY;
    const timeDiff = now - lastScrollTime;
    const scrollDiff = Math.abs(currentScrollTop - lastScrollTop);
    
    if (timeDiff > 0) {
      scrollVelocity = scrollDiff / timeDiff; // Pixel pro Millisekunde
    }
    
    lastScrollTime = now;
    lastScrollTop = currentScrollTop;
    
    scrollTimeout = setTimeout(() => {
      // Dynamische Schwelle basierend auf Scroll-Geschwindigkeit
      const baseThreshold = 2000; // Erhöht auf 2000px vor Ende
      const velocityMultiplier = Math.min(scrollVelocity * 1000, 2000); // Max 2000px zusätzlich
      const dynamicThreshold = baseThreshold + velocityMultiplier;
      
      const scrollHeight = document.documentElement.scrollHeight;
      const scrollTop = window.innerHeight + window.scrollY;
      const threshold = scrollHeight - dynamicThreshold;
      
      if (scrollTop >= threshold) {
        if ($hasMoreGalleryItems && !$isGalleryLoading) {
          console.log(`[NormalGallery] Loading more images (threshold: ${Math.round(dynamicThreshold)}px, velocity: ${scrollVelocity.toFixed(3)})`);
          
          // Use location filter coordinates if available, otherwise fall back to user coordinates
          const apiLat = $filterStore.locationFilter?.lat || userLat;
          const apiLon = $filterStore.locationFilter?.lon || userLon;
          
          loadMoreGallery({
            lat: apiLat || undefined,
            lon: apiLon || undefined
          });
    }
      }
    }, 25); // Reduziert von 50ms auf 25ms für noch schnellere Reaktion
  }

  onMount(() => {
    console.log('[NormalGallery] Component mounted');
    
    // Nur initial laden, wenn KEIN Location-Filter aktiv ist!
    if ($galleryItems.length === 0 && !$isGalleryLoading && !$filterStore.locationFilter) {
      console.log('[NormalGallery] Triggering initial gallery load (no location filter)');
      
      // Use user coordinates for initial load when no location filter
      loadMoreGallery({
        lat: userLat || undefined,
        lon: userLon || undefined
      });
    } else if ($filterStore.locationFilter) {
      console.log('[NormalGallery] Skipping initial load - location filter active:', $filterStore.locationFilter);
    }
    
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
  </div>
{:else}
  <div>Keine Bilder gefunden.</div>
{/if}

{#if $isGalleryLoading && $galleryItems.length > 0}
  <div class="loading-more">
    <div class="spinner-small"></div>
    <span>Weitere Bilder werden geladen...</span>
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