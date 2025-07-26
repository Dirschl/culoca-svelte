import { json } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';

export async function GET({ url }) {
  try {
    const page = parseInt(url.searchParams.get('page') || '0');
    const lat = parseFloat(url.searchParams.get('lat') || '0');
    const lon = parseFloat(url.searchParams.get('lon') || '0');
    const locationFilterLat = parseFloat(url.searchParams.get('locationFilterLat') || '0');
    const locationFilterLon = parseFloat(url.searchParams.get('locationFilterLon') || '0');
    const radius = parseInt(url.searchParams.get('radius') || '5000'); // 5km Standard
    
    console.log('[Nearby API] Request params:', { page, lat, lon, locationFilterLat, locationFilterLon, radius });

    // Hole aktuelle User-ID für Privacy-Filter
    const { data: { user } } = await supabase.auth.getUser();
    const currentUserId = user?.id || null;

    // Bestimme die effektiven GPS-Koordinaten (LocationFilter hat Vorrang)
    const effectiveLat = locationFilterLat || lat;
    const effectiveLon = locationFilterLon || lon;

    if (!effectiveLat || !effectiveLon) {
      return json({ error: 'GPS coordinates required for nearby search' }, { status: 400 });
    }

    // Verwende PostGIS-Funktion für Nearby-Suche
    const { data, error } = await supabase.rpc('gallery_items_unified_postgis', {
      user_lat: effectiveLat,
      user_lon: effectiveLon,
      page_value: page,
      page_size_value: 1000, // Alle Nearby-Items laden für Kartenansicht
      current_user_id: currentUserId,
      search_term: null, // Keine Suche für Nearby
      location_filter_lat: locationFilterLat || null,
      location_filter_lon: locationFilterLon || null
    });

    if (error) {
      console.error('[Nearby API] PostGIS RPC error:', error);
      return json({ error: 'Failed to fetch nearby items', details: error }, { status: 500 });
    }

    console.log('[Nearby API] PostGIS RPC success, items:', data?.length || 0);

    // Filtere nach Radius und entferne total_count
    const items = (data || [])
      .filter((item: any) => item.distance <= radius)
      .map((item: any) => {
        const { total_count, ...itemWithoutTotalCount } = item;
        return itemWithoutTotalCount;
      });

    const totalCount = data?.[0]?.total_count || 0;

    return json({
      items,
      totalCount,
      page,
      radius,
      hasGPS: lat !== 0 && lon !== 0,
      hasLocationFilter: locationFilterLat !== 0 && locationFilterLon !== 0,
      effectiveLat,
      effectiveLon
    });

  } catch (error) {
    console.error('[Nearby API] Unexpected error:', error);
    return json({ error: 'Failed to fetch nearby items' }, { status: 500 });
  }
} 