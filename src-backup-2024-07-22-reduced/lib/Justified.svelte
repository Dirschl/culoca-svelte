<script lang="ts">
  import { onMount } from 'svelte';
  import justifiedLayout from 'justified-layout';

  // Typen für justified-layout
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

  export let items: { src: string; width: number; height: number; id: string; lat?: number; lon?: number; distance?: number }[] = [];
  
  // Debug: Log items when they change
  $: if (items.length > 0) {
    console.log(`[Justified] Received ${items.length} items, first 3 distances:`, items.slice(0, 3).map(item => ({
      id: item.id,
      distance: item.distance,
      lat: item.lat,
      lon: item.lon
    })));
    
    // Check if distances are actually present
    const itemsWithDistance = items.filter(item => item.distance !== undefined && item.distance !== null);
    console.log(`[Justified] Items with distance: ${itemsWithDistance.length}/${items.length}`);
    
    if (itemsWithDistance.length > 0) {
      console.log(`[Justified] First item with distance:`, itemsWithDistance[0]);
    }
  }
  
  // Simple debug to check if component loads
  console.log('[Justified] Component loaded');
  export let containerWidth = 1024;
  export let targetRowHeight = 200;  // Will be adjusted responsively
  export let gap = 2;  // Set default gap to 2px
  export let showDistance: boolean = false;
  export let userLat: number | null = null;
  export let userLon: number | null = null;
  export let getDistanceFromLatLonInMeters: ((lat1: number, lon1: number, lat2: number, lon2: number) => string) | null = null;
  export let showCompass: boolean = false;

  let boxes: LayoutBox[] = [];
  let layout: JustifiedLayoutResult = { boxes: [], containerHeight: 0, widowCount: 0 };
  let deviceHeading: number | null = null;
  
  // Responsive target row height calculation
  $: responsiveTargetRowHeight = (() => {
    if (containerWidth <= 480) {
      return 120; // Mobile: smaller height for more images per row
    } else if (containerWidth <= 768) {
      return 150; // Tablet: medium height
    } else {
      return 200; // Desktop: original height
    }
  })();

  // Reactive layout calculation
  $: if (items.length > 0 && containerWidth > 0) {
    try {
      const inputItems = items.map((item) => ({ 
        width: item.width || 400, 
        height: item.height || 300 
      }));
      
      layout = justifiedLayout(inputItems, { 
        containerWidth, 
        targetRowHeight: responsiveTargetRowHeight, 
        boxSpacing: gap,
        containerPadding: 0,
        maxNumRows: 100,  // Allow many rows
        forceAspectRatio: false,  // Keep original aspect ratios
        showWidows: true,  // Show incomplete last row
        fullWidthBreakoutRowCadence: false  // No full-width rows
      });
      
      boxes = layout.boxes || [];
      
      console.log('Stock-style layout calculated:', {
        itemCount: items.length,
        containerWidth,
        targetRowHeight: responsiveTargetRowHeight,
        boxes: boxes.length,
        containerHeight: layout.containerHeight
      });
    } catch (error) {
      console.error('Error calculating justified layout:', error);
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
  
  function handleOrientation(event: DeviceOrientationEvent) {
    if (event.absolute && typeof event.alpha === 'number') {
      deviceHeading = 360 - event.alpha;
    }
  }
  
  onMount(() => {
    resize();
    window.addEventListener('resize', resize);
    
    // Also resize when images load
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

  function handleImageClick(itemId: string) {
    // Navigate to item detail page with anchor parameter
    const url = new URL(`/item/${itemId}`, window.location.origin);
    url.searchParams.set('anchor', itemId);
    location.href = url.toString();
  }

  function handleKeydown(event: KeyboardEvent, itemId: string) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleImageClick(itemId);
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
  .gallery { 
    position: relative; 
    width: 100%;
    min-height: 200px;
    padding: 0 !important;
    margin: 0 !important;
    border: none !important;
    background: var(--bg-primary) !important;
    box-shadow: none !important;
    overflow: hidden;
  }
  .pic-container {
    position: absolute;
    cursor: pointer;
    overflow: hidden;
    transition: box-shadow 0.3s ease, background-color 0.3s ease;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    background: var(--bg-secondary);
  }

  .pic-container:focus {
    outline: none;
  }
  .pic-container:hover {
    box-shadow: 0 4px 16px rgba(0,0,0,0.18);
    background: transparent;
  }
  .pic {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    transition: transform 0.3s cubic-bezier(.4,0,.2,1);
    background: transparent;
  }
  .pic-container:hover .pic {
    transform: scale(1.02);
  }
  .debug-info {
    position: fixed;
    top: 10px;
    right: 10px;
    background: rgba(0,0,0,0.8);
    color: white;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 11px;
    font-family: monospace;
    z-index: 1000;
    pointer-events: none;
  }
  .distance-label {
    position: absolute;
    left: 8px;
    bottom: 8px;
    background: rgba(0,0,0,0.55);
    backdrop-filter: blur(4px);
    color: #fff;
    font-size: 0.7rem;
    font-weight: 500;
    border-radius: 6px;
    padding: 1px 8px;
    z-index: 2;
    pointer-events: none;
  }

  /* Mobile distance label optimization */
  @media (max-width: 768px) {
    .distance-label {
      font-size: 0.75rem;
      padding: 2px 10px;
      left: 10px;
      bottom: 10px;
      border-radius: 8px;
    }
  }

  @media (max-width: 480px) {
    .distance-label {
      font-size: 0.8rem;
      padding: 2px 12px;
      left: 12px;
      bottom: 12px;
      border-radius: 10px;
    }
  }
  .justified-grid {
    width: 100%;
    margin: 0;
    padding: 0;
    border: none;
    background: transparent;
    box-shadow: none;
  }
</style>

<div bind:this={galleryEl}
     class="gallery"
     style="height:{layout.containerHeight}px;">
  

  
  {#if boxes.length > 0}
    {#each items as item, i}
      {#if boxes[i]}
        <div
          class="pic-container"
          role="button"
          tabindex="0"
          aria-label="View image {item.id}"
          style="
            left:{boxes[i].left}px;
            top:{boxes[i].top}px;
            width:{boxes[i].width}px;
            height:{boxes[i].height}px;
          "
          on:click={() => handleImageClick(item.id)}
          on:keydown={(e) => handleKeydown(e, item.id)}
        >
          <img
            class="pic"
            src={item.src}
            alt="Gallery image {item.id}"
            loading="lazy"
          />
          {#if showDistance && userLat !== null && userLon !== null && item.lat && item.lon}
            <div class="distance-label">
              {#if item.distance !== undefined && item.distance !== null}
                {#if item.distance < 1000}
                  {Math.round(item.distance)}m
                {:else}
                  {(item.distance / 1000).toFixed(1)}km
                {/if}
              {:else if getDistanceFromLatLonInMeters}
                <!-- Temporär auskommentiert - verwendet falsche GPS-Koordinaten -->
                <!-- {getDistanceFromLatLonInMeters(userLat, userLon, item.lat, item.lon)}+ -->
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
        </div>
      {/if}
    {/each}
  {:else}
    <div style="padding: 40px; text-align: center; color: #666; font-size: 16px;">
      {items.length === 0 ? '📷 No images to display' : '⚙️ Calculating Stock-style layout...'}
    </div>
  {/if}
</div>
