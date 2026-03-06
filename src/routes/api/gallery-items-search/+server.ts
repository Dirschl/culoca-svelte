import { json } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';
import { safeFunctionCall, logDatabaseOperation } from '$lib/databaseConfig';
import { isVisibleInMainFeed } from '$lib/content/routing';

export async function GET({ url }) {
  try {
    const page = parseInt(url.searchParams.get('page') || '0');
    const search = url.searchParams.get('search') || '';
    const lat = parseFloat(url.searchParams.get('lat') || '0');
    const lon = parseFloat(url.searchParams.get('lon') || '0');
    const locationFilterLat = parseFloat(url.searchParams.get('locationFilterLat') || '0');
    const locationFilterLon = parseFloat(url.searchParams.get('locationFilterLon') || '0');
    const userId = url.searchParams.get('user_id');
    const pageSize = 50;
    
    console.log('[Search API] Request params:', { page, search, lat, lon, locationFilterLat, locationFilterLon, userId });

    // Hole aktuelle User-ID für Privacy-Filter
    const { data: { user } } = await supabase.auth.getUser();
    const currentUserId = user?.id || null;

    // Verwende IMMER die gallery_items_search_postgis Funktion
    // Diese Funktion wendet den User-Filter korrekt an, auch ohne Suchbegriff
    logDatabaseOperation('Calling gallery_items_search_postgis', { page, lat, lon, userId, search });
    
    // Wenn User-Filter gesetzt ist: Verwende userId als current_user_id
    // Wenn kein User-Filter: Verwende eingeloggten User für Privacy
    const effectiveUserId = userId || currentUserId;

    // Kein Standort aktiv: Suchtreffer nach Aktualität statt Distanz.
    // Gilt nur ohne User-Filter und ohne Location-Filter.
    const hasLocationFilter = locationFilterLat !== 0 && locationFilterLon !== 0;
    const hasGpsCoordinates = lat !== 0 && lon !== 0;
    if (!hasGpsCoordinates && !hasLocationFilter && !userId) {
      const from = page * pageSize;
      const to = from + pageSize - 1;
      const trimmedSearch = search.trim();

      let query = supabase
        .from('items')
        .select(
          'id, slug, title, description, lat, lon, path_512, path_2048, path_64, width, height, created_at, profile_id, user_id, is_private, gallery, keywords, original_name, canonical_path, type_id, group_root_item_id, group_slug, show_in_main_feed, ends_at, external_url, video_url',
          { count: 'exact' }
        )
        .eq('gallery', true)
        .not('path_512', 'is', null)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (trimmedSearch) {
        const escaped = trimmedSearch.replace(/%/g, '\\%').replace(/_/g, '\\_');
        query = query.or(
          `title.ilike.%${escaped}%,description.ilike.%${escaped}%,original_name.ilike.%${escaped}%,slug.ilike.%${escaped}%`
        );
      }

      if (currentUserId) {
        query = query.or(`is_private.is.null,is_private.eq.false,profile_id.eq.${currentUserId}`);
      } else {
        query = query.or('is_private.is.null,is_private.eq.false');
      }

      const { data: newestItems, error: newestError, count } = await query;

      if (newestError) {
        console.error('[Search API] Latest-first fallback query error:', newestError);
        return json({ error: 'Failed to fetch latest search items', details: newestError }, { status: 500 });
      }

      return json({
        items: (newestItems || []).filter((item) => isVisibleInMainFeed(item)),
        totalCount: (newestItems || []).filter((item) => isVisibleInMainFeed(item)).length || count || 0,
        page,
        search,
        hasGPS: false,
        hasLocationFilter: false,
        hasUserFilter: false,
        sortMode: 'latest'
      });
    }
    
    // Parameter für die Suchfunktion
    const functionParams = {
      user_lat: lat || 0,
      user_lon: lon || 0,
      page_value: page,
      page_size_value: 50,
      current_user_id: effectiveUserId,
      search_term: search.trim() || null
    };
    
    console.log('[Search API] Function params:', functionParams);
    console.log('[Search API] User filter logic:', { 
      userId, 
      currentUserId, 
      effectiveUserId,
      hasUserFilter: !!userId,
      searchTerm: search,
      hasSearchTerm: !!(search && search.trim() !== '')
    });
    
    const { data, error } = await safeFunctionCall(supabase, 'gallery_items_search_postgis', functionParams);

    if (error) {
      console.error('[Search API] gallery_items_search_postgis RPC error:', error);
      return json({ error: 'Failed to fetch gallery items', details: error }, { status: 500 });
    }

    console.log('[Search API] gallery_items_search_postgis RPC success, items:', data?.length || 0);
    
    // Debug: Zeige erste paar Items mit Entfernungen
    if (data && data.length > 0) {
      console.log('[Search API] Sample items with distances:', data.slice(0, 3).map(item => ({
        id: item.id,
        title: item.title,
        distance: item.distance,
        lat: item.lat,
        lon: item.lon,
        profile_id: item.profile_id,
        is_private: item.is_private
      })));
    } else {
      console.log('[Search API] No items returned from gallery_items_search_postgis');
    }

    // Nur total_count entfernen, distance behalten für Frontend-Sortierung
    const items = data?.map(item => {
      const { total_count, ...itemWithoutTotalCount } = item;
      return itemWithoutTotalCount;
    }).filter((item) => !('show_in_main_feed' in item) || isVisibleInMainFeed(item)) || [];

    const totalCount = data?.[0]?.total_count || 0;

    return json({
      items,
      totalCount,
      page,
      search,
      hasGPS: lat !== 0 && lon !== 0,
      hasLocationFilter: locationFilterLat !== 0 && locationFilterLon !== 0,
      hasUserFilter: !!userId,
      sortMode: 'distance'
    });

  } catch (error) {
    console.error('[Search API] Unexpected error:', error);
    return json({ error: 'Failed to fetch gallery items' }, { status: 500 });
  }
} 
