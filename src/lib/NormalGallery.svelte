<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { writable, get } from 'svelte/store';
  import GalleryLayout from './GalleryLayout.svelte';
  import { supabase } from '$lib/supabaseClient';
  export let useJustifiedLayout = true;
  export let showDistance = true;
  export let showCompass = false;
  export let userLat: number | null = null;
  export let userLon: number | null = null;
  export let getDistanceFromLatLonInMeters: any;
  export let filterStore;
  export let sessionStore;

  const pics = writable<any[]>([]);
  let page = 0, size = 100, loading = false, hasMoreImages = true;
  let displayedImageCount = 0;

  // Infinite Scroll Handler
  function handleScroll() {
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 300) {
      loadMore();
    }
  }

  onMount(() => {
    window.addEventListener('scroll', handleScroll);
    loadMore();
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  });

  async function loadMore() {
    if (loading || !hasMoreImages) return;
    loading = true;
    const currentFilters = get(filterStore);
    const hasUserFilter = currentFilters.userFilter !== null;
    let currentHasLocationFilter = currentFilters.locationFilter !== null;
    let effectiveLat = userLat;
    let effectiveLon = userLon;
    // Query
    let query;
    if (effectiveLat !== null && effectiveLon !== null) {
      query = supabase
        .rpc('items_by_distance', {
          user_lat: effectiveLat,
          user_lon: effectiveLon,
          page,
          page_size: size,
          filter_user_id: hasUserFilter ? currentFilters.userFilter?.userId : null,
          require_gallery: true,
          current_user_id: get(sessionStore).isAuthenticated ? get(sessionStore).userId : null
        });
    } else {
      query = supabase
        .from('items_search_view')
        .select('id, lat, lon, path_512, path_2048, path_64, title, description, width, height, is_private, profile_id')
        .not('lat', 'is', null)
        .not('lon', 'is', null)
        .not('path_512', 'is', null)
        .order('created_at', { ascending: false })
        .range(page * size, page * size + size - 1);
      if (hasUserFilter && currentFilters.userFilter) {
        query = query.eq('profile_id', currentFilters.userFilter.userId);
      } else if (get(sessionStore).isAuthenticated) {
        query = query.or(`profile_id.eq.${get(sessionStore).userId},is_private.eq.false,is_private.is.null`);
      } else {
        query = query.or('is_private.eq.false,is_private.is.null');
      }
    }
    const { data, error } = await query;
    if (error) {
      console.error('[NormalGallery] Database error:', error);
      loading = false;
      return;
    }
    const newItems = (data || []).map(item => ({
      ...item,
      src: item.path_512
        ? `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-512/${item.path_512}`
        : item.path_2048
          ? `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-2048/${item.path_2048}`
          : item.path_64
            ? `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-64/${item.path_64}`
            : '',
      srcHD: item.path_2048
        ? `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-2048/${item.path_2048}`
        : '',
      distance: (item.lat && item.lon && effectiveLat !== null && effectiveLon !== null)
        ? getDistanceFromLatLonInMeters(effectiveLat, effectiveLon, item.lat, item.lon)
        : null
    }));
    if (newItems.length > 0) {
      pics.update(arr => [...arr, ...newItems]);
      page++;
      hasMoreImages = newItems.length === size;
      displayedImageCount = get(pics).length;
    } else {
      hasMoreImages = false;
    }
    loading = false;
  }
</script>

<GalleryLayout
  items={$pics}
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
{:else if $pics.length > 0}
  <div class="end-indicator">
    <span>✅ {displayedImageCount} Bilder angezeigt</span>
  </div>
{/if}

{#if !loading && $pics.length === 0}
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