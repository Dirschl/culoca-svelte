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
    
    console.log('[Normal API] Request params:', { page, lat, lon, locationFilterLat, locationFilterLon, userId });

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
    
    console.log('[Normal API] Function params:', functionParams);
    console.log('[Normal API] GPS Debug:', { 
      lat, 
      lon, 
      latIsValid: lat !== 0 && !isNaN(lat), 
      lonIsValid: lon !== 0 && !isNaN(lon),
      latForFunction: lat || 0,
      lonForFunction: lon || 0
    });
    console.log('[Normal API] User filter logic:', { 
      userId, 
      currentUserId, 
      effectiveUserId,
      hasUserFilter: !!userId
    });
    
    const { data, error } = await safeFunctionCall(supabase, 'gallery_items_normal_postgis', functionParams);

    if (error) {
      console.error('[Normal API] PostGIS RPC error:', error);
      return json({ error: 'Failed to fetch gallery items', details: error }, { status: 500 });
    }

    console.log('[Normal API] PostGIS RPC success, items:', data?.length || 0);
    
    // Debug: Zeige erste paar Items mit Entfernungen
    if (data && data.length > 0) {
      console.log('[Normal API] Sample items with distances:', data.slice(0, 3).map(item => ({
        id: item.id,
        title: item.title,
        distance: item.distance,
        lat: item.lat,
        lon: item.lon,
        profile_id: item.profile_id,
        is_private: item.is_private
      })));
    } else {
      console.log('[Normal API] No items returned from function');
    }

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