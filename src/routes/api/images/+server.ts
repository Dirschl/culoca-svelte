import { json, error } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';

export const GET = async ({ url }) => {
  try {
    // Query-Parameter: limit (default 12), user_id (optional), offset (optional)
    // New filter parameters: filter_user_id, lat, lon (for GPS-based filtering)
    const limit = parseInt(url.searchParams.get('limit') || '12', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);
    const user_id = url.searchParams.get('user_id');
    const filter_user_id = url.searchParams.get('filter_user_id');
    const lat = url.searchParams.get('lat');
    const lon = url.searchParams.get('lon');

    // Check if we should use GPS-based distance sorting
    const useGpsFiltering = lat && lon && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lon));
    
    if (useGpsFiltering) {
      // Use the database function for GPS-based filtering and sorting
      const { data, error: dbError } = await supabase.rpc('images_by_distance_optimized', {
        user_lat: parseFloat(lat),
        user_lon: parseFloat(lon),
        max_results: limit,
        offset_count: offset,
        filter_user_id: filter_user_id || null
      });

      if (dbError) {
        throw error(500, dbError.message);
      }

      // Get total count for GPS-based filtering
      let totalQuery = supabase
        .from('items')
        .select('id', { count: 'exact' })
        .not('lat', 'is', null)
        .not('lon', 'is', null)
        .not('path_512', 'is', null);

      if (filter_user_id) {
        totalQuery = totalQuery.eq('profile_id', filter_user_id);
      }

      const { count, error: countError } = await totalQuery;

      if (countError) {
        throw error(500, countError.message);
      }

      return json({ 
        status: 'success', 
        images: data || [], 
        totalCount: count || 0,
        loadedCount: data?.length || 0,
        gpsMode: true
      });
    } else {
      // Build query for images with GPS data (chronological order)
      let imagesQuery = supabase
        .from('items')
        .select('id, path_512, path_2048, path_64, original_name, created_at, user_id, profile_id, title, description, lat, lon')
        .not('lat', 'is', null)
        .not('lon', 'is', null)
        .not('path_512', 'is', null)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (user_id) {
        imagesQuery = imagesQuery.eq('user_id', user_id);
      }

      if (filter_user_id) {
        imagesQuery = imagesQuery.eq('profile_id', filter_user_id);
      }

      // Get total count of images with GPS data
      let totalQuery = supabase
        .from('items')
        .select('id', { count: 'exact' })
        .not('lat', 'is', null)
        .not('lon', 'is', null)
        .not('path_512', 'is', null);

      if (user_id) {
        totalQuery = totalQuery.eq('user_id', user_id);
      }

      if (filter_user_id) {
        totalQuery = totalQuery.eq('profile_id', filter_user_id);
      }

      const [{ data, error: dbError }, { count, error: countError }] = await Promise.all([
        imagesQuery,
        totalQuery
      ]);

      if (dbError) {
        throw error(500, dbError.message);
      }

      if (countError) {
        throw error(500, countError.message);
      }

      return json({ 
        status: 'success', 
        images: data, 
        totalCount: count || 0,
        loadedCount: data?.length || 0,
        gpsMode: false
      });
    }
  } catch (err) {
    console.error('API /api/images error:', err);
    const message = (err instanceof Error) ? err.message : 'Unknown error';
    return json({ status: 'error', message }, { status: 500 });
  }
}; 