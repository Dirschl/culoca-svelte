import { json } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';

export async function GET({ url }) {
  try {
    const page = parseInt(url.searchParams.get('page') || '0');
    const lat = parseFloat(url.searchParams.get('lat') || '0');
    const lon = parseFloat(url.searchParams.get('lon') || '0');
    const locationFilterLat = parseFloat(url.searchParams.get('locationFilterLat') || '0');
    const locationFilterLon = parseFloat(url.searchParams.get('locationFilterLon') || '0');
    
    console.log('[Normal API] Request params:', { page, lat, lon, locationFilterLat, locationFilterLon });

    // Hole aktuelle User-ID für Privacy-Filter
    const { data: { user } } = await supabase.auth.getUser();
    const currentUserId = user?.id || null;

    // Verwende erweiterte PostGIS-Funktion mit LocationFilter-Unterstützung
    const { data, error } = await supabase.rpc('gallery_items_unified_postgis', {
      user_lat: lat,
      user_lon: lon,
      page_value: page,
      page_size_value: 50,
      current_user_id: currentUserId,
      search_term: null, // Keine Suche für normale Galerie
      location_filter_lat: locationFilterLat || null,
      location_filter_lon: locationFilterLon || null
    });

    if (error) {
      console.error('[Normal API] PostGIS RPC error:', error);
      return json({ error: 'Failed to fetch gallery items', details: error }, { status: 500 });
    }

    console.log('[Normal API] PostGIS RPC success, items:', data?.length || 0);

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
      hasLocationFilter: locationFilterLat !== 0 && locationFilterLon !== 0
    });

  } catch (error) {
    console.error('[Normal API] Unexpected error:', error);
    return json({ error: 'Failed to fetch gallery items' }, { status: 500 });
  }
} 