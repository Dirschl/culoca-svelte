import { json, error } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';

export const GET = async ({ url, request }) => {
  try {
    // Query-Parameter: limit (default 100), user_id (optional), offset (optional)
    // New filter parameters: filter_user_id, lat, lon (for GPS-based filtering)
    // Special parameter: for_map (for map clustering - bypasses limit)
    const limit = parseInt(url.searchParams.get('limit') || '100', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);
    const user_id = url.searchParams.get('user_id');
    const filter_user_id = url.searchParams.get('filter_user_id');
    const lat = url.searchParams.get('lat');
    const lon = url.searchParams.get('lon');
    const for_map = url.searchParams.get('for_map') === 'true';
    
    // For map clustering, use a much higher limit
    const effectiveLimit = for_map ? 50000 : limit;
    
    // Extract user ID from Authorization header
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
        console.log('Token validation error:', tokenError);
      }
    }
    
    console.log('API /api/items - Current user:', current_user_id || 'anonymous');
    console.log('API Debug - Query params:', { lat, lon, limit, offset, user_id, filter_user_id, for_map });
    console.log('API Debug - GPS filtering check:', { lat, lon, latType: typeof lat, lonType: typeof lon, latIsNull: lat === 'null', lonIsNull: lon === 'null' });

    // GPS-Filtering: Load all matching images, sort by distance, then paginate
    const useGpsFiltering = lat && lon && lat !== 'null' && lon !== 'null' && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lon));
    console.log('API Debug - GPS filtering decision:', { 
      lat, 
      lon, 
      latExists: !!lat, 
      lonExists: !!lon, 
      latNotStringNull: lat !== 'null', 
      lonNotStringNull: lon !== 'null',
      latIsNumber: !isNaN(parseFloat(lat || '')), 
      lonIsNumber: !isNaN(parseFloat(lon || '')),
      useGpsFiltering,
      latLength: lat?.length,
      lonLength: lon?.length,
      latStartsWith: lat?.substring(0, 5),
      lonStartsWith: lon?.substring(0, 5)
    });
    if (useGpsFiltering) {
      console.log('API Debug - Using GPS filtering with coordinates:', { lat, lon });
      const maxGpsImages = 10000; // Erhöht von 2000 auf 10000 für mehr Bilder
      let gpsQuery = supabase
        .from('items')
        .select('id, path_512, path_2048, path_64, original_name, created_at, user_id, profile_id, title, description, lat, lon, width, height, is_private')
        .not('lat', 'is', null)
        .not('lon', 'is', null)
        .not('path_512', 'is', null)
        .limit(maxGpsImages);
      // User-Filter anwenden
      if (user_id) {
        gpsQuery = gpsQuery.eq('user_id', user_id);
        console.log('API Debug - Filtering by user_id:', user_id);
      } else if (filter_user_id) {
        gpsQuery = gpsQuery.eq('profile_id', filter_user_id);
        console.log('API Debug - Filtering by profile_id:', filter_user_id);
      } else {
        if (current_user_id) {
          gpsQuery = gpsQuery.or(`profile_id.eq.${current_user_id},is_private.eq.false,is_private.is.null`);
          console.log('API Debug - Filtering for authenticated user:', current_user_id);
        } else {
          gpsQuery = gpsQuery.or('is_private.eq.false,is_private.is.null');
          console.log('API Debug - Filtering for anonymous user (public items only)');
        }
      }
      const { data: gpsData, error: gpsError } = await gpsQuery;
      if (gpsError) throw error(500, gpsError.message);
      
      console.log('API Debug - Raw GPS data loaded:', gpsData?.length || 0, 'items');
      
      // Entfernung berechnen und sortieren
      const userLat = parseFloat(lat);
      const userLon = parseFloat(lon);
      let imagesWithDistance = (gpsData || []).map((image) => {
        if (image.lat && image.lon) {
          const R = 6371000;
          const lat1Rad = userLat * Math.PI / 180;
          const lat2Rad = image.lat * Math.PI / 180;
          const deltaLatRad = (image.lat - userLat) * Math.PI / 180;
          const deltaLonRad = (image.lon - userLon) * Math.PI / 180;
          const a = Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
                   Math.cos(lat1Rad) * Math.cos(lat2Rad) *
                   Math.sin(deltaLonRad / 2) * Math.sin(deltaLonRad / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const distance = R * c;
          return { ...image, distance };
        }
        return image;
      });
      
      console.log('API Debug - Items with distance calculated:', imagesWithDistance.length);
      
      imagesWithDistance.sort((a, b) => ((a as any).distance || Infinity) - ((b as any).distance || Infinity));
      
      console.log('API Debug - Items after sorting by distance:', imagesWithDistance.length);
      console.log('API Debug - First 3 items after sorting:', imagesWithDistance.slice(0, 3).map(item => ({ id: item.id, distance: (item as any).distance })));
      
      const pagedImages = imagesWithDistance.slice(offset, offset + limit);
      
      console.log('API Debug - Final paged result:', {
        totalItems: imagesWithDistance.length,
        offset,
        limit,
        returnedItems: pagedImages.length,
        firstItemId: pagedImages[0]?.id,
        lastItemId: pagedImages[pagedImages.length - 1]?.id
      });
      
      return json({
        status: 'success',
        images: pagedImages,
        totalCount: imagesWithDistance.length,
        loadedCount: pagedImages.length,
        gpsMode: true
      });
    }
    // Normale Paginierung ohne GPS
    console.log('API Debug - Using normal pagination (no GPS)');
    let imagesQuery = supabase
      .from('items')
      .select('id, path_512, path_2048, path_64, original_name, created_at, user_id, profile_id, title, description, lat, lon, width, height, is_private')
      .not('lat', 'is', null)
      .not('lon', 'is', null)
      .not('path_512', 'is', null)
      .range(offset, offset + effectiveLimit - 1);
    if (user_id) {
      imagesQuery = imagesQuery.eq('user_id', user_id);
    } else if (filter_user_id) {
      imagesQuery = imagesQuery.eq('profile_id', filter_user_id);
    } else {
      if (current_user_id) {
        imagesQuery = imagesQuery.or(`profile_id.eq.${current_user_id},is_private.eq.false,is_private.is.null`);
      } else {
        imagesQuery = imagesQuery.or('is_private.eq.false,is_private.is.null');
      }
    }
    let totalQuery = supabase
      .from('items')
      .select('id', { count: 'exact' })
      .not('lat', 'is', null)
      .not('lon', 'is', null)
      .not('path_512', 'is', null);
    if (user_id) {
      totalQuery = totalQuery.eq('user_id', user_id);
    } else if (filter_user_id) {
      totalQuery = totalQuery.eq('profile_id', filter_user_id);
    } else {
      if (current_user_id) {
        totalQuery = totalQuery.or(`profile_id.eq.${current_user_id},is_private.eq.false,is_private.is.null`);
      } else {
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
    
    console.log('API Debug - Normal pagination result:', {
      totalCount: count || 0,
      returnedItems: data?.length || 0,
      offset,
      effectiveLimit
    });
    
    return json({ 
      status: 'success', 
      images: data || [], 
      totalCount: count || 0,
      loadedCount: data?.length || 0,
      gpsMode: false
    });
  } catch (err) {
    console.error('API /api/items error:', err);
    const message = (err instanceof Error) ? err.message : 'Unknown error';
    return json({ status: 'error', message }, { status: 500 });
  }
}; 