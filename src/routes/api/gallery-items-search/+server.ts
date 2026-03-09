import { json } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';
import { safeFunctionCall, logDatabaseOperation } from '$lib/databaseConfig';
import { isVisibleInMainFeed } from '$lib/content/routing';

async function attachChildCounts(items: any[]) {
  const rootIds = items
    .filter((item) => !item.group_root_item_id)
    .map((item) => item.id);

  if (!rootIds.length) return items;

  const { data, error } = await supabase
    .from('items')
    .select('group_root_item_id')
    .in('group_root_item_id', rootIds);

  if (error || !data) {
    return items.map((item) => ({ ...item, child_count: 0 }));
  }

  const counts = new Map<string, number>();
  for (const row of data) {
    if (!row.group_root_item_id) continue;
    counts.set(row.group_root_item_id, (counts.get(row.group_root_item_id) || 0) + 1);
  }

  return items.map((item) => ({
    ...item,
    child_count: counts.get(item.id) || 0
  }));
}

async function attachCanonicalPaths(items: any[]) {
  if (!items.length) return items;

  const { data, error } = await supabase
    .from('items')
    .select('id, canonical_path, group_root_item_id')
    .in('id', items.map((item) => item.id));

  if (error || !data) {
    return items;
  }

  const itemById = new Map(data.map((item) => [item.id, item]));
  return items.map((item) => ({
    ...item,
    canonical_path: itemById.get(item.id)?.canonical_path || item.canonical_path || null,
    group_root_item_id: itemById.get(item.id)?.group_root_item_id ?? item.group_root_item_id ?? null
  }));
}

async function fetchVisibleRpcPage({
  startPage,
  pageSize,
  lat,
  lon,
  effectiveUserId,
  searchTerm
}: {
  startPage: number;
  pageSize: number;
  lat: number;
  lon: number;
  effectiveUserId: string | null;
  searchTerm: string | null;
}) {
  const collected: any[] = [];
  let rawPage = startPage;
  let totalCount = 0;
  let reachedEnd = false;
  let iterations = 0;
  const maxIterations = 6;

  while (collected.length < pageSize && !reachedEnd && iterations < maxIterations) {
    const { data, error } = await safeFunctionCall(supabase, 'gallery_items_search_postgis', {
      user_lat: lat || 0,
      user_lon: lon || 0,
      page_value: rawPage,
      page_size_value: pageSize,
      current_user_id: effectiveUserId,
      search_term: searchTerm
    });

    if (error) {
      return { error, items: [], totalCount: 0, nextPage: rawPage };
    }

    const batch = data || [];
    if (!totalCount) totalCount = batch[0]?.total_count || 0;

    const itemsWithCanonical = await attachCanonicalPaths(batch);
    const visibleItems = itemsWithCanonical
      .map((item) => {
        const { total_count, ...itemWithoutTotalCount } = item;
        return itemWithoutTotalCount;
      })
      .filter((item) => item.group_root_item_id == null && (!('show_in_main_feed' in item) || isVisibleInMainFeed(item)));

    collected.push(...visibleItems);

    reachedEnd = batch.length < pageSize;
    rawPage += 1;
    iterations += 1;
  }

  return {
    error: null,
    items: collected,
    totalCount,
    nextPage: rawPage
  };
}

export async function GET({ url }: any) {
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
        .eq('admin_hidden', false)
        .is('group_root_item_id', null)
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

      const visibleItems = await attachChildCounts((newestItems || []).filter((item) => isVisibleInMainFeed(item)));

      return json({
        items: visibleItems,
        totalCount: count || visibleItems.length,
        nextPage: page + 1,
        page,
        search,
        hasGPS: false,
        hasLocationFilter: false,
        hasUserFilter: false,
        sortMode: 'latest'
      });
    }
    
    const searchTerm = search.trim() || null;

    console.log('[Search API] Function params:', {
      user_lat: lat || 0,
      user_lon: lon || 0,
      page_value: page,
      page_size_value: 50,
      current_user_id: effectiveUserId,
      search_term: searchTerm
    });
    console.log('[Search API] User filter logic:', { 
      userId, 
      currentUserId, 
      effectiveUserId,
      hasUserFilter: !!userId,
      searchTerm: search,
      hasSearchTerm: !!(search && search.trim() !== '')
    });
    
    const rpcPage = await fetchVisibleRpcPage({
      startPage: page,
      pageSize,
      lat,
      lon,
      effectiveUserId,
      searchTerm
    });

    if (rpcPage.error) {
      console.error('[Search API] gallery_items_search_postgis RPC error:', rpcPage.error);
      return json({ error: 'Failed to fetch gallery items', details: rpcPage.error }, { status: 500 });
    }

    console.log('[Search API] gallery_items_search_postgis RPC success, items:', rpcPage.items?.length || 0);
    
    // Debug: Zeige erste paar Items mit Entfernungen
    if (rpcPage.items && rpcPage.items.length > 0) {
      console.log('[Search API] Sample items with distances:', rpcPage.items.slice(0, 3).map(item => ({
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

    const itemsWithChildCounts = await attachChildCounts(rpcPage.items);

    let totalCount = rpcPage.totalCount || 0;
    let visibleCountQuery = supabase
      .from('items')
      .select('id', { count: 'exact', head: true })
      .eq('gallery', true)
      .eq('admin_hidden', false)
      .is('group_root_item_id', null)
      .not('path_512', 'is', null);

    if (lat !== 0 || lon !== 0) {
      visibleCountQuery = visibleCountQuery.not('lat', 'is', null).not('lon', 'is', null);
    }

    const trimmedSearch = search.trim();
    if (trimmedSearch) {
      const escaped = trimmedSearch.replace(/%/g, '\\%').replace(/_/g, '\\_');
      visibleCountQuery = visibleCountQuery.or(
        `title.ilike.%${escaped}%,description.ilike.%${escaped}%,original_name.ilike.%${escaped}%,slug.ilike.%${escaped}%`
      );
    }

    if (currentUserId) {
      visibleCountQuery = visibleCountQuery.or(`is_private.is.null,is_private.eq.false,profile_id.eq.${currentUserId}`);
    } else {
      visibleCountQuery = visibleCountQuery.or('is_private.is.null,is_private.eq.false');
    }

    if (userId) {
      visibleCountQuery = visibleCountQuery.eq('profile_id', userId);
    }

    const { count: visibleCount } = await visibleCountQuery;

    if (typeof visibleCount === 'number') {
      totalCount = visibleCount;
    }

    return json({
      items: itemsWithChildCounts,
      totalCount,
      nextPage: rpcPage.nextPage,
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
