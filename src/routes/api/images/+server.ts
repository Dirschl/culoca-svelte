import { json, error } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';

export const GET = async ({ url, request }) => {
  try {
    // Query-Parameter: limit (default 12), user_id (optional), offset (optional)
    // New filter parameters: filter_user_id, lat, lon (for GPS-based filtering)
    const limit = parseInt(url.searchParams.get('limit') || '12', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);
    const user_id = url.searchParams.get('user_id');
    const filter_user_id = url.searchParams.get('filter_user_id');
    const current_user_id = url.searchParams.get('current_user_id');
    const lat = url.searchParams.get('lat');
    const lon = url.searchParams.get('lon');
    
    console.log('API /api/images - Current user:', current_user_id || 'anonymous');

    // Check if we should use GPS-based distance sorting
    const useGpsFiltering = lat && lon && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lon));
    
    if (useGpsFiltering) {
      // Use the database function for GPS-based filtering and sorting
      // The function now handles privacy filtering internally using is_private field
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

      // Get total count for GPS-based filtering with privacy filtering
      let totalQuery = supabase
        .from('items')
        .select('id', { count: 'exact' })
        .not('lat', 'is', null)
        .not('lon', 'is', null)
        .not('path_512', 'is', null);

      if (filter_user_id) {
        // If filtering for specific user, show all their items (including private)
        totalQuery = totalQuery.eq('profile_id', filter_user_id);
      } else {
        // If no user filter, only show non-private items  
        // Handle both false and null values (null = legacy data before migration)
        totalQuery = totalQuery.or('is_private.eq.false,is_private.is.null');
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

      // Apply user filtering and privacy filtering
      if (user_id) {
        // Filter by user_id (for NewsFlash "eigene" mode)
        imagesQuery = imagesQuery.eq('user_id', user_id);
        // For user's own images, show all (including private)
        // No additional privacy filtering needed
      } else if (filter_user_id) {
        // Filter by profile_id (for profile-based filtering)
        imagesQuery = imagesQuery.eq('profile_id', filter_user_id);
        // For specific user profile, show all their images (including private)
        // No additional privacy filtering needed
      } else {
        // Apply privacy filtering based on authentication
        if (current_user_id) {
          // For authenticated users: show their own images (all) + other users' public images
          imagesQuery = imagesQuery.or(`profile_id.eq.${current_user_id},is_private.eq.false,is_private.is.null`);
        } else {
          // For anonymous users: only show public images
          imagesQuery = imagesQuery.or('is_private.eq.false,is_private.is.null');
        }
      }

      // Get total count of images with GPS data and privacy filtering
      let totalQuery = supabase
        .from('items')
        .select('id', { count: 'exact' })
        .not('lat', 'is', null)
        .not('lon', 'is', null)
        .not('path_512', 'is', null);

      // Apply user filtering and privacy filtering for total count
      if (user_id) {
        // Filter by user_id (for NewsFlash "eigene" mode)
        totalQuery = totalQuery.eq('user_id', user_id);
        // For user's own images, show all (including private)
        // No additional privacy filtering needed
      } else if (filter_user_id) {
        // Filter by profile_id (for profile-based filtering)
        totalQuery = totalQuery.eq('profile_id', filter_user_id);
        // For specific user profile, show all their images (including private)
        // No additional privacy filtering needed
      } else {
        // Apply privacy filtering based on authentication for total count
        if (current_user_id) {
          // For authenticated users: show their own images (all) + other users' public images
          totalQuery = totalQuery.or(`profile_id.eq.${current_user_id},is_private.eq.false,is_private.is.null`);
        } else {
          // For anonymous users: only show public images
          totalQuery = totalQuery.or('is_private.eq.false,is_private.is.null');
        }
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