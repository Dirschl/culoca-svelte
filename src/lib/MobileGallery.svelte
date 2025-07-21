<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { writable, get } from 'svelte/store';
  import GalleryLayout from './GalleryLayout.svelte';
  export let userLat: number | null = null;
  export let userLon: number | null = null;
  export let useJustifiedLayout = true;
  export let showDistance = true;
  export let showCompass = false;
  export let getDistanceFromLatLonInMeters: any;
  export let filterStore;
  export let sessionStore;
  export let dynamicLoader;

  const gridItems = writable<any[]>([]);
  let loading = false;
  let displayedImageCount = 0;
  let rotation = 0;
  let rotationSpeed = 1;
  let rotationInterval: any = null;

  function startContinuousRotation() {
    if (rotationInterval) clearInterval(rotationInterval);
    rotationInterval = setInterval(() => {
      rotation += rotationSpeed;
      if (rotation >= 360) rotation = 0;
    }, 50);
  }
  function stopContinuousRotation() {
    if (rotationInterval) clearInterval(rotationInterval);
    rotationInterval = null;
    rotation = 0;
  }
  function increaseRotationSpeed() {
    rotationSpeed = Math.min(rotationSpeed + 1, 10);
  }

  async function loadInitialGridImages(lat: number, lon: number) {
    loading = true;
    dynamicLoader.setCurrentUserId(get(sessionStore).isAuthenticated ? get(sessionStore).userId : null);
    await dynamicLoader.loadImagesForPosition(lat, lon);
    // Warte, bis DynamicLoader keine Ladejobs mehr in der Queue hat
    let previousCount = -1;
    for (let i = 0; i < 20; i++) {
      await new Promise(res => setTimeout(res, 100));
      const currentCount = dynamicLoader.getImageCount();
      if (currentCount === previousCount && !dynamicLoader.getDebugInfo().isLoading) break;
      previousCount = currentCount;
    }
    const gridImages = dynamicLoader.getAllImages();
    const converted = gridImages.map((img: any) => {
      let bestSrc = '';
      if (img.path_512) {
        bestSrc = `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-512/${img.path_512}`;
      } else if (img.path_2048) {
        bestSrc = `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-2048/${img.path_2048}`;
      } else if (img.path_64) {
        bestSrc = `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-64/${img.path_64}`;
      }
      return {
        id: img.id,
        src: bestSrc,
        srcHD: img.path_2048 ? `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-2048/${img.path_2048}` : bestSrc,
        width: img.width && img.width > 0 ? img.width : 400,
        height: img.height && img.height > 0 ? img.height : 300,
        lat: img.lat,
        lon: img.lon,
        title: img.title,
        description: img.description,
        keywords: img.keywords,
        path_64: img.path_64,
        path_512: img.path_512,
        path_2048: img.path_2048
      };
    }).filter((p: any) => p.src);
    // Sort by distance (closest first)
    if (lat !== null && lon !== null) {
      converted.sort((a: any, b: any) => {
        if (!a.lat || !a.lon || !b.lat || !b.lon) return 0;
        const da = a.lat && a.lon ? getDistanceFromLatLonInMeters(lat, lon, a.lat, a.lon) : Number.MAX_VALUE;
        const db = b.lat && b.lon ? getDistanceFromLatLonInMeters(lat, lon, b.lat, b.lon) : Number.MAX_VALUE;
        return da - db;
      });
    }
    gridItems.set(converted);
    displayedImageCount = converted.length;
    loading = false;
  }

  onMount(() => {
    if (userLat !== null && userLon !== null) {
      loadInitialGridImages(userLat, userLon);
      startContinuousRotation();
    }
    return () => {
      stopContinuousRotation();
    };
  });
</script>

<GalleryLayout
  items={$gridItems}
  layout={useJustifiedLayout ? 'justified' : 'grid'}
  gap={2}
  targetRowHeight={220}
  showDistance={showDistance}
  showCompass={showCompass}
  userLat={userLat}
  userLon={userLon}
  getDistanceFromLatLonInMeters={getDistanceFromLatLonInMeters}
/>

{#if loading}
  <div class="loading-indicator">
    <div class="spinner"></div>
  </div>
{:else if $gridItems.length > 0}
  <div class="end-indicator">
    <span>✅ {displayedImageCount} Bilder angezeigt</span>
  </div>
{/if}

{#if !loading && $gridItems.length === 0}
  <div class="simple-empty-message">
    <p>Noch keine Bilder in dieser Region erfasst. Lade deine eigenen Fotos mit GPS-Daten hoch und werde der erste, der diese Region auf Culoca präsentiert.</p>
  </div>
{/if}

<style>
  .loading-indicator { display: flex; justify-content: center; align-items: center; padding: 2rem; }
  .spinner { width: 32px; height: 32px; border: 4px solid var(--border-color); border-top: 4px solid var(--accent-color); border-radius: 50%; animation: spin 1s linear infinite; }
  @keyframes spin { 100% { transform: rotate(360deg); } }
  .end-indicator { text-align: center; color: var(--text-secondary); margin: 1rem 0; }
  .simple-empty-message { text-align: center; color: var(--text-secondary); margin: 2rem 0; }
</style> 