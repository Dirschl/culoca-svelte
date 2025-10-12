<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import justifiedLayout from 'justified-layout';

  // Types for justified-layout
  interface LayoutBox {
    aspectRatio: number;
    top: number;
    width: number;
    height: number;
    left: number;
    row?: number;
  }
  interface JustifiedLayoutResult {
    containerHeight: number;
    widowCount: number;
    boxes: LayoutBox[];
  }

  export let items: { 
    src: string; 
    width: number; 
    height: number; 
    id: string; 
    lat?: number; 
    lon?: number; 
    distance?: number;
    title?: string;
    slug?: string; // Added slug to the interface
  }[] = [];
  export let layout: 'justified' | 'grid' = 'justified';
  export let containerWidth = 1200; // Set a reasonable default width
  export let targetRowHeight = 200;
  export let gap = 2;
  export let showDistance: boolean = false;
  export let showImageCaptions: boolean = true;
  export let userLat: number | null = null;
  export let userLon: number | null = null;
  export let getDistanceFromLatLonInMeters: ((lat1: number, lon1: number, lat2: number, lon2: number) => string) | null = null;
  export let showCompass: boolean = false;
  export let onImageClick: ((itemId: string) => void) | null = null;
  export let showGalleryToggle: boolean = false;
  export let onGalleryToggle: ((itemId: string, newGalleryValue: boolean) => void) | null = null;
  export let getGalleryStatus: ((itemId: string) => boolean) | null = null;
  export let forceReload: boolean = false; // Force window.location.href for detail page navigation

  let boxes: LayoutBox[] = [];
  let layoutResult: JustifiedLayoutResult = { boxes: [], containerHeight: 0, widowCount: 0 };
  let deviceHeading: number | null = null;
  let isInitialized = false; // Track if layout has been initialized
  
  // Responsive target row height calculation
  $: responsiveTargetRowHeight = (() => {
    if (containerWidth <= 480) {
      return 120;
    } else if (containerWidth <= 768) {
      return 150;
    } else {
      return 200;
    }
  })();

  // Reactive layout calculation for justified layout
  $: if (layout === 'justified' && items.length > 0 && containerWidth > 0) {
    try {
      const inputItems = items.map((item) => ({ 
        width: item.width || 400, 
        height: item.height || 300 
      }));
      
      layoutResult = justifiedLayout(inputItems, { 
        containerWidth: containerWidth, 
        targetRowHeight: responsiveTargetRowHeight, 
        boxSpacing: gap,
        containerPadding: 0,
        maxNumRows: Infinity, // Unbegrenzt für beliebig viele Bilder
        forceAspectRatio: false,
        showWidows: true,
        fullWidthBreakoutRowCadence: false
      });
      
      boxes = layoutResult.boxes || [];
      isInitialized = true;
    } catch (error) {
      console.error('[GalleryLayout] Error calculating justified layout:', error);
      boxes = [];
    }
  }



  let galleryEl: HTMLDivElement;
  
  function resize() {
    if (galleryEl) {
      const newWidth = galleryEl.clientWidth;
      if (newWidth !== containerWidth && newWidth > 0) {
        containerWidth = newWidth;
      }
    }
  }

  // Initialize container width immediately if possible
  function initializeWidth() {
    if (galleryEl && galleryEl.clientWidth > 0) {
      containerWidth = galleryEl.clientWidth;
    } else if (typeof window !== 'undefined') {
      // Fallback to window width for initial render
      containerWidth = window.innerWidth;
    }
  }
  
  function handleOrientation(event: DeviceOrientationEvent) {
    if (event.absolute && typeof event.alpha === 'number') {
      deviceHeading = 360 - event.alpha;
    }
  }
  
  onMount(() => {
    initializeWidth(); // Call initializeWidth on mount
    resize(); // Also call resize to ensure proper sizing
    window.addEventListener('resize', resize);
    
    const resizeObserver = new ResizeObserver(() => {
      resize();
    });
    
    if (galleryEl) {
      resizeObserver.observe(galleryEl);
    }
    
    if (showCompass && window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientationabsolute', handleOrientation, true);
      window.addEventListener('deviceorientation', handleOrientation, true);
    }
    
    return () => {
      window.removeEventListener('resize', resize);
      resizeObserver.disconnect();
      window.removeEventListener('deviceorientationabsolute', handleOrientation, true);
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  });

  function handleImageClick(itemSlug: string) {
    const item = items.find(item => item.slug === itemSlug);
    if (item && item.slug) {
      console.log('[GalleryLayout] Click detected for item:', itemSlug);
      console.log('[GalleryLayout] Item found:', item);
      console.log('[GalleryLayout] Attempting navigation to:', `/item/${item.slug}`);
      
      // Use SvelteKit goto for proper navigation (like main page)
      goto(`/item/${item.slug}`);
      console.log('[GalleryLayout] goto() called successfully');
    } else {
      console.error('[GalleryLayout] Item not found for slug:', itemSlug);
    }
  }

  function handleKeydown(event: KeyboardEvent, itemSlug: string) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const item = items.find(item => item.slug === itemSlug);
      if (item && item.slug) {
        console.log('[GalleryLayout] Keyboard navigation for item:', itemSlug);
        console.log('[GalleryLayout] Attempting navigation to:', `/item/${item.slug}`);
        
        // Use SvelteKit goto for proper navigation
        goto(`/item/${item.slug}`);
        
        console.log('[GalleryLayout] goto() called successfully');
      } else {
        console.error('[GalleryLayout] Item not found for keyboard navigation:', itemSlug);
      }
    }
  }

  function handleGalleryToggle(event: Event, itemId: string) {
    event.preventDefault();
    event.stopPropagation();
    
    if (onGalleryToggle && getGalleryStatus) {
      const currentStatus = getGalleryStatus(itemId);
      const newStatus = !currentStatus;
      onGalleryToggle(itemId, newStatus);
    }
  }

  function getAzimuth(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const toRad = (deg: number) => deg * Math.PI / 180;
    const dLon = toRad(lon2 - lon1);
    const y = Math.sin(dLon) * Math.cos(toRad(lat2));
    const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
    let brng = Math.atan2(y, x) * 180 / Math.PI;
    brng = (brng + 360) % 360;
    return brng;
  }
