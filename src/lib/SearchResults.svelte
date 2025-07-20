<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import type { NewsFlashImage } from '$lib/types';
  import GalleryLayout from '$lib/GalleryLayout.svelte';
  
  export let searchQuery: string = '';
  export let userId: string = '';
  export let layout: 'justified' | 'grid' = 'justified';
  export let showDistance: boolean = false;
  export let userLat: number | null = null;
  export let userLon: number | null = null;
  export let getDistanceFromLatLonInMeters: ((lat1: number, lon1: number, lat2: number, lon2: number) => string) | null = null;
  export let onSearchComplete: (() => void) | undefined = undefined;
  
  let loading = false;
  let results: any[] = [];
  let lastSearchTerm = '';
  let lastUserId = '';
  let searchTimeout: ReturnType<typeof setTimeout> | null = null;
  let isInitializing = true; // Flag to prevent reactive searches during initialization
  let isInitialized = false;

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
    if (!searchQuery.trim()) {
      results = [];
      return;
    }
    
    // Prevent unnecessary searches
    if (searchQuery === lastSearchTerm && userId === lastUserId) {
      console.log('🔍 SearchResults: Skipping duplicate search');
      return;
    }
    
    console.log('🔍 SearchResults: Starting search for:', { searchQuery, userId });
    
    lastSearchTerm = searchQuery;
    lastUserId = userId;
    
    loading = true;
    
    // Clear timeout since we're starting the search
    if (searchTimeout) {
      clearTimeout(searchTimeout);
      searchTimeout = null;
    }
    
    try {
      // Use the same simple database query as the main page
      // This is the proven approach that shows 1000+ images
      const searchTerms = searchQuery.toLowerCase().split(/\s+/).filter(term => term.length > 0);
      console.log('🔍 SearchResults: Search terms:', searchTerms);
      
      // Simple database query like the main page
      let query = supabase
        .from('items')
        .select('id, lat, lon, path_512, path_2048, path_64, title, description, width, height, is_private, profile_id, keywords')
        .not('lat', 'is', null)
        .not('lon', 'is', null)
        .not('path_512', 'is', null)
        .eq('gallery', true) // Only show images with gallery = true
        .order('created_at', { ascending: false });
      
      // Apply privacy filtering like the main page
      if (userId) {
        query = query.or(`profile_id.eq.${userId},is_private.eq.false,is_private.is.null`);
        console.log('🔍 SearchResults: Privacy filter for logged in user:', userId);
      } else {
        query = query.or('is_private.eq.false,is_private.is.null');
        console.log('🔍 SearchResults: Privacy filter for anonymous user');
      }
      
      // Add simple text search like the main page
      if (searchTerms.length > 0) {
        // Simple ILIKE search in title, description, and keywords
        const searchConditions = searchTerms.map(term => 
          `or(title.ilike.%${term}%,description.ilike.%${term}%,keywords.cs.{${term}})`
        ).join(',');
        
        query = query.or(searchConditions);
        console.log('🔍 SearchResults: Added simple text search conditions');
      }
      
      const { data, error } = await query;
      console.log('🔍 SearchResults: Server-side search result:', { searchQuery, userId, data: data?.length, error });
      
      if (error) {
        console.error('🔍 SearchResults: Query error:', error);
        results = [];
      } else {
        // Transform data to match gallery format (same as main page)
        const searchPics = (data || []).map((d: any) => ({
          id: d.id,
          src: d.path_512 ? `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/images-512/${d.path_512}` : '',
          srcHD: d.path_2048 ? `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/images-2048/${d.path_2048}` : '',
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
        
        console.log(`🔍 SearchResults: Found ${searchPics.length} results after server-side filtering`);
        
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
      console.log('🔍 SearchResults: Search completed, loading set to false');
      
      // Notify parent component that search is complete
      if (onSearchComplete) {
        onSearchComplete();
      }
    }
  }

  // Prevent reactive searches during initialization
  $: if (!isInitializing && searchQuery && searchQuery.trim() && (searchQuery !== lastSearchTerm || userId !== lastUserId)) {
    console.log('🔍 SearchResults: Reactive search triggered for:', searchQuery);
    
    // Clear existing timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    // Debounce search to prevent rapid successive calls
    searchTimeout = setTimeout(() => {
      console.log('🔍 SearchResults: Executing debounced search');
      search();
    }, 300);
  } else if (!searchQuery.trim()) {
    console.log('🔍 SearchResults: Clearing results for empty query');
    results = [];
    loading = false; // Ensure loading is false when clearing
    
    // Notify parent component that search is complete
    if (onSearchComplete) {
      onSearchComplete();
    }
  }
  
  // Mark as initialized after first mount
  $: if (searchQuery && !isInitialized) {
    isInitialized = true;
    console.log('🔍 SearchResults: Component initialized');
  }
  
  // Allow external search triggers
  export function triggerSearch() {
    isInitializing = false; // Allow reactive searches after external trigger
    if (searchQuery && searchQuery.trim()) {
      console.log('🔍 SearchResults: External search trigger for:', searchQuery);
      search();
    }
  }
</script>

{#if loading}
  <div class="search-loading">
    <div class="spinner"></div>
    <span>🔄 Suche läuft…</span>
  </div>
{:else if results.length === 0 && searchQuery}
  <div class="search-no-results">
    <p>❌ Keine Treffer für "{searchQuery}" gefunden.</p>
  </div>
{:else if results.length > 0}
  <div class="search-results-header">
    <p>{results.length} Ergebnis{results.length !== 1 ? 'se' : ''} für "{searchQuery}"</p>
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