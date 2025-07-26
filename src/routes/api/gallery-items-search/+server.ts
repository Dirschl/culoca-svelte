import { json, error } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';


console.log('VITE_SUPABASE_URL:', process.env.VITE_SUPABASE_URL);
console.log('VITE_SUPABASE_SERVICE_ROLE_KEY:', process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

export const GET = async ({ url, request }) => {
  try {
    const lat = url.searchParams.get('lat');
    const lon = url.searchParams.get('lon');
    const page = parseInt(url.searchParams.get('page') || '0', 10);
    const page_size = 50;
    const search = url.searchParams.get('search') || null;

    // Optional: User-Authentifizierung für current_user_id
    let current_user_id = null;
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const { data: { user }, error: tokenError } = await supabase.auth.getUser(token);
        if (!tokenError && user) {
          current_user_id = user.id;
        }
      } catch (tokenError) {
        // Ignorieren, wenn kein User
      }
    }

    let data;
    let dbError;

    // If GPS coordinates are provided, use the gallery_items_search function
    if (lat && lon && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lon))) {
      console.log('[Gallery-API] Using GPS-based search with coordinates:', lat, lon);
      
      const { data: gpsData, error: gpsError } = await supabase.rpc('gallery_items_search', {
      user_lat: parseFloat(lat),
      user_lon: parseFloat(lon),
      page,
      page_size,
      current_user_id,
      search
    });
      
      data = gpsData;
      dbError = gpsError;
    } else {
      // If no GPS coordinates, use a simple query without distance calculation
      console.log('[Gallery-API] Using simple search without GPS coordinates');
      
      let query = supabase
        .from('items')
        .select('id, slug, path_512, path_2048, path_64, original_name, created_at, user_id, profile_id, title, description, lat, lon, width, height, is_private, keywords, gallery')
        .not('path_512', 'is', null)
        .eq('gallery', true)
        .order('created_at', { ascending: false })
        .range(page * page_size, (page + 1) * page_size - 1);

      // Apply privacy filtering
      if (current_user_id) {
        query = query.or(`profile_id.eq.${current_user_id},is_private.eq.false,is_private.is.null`);
      } else {
        query = query.or('is_private.eq.false,is_private.is.null');
      }

      // Apply search filter if provided
      if (search) {
        query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
      }

      const { data: simpleData, error: simpleError } = await query;
      
      data = simpleData;
      dbError = simpleError;
    }

    if (dbError) {
      console.error('[Gallery-API] Database error:', dbError);
      throw error(500, dbError.message);
    }

    return json({ 
      items: data || [],
      status: 'success',
      gpsMode: !!(lat && lon),
      apiVersion: 'gallery-search-v1'
    });
  } catch (err) {
    console.error('[Gallery-API] Error:', err);
    if (err.status && err.body) throw err;
    throw error(500, err.message || 'Unknown error');
  }
}; 