</script>

<style>

  .gallery-container {
    width: 100%;
    margin: 0;
    padding: 0;
    border: none;
    box-shadow: none;
  }

  /* Justified Layout Styles */
  .justified-wrapper {
    width: 100%;
  }

  .justified-gallery {
    position: relative;
    width: 100%;
    min-height: 200px;
    padding: 0 !important;
    margin: 0 !important;
    border: none !important;
    background: transparent !important;
    box-shadow: none !important;
    overflow: hidden;
  }

  .justified-pic-container {
    position: absolute;
    cursor: pointer;
    overflow: hidden;
    transition: box-shadow 0.3s ease, background-color 0.3s ease;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    background: var(--bg-secondary);
  }

  .justified-pic-container:focus {
    outline: none;
  }

  .justified-pic-container:hover {
    box-shadow: 0 4px 16px rgba(0,0,0,0.18);
    background: transparent;
  }

  .justified-pic {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    transition: transform 0.3s cubic-bezier(.4,0,.2,1);
    background: transparent;
  }

  .justified-pic-container:hover .justified-pic {
    transform: scale(1.02);
  }

  /* Grid Layout Styles */
  .grid-layout {
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
    .grid-layout {
      grid-template-columns: repeat(2, 1fr);
      gap: 1px;
    }
  }

  @media (max-width: 480px) {
    .grid-layout {
      grid-template-columns: repeat(2, 1fr);
      gap: 1px;
    }
  }

  .grid-item {
    background: var(--bg-secondary);
    border-radius: 0;
    overflow: hidden;
    transition: box-shadow 0.2s, transform 0.2s, background-color 0.3s ease;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    aspect-ratio: 1/1;
    position: relative;
  }

  .grid-item:focus {
    outline: none;
  }

  @media (max-width: 768px) {
    .grid-item {
      aspect-ratio: 1/1;
      border-radius: 0;
    }
  }

  .grid-item img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    transition: transform 0.3s cubic-bezier(.4,0,.2,1);
  }

  .grid-item:hover img {
    transform: scale(1.04);
  }

  .gallery-caption-overlay {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background: var(--bg-overlay, rgba(0, 0, 0, 0.7));
    color: var(--text-overlay, white);
    font-size: 0.75rem;
    padding: 4px 6px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    pointer-events: none;
    backdrop-filter: blur(4px);
  }

  .gallery-distance-topright {
    position: absolute;
    top: 0;
    right: 0;
    background: var(--bg-secondary);
    color: var(--text-primary);
    border-color: var(--border-color);
    padding: 0 4px;
    font-size: 12.5px;
    font-weight: 600;
    z-index: 2;
    pointer-events: none;
  }



  /* Empty state */
  .empty-state {
    padding: 40px;
    text-align: center;
    color: #666;
    font-size: 16px;
  }

  /* Gallery Toggle Button Styles - Dark/Light Mode Design */
  .gallery-toggle-btn {
    position: absolute;
    top: 0px;
    left: 0px;
    background: var(--bg-secondary);
    color: var(--text-primary);
    /* border: 1px solid var(--border-color); */
    /* border-radius: 6px; */
    padding: 3px 4px 4px 3px;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2;
    /* opacity: 0.8; */
  }

  .gallery-toggle-btn:hover {
    background: var(--bg-tertiary);
    border-color: var(--text-primary);
    transform: scale(1.05);
    opacity: 1;
  }

  .gallery-toggle-btn.active {
    background: var(--bg-secondary);
    color: var(--text-primary);
    border-color: var(--border-color);
  }

  .gallery-toggle-btn.active:hover {
    background: var(--bg-tertiary);
    border-color: var(--text-primary);
  }

  /* Mobile optimization for toggle button */
  @media (max-width: 768px) {
    .gallery-toggle-btn {
      top: 0px;
      left: 0px;
      padding: 2px 3px 3px 2px;
    }
  }

  @media (max-width: 480px) {
    .gallery-toggle-btn {
      top: 0px;
      left: 0px;
      padding: 2px 3px 3px 2px;
    }
  }
