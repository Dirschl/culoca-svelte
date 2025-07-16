<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import type { NewsFlashImage } from '$lib/types';
  import GalleryLayout from '$lib/GalleryLayout.svelte';
  
  export let searchTerm: string = '';
  export let userId: string = '';
  export let layout: 'justified' | 'grid' = 'justified';
  export let showDistance: boolean = false;
  export let userLat: number | null = null;
  export let userLon: number | null = null;
  export let getDistanceFromLatLonInMeters: ((lat1: number, lon1: number, lat2: number, lon2: number) => string) | null = null;
  
  let results: any[] = [];
  let loading = false;
  let lastSearchTerm = '';
  let lastUserId = '';

  // Local distance calculation function for sorting
  function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  async function search() {
    if (!searchTerm.trim()) {
      results = [];
      return;
    }
    
    // Prevent unnecessary searches
    if (searchTerm === lastSearchTerm && userId === lastUserId) {
      return;
    }
    
    lastSearchTerm = searchTerm;
    lastUserId = userId;
    
    loading = true;
    console.log('🔍 SearchResults: Starting search for:', { searchTerm, userId });
    
    try {
      // Query auf die neue View
      let query = supabase
        .from('items_search_view')
        .select('*')
        .ilike('searchtext', `%${searchTerm.toLowerCase()}%`)
        .order('created_at', { ascending: false })
        .limit(5000);
        
      if (userId) {
        query = query.or(`is_private.eq.false,user_id.eq.${userId}`);
      } else {
        query = query.eq('is_private', false);
      }
      
      const { data, error } = await query;
      console.log('🔍 SearchResults: Supabase-View-Query result:', { searchTerm, userId, data: data?.length, error });
      
      if (error) {
        console.error('🔍 SearchResults: Query error:', error);
        results = [];
      } else {
        // Transform data to match gallery format
        const searchPics = (data || []).map((d: any) => ({
          id: d.id,
          src: d.path_512 ? `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-512/${d.path_512}` : '',
          srcHD: d.path_2048 ? `https://caskhmcbvtevdwsolvwk.supabase.co/storage/v1/object/public/images-2048/${d.path_2048}` : '',
          width: d.width && d.width > 0 ? d.width : 400,
          height: d.height && d.height > 0 ? d.height : 300,
          lat: d.lat,
          lon: d.lon,
          title: d.title,
          description: d.description,
          keywords: d.keywords,
          path_64: d.path_64,
          path_512: d.path_512,
          path_2048: d.path_2048
        })).filter((pic: any) => pic.path_512); // Filter out images without path_512
        
        // Sort by distance if GPS data is available
        if (showDistance && userLat !== null && userLon !== null) {
          searchPics.sort((a: any, b: any) => {
            const distA = a.lat && a.lon ? getDistanceInMeters(userLat!, userLon!, a.lat, a.lon) : Number.MAX_VALUE;
            const distB = b.lat && b.lon ? getDistanceInMeters(userLat!, userLon!, b.lat, b.lon) : Number.MAX_VALUE;
            return distA - distB;
          });
        }
        
        results = searchPics;
      }
    } catch (err) {
      console.error('🔍 SearchResults: Search error:', err);
      results = [];
    } finally {
      loading = false;
    }
  }

  // Only trigger search when searchTerm changes and is not empty
  $: {
    if (searchTerm && searchTerm.trim() && (searchTerm !== lastSearchTerm || userId !== lastUserId)) {
      search();
    } else if (!searchTerm.trim()) {
      results = [];
    }
  }
</script>

{#if loading}
  <div class="search-loading">
    <div class="spinner"></div>
    <span>🔄 Suche läuft…</span>
  </div>
{:else if results.length === 0 && searchTerm}
  <div class="search-no-results">
    <p>❌ Keine Treffer für "{searchTerm}" gefunden.</p>
  </div>
{:else if results.length > 0}
  <div class="search-results-header">
    <p>{results.length} Ergebnis{results.length !== 1 ? 'se' : ''} für "{searchTerm}"</p>
  </div>
  <GalleryLayout
    items={results}
    {layout}
    gap={2}
    targetRowHeight={220}
    {showDistance}
    showCompass={false}
    {userLat}
    {userLon}
    {getDistanceFromLatLonInMeters}
  />
{/if}

<style>
  .search-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 2rem;
    color: var(--text-secondary);
    font-weight: 500;
  }

  .spinner {
    width: 20px;
    height: 20px;
    border: 2px solid var(--border-color);
    border-top: 2px solid var(--accent-color);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .search-no-results {
    padding: 2rem;
    text-align: center;
    color: var(--text-secondary);
  }

  .search-results-header {
    padding: 0.5rem 0 1rem 0;
    color: var(--text-secondary);
    font-weight: 500;
    text-align: center;
  }
</style> 