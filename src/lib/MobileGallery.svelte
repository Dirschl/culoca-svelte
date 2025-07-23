<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { writable, get } from 'svelte/store';
  import GalleryLayout from './GalleryLayout.svelte';
  import { updateGalleryStats } from '$lib/galleryStats';
  import { supabase } from '$lib/supabaseClient';
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

  // Function to get total image count from database
  async function getTotalImageCount(): Promise<number> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const currentUserId = session?.user?.id || null;
      
      let query = supabase
        .from('items')
        .select('id', { count: 'exact' })
        .not('path_512', 'is', null)
        .eq('gallery', true);
      
      // Apply privacy filtering
      if (currentUserId) {
        query = query.or(`profile_id.eq.${currentUserId},is_private.eq.false,is_private.is.null`);
      } else {
        query = query.or('is_private.eq.false,is_private.is.null');
      }
      
      const { count, error } = await query;
      
      if (error) {
        console.error('[MobileGallery] Error getting total count:', error);
        return 0;
      }
      
      return count || 0;
    } catch (error) {
      console.error('[MobileGallery] Error getting total count:', error);
      return 0;
    }
  }

  // Separate Entfernungsfunktion für Sortierung (gibt Zahl zurück)
  function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Erdradius in Metern
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

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
        const da = a.lat && a.lon ? getDistanceInMeters(lat, lon, a.lat, a.lon) : Number.MAX_VALUE;
        const db = b.lat && b.lon ? getDistanceInMeters(lat, lon, b.lat, b.lon) : Number.MAX_VALUE;
        return da - db;
      });
    }
    gridItems.set(converted);
    displayedImageCount = converted.length;
    
    // Update gallery stats with total count from database
    const totalCount = await getTotalImageCount();
    updateGalleryStats(displayedImageCount, totalCount);
    
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

  // Reaktive Sortierung nach GPS-Position
  $: if (userLat !== null && userLon !== null && $gridItems.length > 0) {
    console.log('[MobileGallery] GPS position changed, re-sorting items by distance');
    
    // Sortiere die vorhandenen Items nach aktueller GPS-Position
    const sortedItems = [...$gridItems].sort((a: any, b: any) => {
      if (!a.lat || !a.lon || !b.lat || !b.lon) return 0;
      
      const distanceA = getDistanceInMeters(userLat, userLon, a.lat, a.lon);
      const distanceB = getDistanceInMeters(userLat, userLon, b.lat, b.lon);
      
      return distanceA - distanceB;
    });
    
    // Nur updaten wenn sich die Reihenfolge geändert hat
    const firstItemChanged = sortedItems.length > 0 && $gridItems.length > 0 && 
                            sortedItems[0].id !== $gridItems[0].id;
    
    if (firstItemChanged) {
      console.log('[MobileGallery] Items re-sorted, closest item is now:', sortedItems[0]?.id);
      gridItems.set(sortedItems);
    }
  }
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