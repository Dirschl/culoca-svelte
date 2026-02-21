import { json } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';
import { safeFunctionCall, logDatabaseOperation } from '$lib/databaseConfig';

export async function GET({ url }) {
  try {
    const page = parseInt(url.searchParams.get('page') || '0');
    const lat = parseFloat(url.searchParams.get('lat') || '0');
    const lon = parseFloat(url.searchParams.get('lon') || '0');
    const locationFilterLat = parseFloat(url.searchParams.get('locationFilterLat') || '0');
    const locationFilterLon = parseFloat(url.searchParams.get('locationFilterLon') || '0');
    const userId = url.searchParams.get('user_id');
    const pageSize = 50;
    
    // Request params (debug removed)

    // Hole aktuelle User-ID für Privacy-Filter
    const { data: { user } } = await supabase.auth.getUser();
    const currentUserId = user?.id || null;

    // Verwende ursprüngliche Funktion
    logDatabaseOperation('Calling gallery_items_normal_postgis', { page, lat, lon, userId });
    
    // Wenn User-Filter gesetzt ist: Verwende userId als current_user_id
    // Wenn kein User-Filter: Verwende eingeloggten User für Privacy
    const effectiveUserId = userId || currentUserId;

    // Kein Standort aktiv: neueste Bilder zuerst statt Distanzsortierung.
    // Gilt nur ohne User-Filter und ohne Location-Filter.
    const hasLocationFilter = locationFilterLat !== 0 && locationFilterLon !== 0;
    const hasGpsCoordinates = lat !== 0 && lon !== 0;
    if (!hasGpsCoordinates && !hasLocationFilter && !userId) {
      const from = page * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('items')
        .select(
          'id, slug, title, description, lat, lon, path_512, path_2048, path_64, width, height, created_at, profile_id, user_id, is_private, gallery, keywords, original_name',
          { count: 'exact' }
        )
        .eq('gallery', true)
        .not('path_512', 'is', null)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (currentUserId) {
        query = query.or(`is_private.is.null,is_private.eq.false,profile_id.eq.${currentUserId}`);
      } else {
        query = query.or('is_private.is.null,is_private.eq.false');
      }

      const { data: newestItems, error: newestError, count } = await query;

      if (newestError) {
        console.error('[Normal API] Latest-first fallback query error:', newestError);
        return json({ error: 'Failed to fetch latest gallery items', details: newestError }, { status: 500 });
      }

      return json({
        items: newestItems || [],
        totalCount: count || 0,
        page,
        hasGPS: false,
        hasLocationFilter: false,
        hasUserFilter: false,
        sortMode: 'latest'
      });
    }
    
    const functionParams = {
      user_lat: lat || 0,
      user_lon: lon || 0,
      page_value: page,
      page_size_value: 50,
      current_user_id: effectiveUserId
    };
    
    // Function params and GPS debug (debug removed)
    
    const { data, error } = await safeFunctionCall(supabase, 'gallery_items_normal_postgis', functionParams);

    if (error) {
      console.error('[Normal API] PostGIS RPC error:', error);
      return json({ error: 'Failed to fetch gallery items', details: error }, { status: 500 });
    }

    // PostGIS RPC success (debug removed)

    // Nur total_count entfernen, distance behalten für Frontend-Sortierung
    const items = data?.map(item => {
      const { total_count, ...itemWithoutTotalCount } = item;
      return itemWithoutTotalCount;
    }) || [];

    const totalCount = data?.[0]?.total_count || 0;

    return json({
      items,
      totalCount,
      page,
      hasGPS: lat !== 0 && lon !== 0,
      hasLocationFilter: locationFilterLat !== 0 && locationFilterLon !== 0,
      hasUserFilter: !!userId,
      sortMode: 'distance'
    });

  } catch (error) {
    console.error('[Normal API] Unexpected error:', error);
    return json({ error: 'Failed to fetch gallery items' }, { status: 500 });
  }
} 
