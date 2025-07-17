import { json, error } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';
import { createClient } from '@supabase/supabase-js';

// Service role client for bypassing RLS limits  
const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

// Fallback: if service key doesn't exist, use regular client but increase limit
const supabaseService = supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : supabase;

export const GET = async ({ url, request }) => {
  try {
    // Query-Parameter: limit (default 100), user_id (optional), offset (optional)
    // New filter parameters: filter_user_id, lat, lon, radius (for GPS-based filtering)
    // Special parameter: for_map (for map clustering - bypasses limit)
    const limit = parseInt(url.searchParams.get('limit') || '100', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);
    const user_id = url.searchParams.get('user_id');
    const filter_user_id = url.searchParams.get('filter_user_id');
    const lat = url.searchParams.get('lat');
    const lon = url.searchParams.get('lon');
    const radius = url.searchParams.get('radius');
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
    
    console.log('🔍 API /api/items - Current user:', current_user_id || 'anonymous');
    console.log('🔍 API Debug - Query params:', { lat, lon, limit, offset, user_id, filter_user_id, for_map });
    console.log('🔍 API Debug - GPS filtering check:', { lat, lon, latType: typeof lat, lonType: typeof lon, latIsNull: lat === 'null', lonIsNull: lon === 'null' });
    console.log('🔍 API Debug - Request URL:', url.toString());
    console.log('🔍 API Debug - Request headers:', Object.fromEntries(request.headers.entries()));
    console.log('🔍 API Debug - Request method:', request.method);
    // --- Erweiterte Debug-Logs für Herkunftsanalyse ---
    const referer = request.headers.get('referer');
    const userAgent = request.headers.get('user-agent');
    if (for_map) {
      console.log('🔍 API Debug - for_map=true: Referer:', referer);
      console.log('🔍 API Debug - for_map=true: User-Agent:', userAgent);
      console.log('🔍 API Debug - for_map=true: Stacktrace:', new Error().stack?.split('\n').slice(1, 10).join('\n'));
    } else {
      console.log('🔍 API Debug - Referer:', referer);
      console.log('🔍 API Debug - User-Agent:', userAgent);
    }

    // GPS-Filtering: Load all matching images, sort by distance, then paginate
    const useGpsFiltering = lat && lon && lat !== 'null' && lon !== 'null' && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lon));
    console.log('🔍 API Debug - GPS filtering decision:', { 
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
      console.log('🔍 API Debug - Using GPS filtering with coordinates:', { lat, lon });
      const maxGpsImages = for_map ? 50000 : 10000; // Für Karten 50000, sonst 10000 Bilder
      
      // For maps, use service role client to bypass RLS 1000-row limit
      const dbClient = for_map ? supabaseService : supabase;
      const clientType = for_map ? (supabaseServiceKey ? 'SERVICE ROLE' : 'REGULAR (no service key)') : 'REGULAR';
      console.log(`🔍 API Debug - Using ${clientType} client for query`);
      console.log(`🔍 API Debug - Service key exists: ${!!supabaseServiceKey}, URL exists: ${!!supabaseUrl}`);
      
      let gpsQuery = dbClient
        .from('items')
        .select('id, path_512, path_2048, path_64, original_name, created_at, user_id, profile_id, title, description, lat, lon, width, height, is_private')
        .not('lat', 'is', null)
        .not('lon', 'is', null)
        .not('path_512', 'is', null)
        .limit(for_map ? 1000 : maxGpsImages); // Use batch loading for maps to bypass RLS limit
      
      // User-Filter anwenden
      if (user_id) {
        gpsQuery = gpsQuery.eq('user_id', user_id);
        console.log('🔍 API Debug - Filtering by user_id:', user_id);
      } else if (filter_user_id) {
        gpsQuery = gpsQuery.eq('profile_id', filter_user_id);
        console.log('🔍 API Debug - Filtering by profile_id:', filter_user_id);
      } else {
        if (current_user_id) {
          gpsQuery = gpsQuery.or(`profile_id.eq.${current_user_id},is_private.eq.false,is_private.is.null`);
          console.log('🔍 API Debug - Filtering for authenticated user:', current_user_id);
        } else {
          gpsQuery = gpsQuery.or('is_private.eq.false,is_private.is.null');
          console.log('🔍 API Debug - Filtering for anonymous user (public items only)');
        }
      }
      
      // For maps without service key, use batch loading to get more than 1000 items
      let allGpsData = [];
      console.log(`🔍 API Debug - Batch loading check: for_map=${for_map}, supabaseServiceKey=${!!supabaseServiceKey}, condition=${for_map && !supabaseServiceKey}`);
      if (for_map && !supabaseServiceKey) {
        console.log('🔍 API Debug - Using batch loading for maps (no service key available)');
        const batchSize = 1000;
        let hasMore = true;
        let batchOffset = 0;
        
        while (hasMore && allGpsData.length < maxGpsImages) {
          const batchQuery = supabase
            .from('items')
            .select('id, path_512, path_2048, path_64, original_name, created_at, user_id, profile_id, title, description, lat, lon, width, height, is_private')
            .not('lat', 'is', null)
            .not('lon', 'is', null)
            .not('path_512', 'is', null)
            .range(batchOffset, batchOffset + batchSize - 1);
            
          // Apply same user filters to batch
          if (user_id) {
            batchQuery.eq('user_id', user_id);
          } else if (filter_user_id) {
            batchQuery.eq('profile_id', filter_user_id);
          } else {
            if (current_user_id) {
              batchQuery.or(`profile_id.eq.${current_user_id},is_private.eq.false,is_private.is.null`);
            } else {
              batchQuery.or('is_private.eq.false,is_private.is.null');
            }
          }
          
          const { data: batchData, error: batchError } = await batchQuery;
          if (batchError) throw error(500, batchError.message);
          
          if (batchData && batchData.length > 0) {
            allGpsData.push(...batchData);
            console.log(`🔍 API Debug - Loaded batch ${Math.floor(batchOffset/batchSize) + 1}: ${batchData.length} items, total: ${allGpsData.length}`);
            
            // Continue if we got a full batch
            hasMore = batchData.length === batchSize;
            batchOffset += batchSize;
          } else {
            hasMore = false;
          }
        }
        
        console.log(`🔍 API Debug - Batch loading complete: ${allGpsData.length} total items loaded`);
      } else {
        // Regular single query (with or without service key)
        const { data: gpsData, error: gpsError } = await gpsQuery;
        if (gpsError) throw error(500, gpsError.message);
        allGpsData = gpsData || [];
      }
      
      console.log('🔍 API Debug - Raw GPS data loaded:', allGpsData?.length || 0, 'items');
      
      // Entfernung berechnen und sortieren
      const userLat = parseFloat(lat);
      const userLon = parseFloat(lon);
      let itemsWithDistance = (allGpsData || []).map((item) => {
        if (item.lat && item.lon) {
          const R = 6371000;
          const lat1Rad = userLat * Math.PI / 180;
          const lat2Rad = item.lat * Math.PI / 180;
          const deltaLatRad = (item.lat - userLat) * Math.PI / 180;
          const deltaLonRad = (item.lon - userLon) * Math.PI / 180;
          const a = Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
                   Math.cos(lat1Rad) * Math.cos(lat2Rad) *
                   Math.sin(deltaLonRad / 2) * Math.sin(deltaLonRad / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const distance = R * c;
          return { ...item, distance };
        }
        return item;
      });
      
      console.log('🔍 API Debug - Items with distance calculated:', itemsWithDistance.length);
      
      itemsWithDistance.sort((a, b) => ((a as any).distance || Infinity) - ((b as any).distance || Infinity));
      
      console.log('🔍 API Debug - Items after sorting by distance:', itemsWithDistance.length);
      console.log('🔍 API Debug - First 3 items after sorting:', itemsWithDistance.slice(0, 3).map(item => ({ id: item.id, distance: (item as any).distance })));
      
      // Apply radius filter if specified
      if (radius && !isNaN(parseFloat(radius))) {
        const maxRadius = parseFloat(radius);
        itemsWithDistance = itemsWithDistance.filter((item) => (item as any).distance <= maxRadius);
        console.log('🔍 API Debug - After radius filtering:', itemsWithDistance.length, 'items within', maxRadius, 'm');
        console.log('🔍 API Debug - Items within radius:', itemsWithDistance.slice(0, 5).map(item => ({ 
          id: item.id, 
          distance: (item as any).distance,
          lat: item.lat,
          lon: item.lon,
          title: item.title
        })));
      }
      
      const pagedItems = itemsWithDistance.slice(offset, offset + effectiveLimit);
      
      console.log('🔍 API Debug - Final paged result:', {
        totalItems: itemsWithDistance.length,
        offset,
        limit,
        effectiveLimit,
        for_map,
        returnedItems: pagedItems.length,
        firstItemId: pagedItems[0]?.id,
        lastItemId: pagedItems[pagedItems.length - 1]?.id
      });
      
      return json({
        status: 'success',
        images: pagedItems,
        totalCount: itemsWithDistance.length,
        loadedCount: pagedItems.length,
        gpsMode: true,
        debug: {
          userLat,
          userLon,
          radius: radius ? parseFloat(radius) : null,
          totalItems: itemsWithDistance.length,
          returnedItems: pagedItems.length
        }
      });
    }
    // Normale Paginierung ohne GPS
    console.log('🔍 API Debug - Using normal pagination (no GPS)');
    
    // For maps, use service role client to bypass RLS 1000-row limit
    const dbClient = for_map ? supabaseService : supabase;
    console.log(`🔍 API Debug - Using ${for_map ? 'SERVICE ROLE' : 'REGULAR'} client for normal query`);
    
    let imagesQuery = dbClient
      .from('items')
      .select('id, path_512, path_2048, path_64, original_name, created_at, user_id, profile_id, title, description, lat, lon, width, height, is_private')
      .not('lat', 'is', null)
      .not('lon', 'is', null)
      .not('path_512', 'is', null)
      .order('created_at', { ascending: false }) // Neueste zuerst
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
    let totalQuery = dbClient
      .from('items')
      .select('id', { count: 'exact' })
      .not('lat', 'is', null)
      .not('lon', 'is', null)
      .not('path_512', 'is', null)
      .order('created_at', { ascending: false }); // Konsistente Sortierung
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
    
    console.log('🔍 API Debug - Normal pagination result:', {
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