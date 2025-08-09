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
    
    // Request params (debug removed)

    // Hole aktuelle User-ID für Privacy-Filter
    const { data: { user } } = await supabase.auth.getUser();
    const currentUserId = user?.id || null;

    // Verwende ursprüngliche Funktion
    logDatabaseOperation('Calling gallery_items_normal_postgis', { page, lat, lon, userId });
    
    // Wenn User-Filter gesetzt ist: Verwende userId als current_user_id
    // Wenn kein User-Filter: Verwende eingeloggten User für Privacy
    const effectiveUserId = userId || currentUserId;
    
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
      hasUserFilter: !!userId
    });

  } catch (error) {
    console.error('[Normal API] Unexpected error:', error);
    return json({ error: 'Failed to fetch gallery items' }, { status: 500 });
  }
} 