</style>

<div bind:this={galleryEl} class="gallery-container">
  {#if layout === 'justified'}
    <div class="justified-wrapper">
      <div 
        class="justified-gallery" 
        style="height: {isInitialized ? layoutResult.containerHeight : 'auto'}px;"
      >
        {#if isInitialized && boxes.length > 0}
          {#each items as item, index}
            {#if boxes[index]}
              <a 
                href={`/item/${item.slug}`}
                class="justified-pic-container" 
                role="button" 
                tabindex="0" 
                aria-label="View image {item.id}" 
                style="left:{boxes[index].left}px; top:{boxes[index].top}px; width:{boxes[index].width}px; height:{boxes[index].height}px;"
                title={item.title || ''}
                on:click|preventDefault={async (e) => {
                  if (forceReload) {
                    // Force full page reload for detail page navigation
                    window.location.href = `/item/${item.slug}`;
                  } else {
                    // Use SvelteKit navigation for main page navigation
                    await goto(`/item/${item.slug}`, { invalidateAll: true });
                  }
                }}
              >
                <img 
                  class="justified-pic" 
                  src={item.src} 
                  alt="" 
                  loading="lazy"
                />
                {#if showImageCaptions && item.title}
                  <div class="gallery-caption-overlay">
                    {item.title}
                  </div>
                {/if}
                {#if showDistance && userLat !== null && userLon !== null && item.lat && item.lon}
                  <div class="gallery-distance-topright">
                    {#if item.distance !== undefined && item.distance !== null}
                      <!-- Use API distance when available (prioritized) -->
                      {#if item.distance < 1000}
                        {Math.round(item.distance)}m
                      {:else}
                        {(item.distance / 1000).toFixed(1)}km
                      {/if}
                    {:else if getDistanceFromLatLonInMeters}
                      <!-- Fallback to frontend calculation when API distance not available -->
                      {getDistanceFromLatLonInMeters(userLat, userLon, item.lat, item.lon)}
                    {/if}
                  </div>
                {/if}
                {#if showCompass && userLat !== null && userLon !== null && item.lat && item.lon && deviceHeading !== null}
                  <div class="compass" style="position: absolute; left: 12px; bottom: 48px; z-index: 3;">
                    <svg width="36" height="36" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="16" fill="rgba(24,24,40,0.55)" stroke="#fff" stroke-width="2" />
                      <g transform="rotate({getAzimuth(userLat, userLon, item.lat, item.lon) - deviceHeading}, 18, 18)">
                        <polygon points="18,6 24,24 18,20 12,24" fill="#ff5252" />
                      </g>
                    </svg>
                  </div>
                {/if}
                {#if showGalleryToggle && onGalleryToggle && getGalleryStatus}
                  <button 
                    class="gallery-toggle-btn" 
                    on:click={(e) => handleGalleryToggle(e, item.id)} 
                    title="Aus Galerie entfernen/hinzufügen" 
                    class:active={getGalleryStatus(item.id)}
                  >
                    {#if getGalleryStatus(item.id)}
                      <!-- 3x3 Grid für Gallery true -->
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="3" y="3" width="4" height="4"/>
                        <rect x="10" y="3" width="4" height="4"/>
                        <rect x="17" y="3" width="4" height="4"/>
                        <rect x="3" y="10" width="4" height="4"/>
                        <rect x="10" y="10" width="4" height="4"/>
                        <rect x="17" y="10" width="4" height="4"/>
                        <rect x="3" y="17" width="4" height="4"/>
                        <rect x="10" y="17" width="4" height="4"/>
                        <rect x="17" y="17" width="4" height="4"/>
                      </svg>
                    {:else}
                      <!-- Einfaches Rechteck für Gallery false -->
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="4" y="4" width="16" height="16" stroke="currentColor" stroke-width="1" fill="none"/>
                      </svg>
                    {/if}
                  </button>
                {/if}
              </a>
            {/if}
          {/each}
        {:else}
          <div class="empty-state">
            {items.length === 0 ? '📷 No images to display' : '⚙️ Calculating layout...'}
          </div>
        {/if}
      </div>
    </div>
  {:else}
    <!-- Grid Layout -->
    <div class="grid-layout">
      {#each items as item}
        <a 
          href={`/item/${item.slug}`}
          class="grid-item" 
          tabindex="0" 
          role="button" 
          aria-label="View image {item.slug}"
          title={item.title || ''}
          on:click|preventDefault={async (e) => {
            console.log('🔍 [GalleryLayout] Clicked item slug:', item.slug);
            if (forceReload) {
              // Force full page reload for detail page navigation
              window.location.href = `/item/${item.slug}`;
            } else {
              // Use SvelteKit navigation for main page navigation
              await goto(`/item/${item.slug}`, { invalidateAll: true });
            }
          }}
        >
          <img 
            src={item.src}
            alt="" 
            loading="lazy"
          />
          {#if showImageCaptions && item.title}
            <div class="gallery-caption-overlay">
              {item.title}
            </div>
          {/if}
          {#if showDistance && userLat !== null && userLon !== null && item.lat && item.lon}
            <div class="gallery-distance-topright">
              {#if item.distance !== undefined && item.distance !== null}
                <!-- Use API distance when available (prioritized) -->
                {#if item.distance < 1000}
                  {Math.round(item.distance)}m
                {:else}
                  {(item.distance / 1000).toFixed(1)}km
                {/if}
              {:else if getDistanceFromLatLonInMeters}
                <!-- Fallback to frontend calculation when API distance not available -->
                {getDistanceFromLatLonInMeters(userLat, userLon, item.lat, item.lon)}
              {/if}
            </div>
          {/if}
          {#if showGalleryToggle && onGalleryToggle && getGalleryStatus}
            <button 
              class="gallery-toggle-btn" 
              on:click={(e) => handleGalleryToggle(e, item.id)} 
              title="Aus Galerie entfernen/hinzufügen" 
              class:active={getGalleryStatus(item.id)}
            >
              {#if getGalleryStatus(item.id)}
                <!-- 3x3 Grid für Gallery true -->
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="3" y="3" width="4" height="4"/>
                  <rect x="10" y="3" width="4" height="4"/>
                  <rect x="17" y="3" width="4" height="4"/>
                  <rect x="3" y="10" width="4" height="4"/>
                  <rect x="10" y="10" width="4" height="4"/>
                  <rect x="17" y="10" width="4" height="4"/>
                  <rect x="3" y="17" width="4" height="4"/>
                  <rect x="10" y="17" width="4" height="4"/>
                  <rect x="17" y="17" width="4" height="4"/>
                </svg>
              {:else}
                <!-- Einfaches Rechteck für Gallery false -->
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="4" y="4" width="16" height="16" stroke="currentColor" stroke-width="1" fill="none"/>
                </svg>
              {/if}
            </button>
          {/if}
        </a>
      {/each}
    </div>
  {/if}
</div> 