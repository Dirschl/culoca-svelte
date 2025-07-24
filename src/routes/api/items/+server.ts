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
    
    // For map clustering, use a much higher limit, otherwise use requested limit
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

    // Suche: Server-seitige Datenbanksuche implementieren
    const search = url.searchParams.get('s');
    console.log('🔍 API Debug - Search parameter:', search);
    
    // Check if this is a location filter from a specific item (always check, not just for GPS filtering)
    const fromItem = url.searchParams.get('fromItem') === 'true';
    console.log('🔍 API Debug - Location filter from item (global check):', fromItem);
    
    // GPS-Filtering: Use PostgreSQL items_by_distance function for proper database-side sorting
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
      
      // Use batch loading to bypass RLS 1000-item limit for GPS filtering
      console.log('🔍 API Debug - Using batch loading to bypass RLS 1000-item limit');
      
      let gpsQuery = dbClient
        .from('items')
        .select('id, path_512, path_2048, path_64, original_name, created_at, user_id, profile_id, title, description, lat, lon, width, height, is_private, keywords')
        .not('lat', 'is', null)
        .not('lon', 'is', null)
        .not('path_512', 'is', null)
        .eq('gallery', true); // Only show images with gallery = true
      
      // Apply user/privacy filters
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
      
      // Apply search filter if provided
      if (search && search.trim()) {
        const searchTerm = search.trim();
        console.log('🔍 API Debug - Applying server-side search for:', searchTerm);
        gpsQuery = gpsQuery.or(
          `title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,keywords.cs.{${searchTerm}}`
        );
      }
      
      // Use batch loading to get all items (bypass RLS 1000-item limit)
      let allGpsData = [];
        const batchSize = 1000;
        let hasMore = true;
        let batchOffset = 0;
      
      console.log('🔍 API Debug - Starting batch loading for unlimited GPS results');
        
        while (hasMore && allGpsData.length < maxGpsImages) {
        const batchQuery = gpsQuery
          .range(batchOffset, batchOffset + batchSize - 1)
          .order('created_at', { ascending: false });
          
          const { data: batchData, error: batchError } = await batchQuery;
        
        if (batchError) {
          console.error('🔍 API Error - Batch loading failed:', batchError);
          throw error(500, batchError.message);
        }
          
        if (!batchData || batchData.length === 0) {
          hasMore = false;
          console.log(`🔍 API Debug - Batch ${Math.floor(batchOffset / batchSize)} empty, stopping`);
        } else {
            allGpsData.push(...batchData);
          console.log(`🔍 API Debug - Batch ${Math.floor(batchOffset / batchSize)}: loaded ${batchData.length} items, total: ${allGpsData.length}`);
            
          if (batchData.length < batchSize) {
            hasMore = false;
            console.log(`🔍 API Debug - Last batch (${batchData.length} < ${batchSize}), stopping`);
          } else {
            batchOffset += batchSize;
          }
          }
        }
        
        console.log(`🔍 API Debug - Batch loading complete: ${allGpsData.length} total items loaded`);
      
      // Calculate distances using JavaScript Haversine formula and sort
      const userLat = parseFloat(lat);
      const userLon = parseFloat(lon);
      
      let itemsWithDistance = allGpsData.map((item) => {
        if (item.lat && item.lon) {
          const R = 6371000; // Earth radius in meters
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
        return { ...item, distance: Infinity };
      });
      
      // Sort by distance (closest first) - aber NICHT für Location-Filter (fromItem)
      if (!fromItem) {
        itemsWithDistance.sort((a, b) => ((a as any).distance || Infinity) - ((b as any).distance || Infinity));
      }
      
      console.log('🔍 API Debug - Distance calculation and sorting complete:', itemsWithDistance.length);
      console.log('🔍 API Debug - First 3 items after sorting:', itemsWithDistance.slice(0, 3).map(item => ({ 
        id: item.id, 
        distance: Math.round((item as any).distance || 0) + 'm'
      })));
      
      // DEBUG: Show items with very small distances (< 10 meters)

      const veryCloseItems = itemsWithDistance.filter(item => (item as any).distance < 10);
      if (veryCloseItems.length > 0) {
        console.log('🔍 API Debug - Items with distance < 10m:', veryCloseItems.map(item => ({ 
          id: item.id, 
          distance: `${((item as any).distance || 0).toFixed(2)}m`,
          lat: item.lat,
          lon: item.lon,
          title: item.title?.substring(0, 30) || 'no title'
        })));
      } else {
        console.log('🔍 API Debug - No items found with distance < 10m from coordinates:', { userLat, userLon });
        
        // If this is fromItem and no items found at exact location, search for items at exact coordinates
        if (fromItem) {
          console.log('🔍 API Debug - FromItem flag detected, searching for items at exact coordinates...');
          const exactItems = allGpsData.filter(item => {
            return item.lat === userLat && item.lon === userLon;
          });
          if (exactItems.length > 0) {
            console.log('🔍 API Debug - Found items at exact coordinates:', exactItems.map(item => ({ 
              id: item.id,
              lat: item.lat,
              lon: item.lon,
              title: item.title?.substring(0, 30) || 'no title'
            })));
          } else {
            console.log('🔍 API Debug - No items found at exact coordinates:', { userLat, userLon });
          }
        }
      }
      

      
      // Apply radius filter if specified
      if (radius && !isNaN(parseFloat(radius))) {
        const maxRadius = parseFloat(radius);
        itemsWithDistance = itemsWithDistance.filter((item) => (item as any).distance <= maxRadius);
        console.log('🔍 API Debug - Applied radius filter:', maxRadius, 'm, results:', itemsWithDistance.length);
      }
      


      // Apply client-side pagination for LoadMore functionality
      const totalCount = itemsWithDistance.length;
      let pagedItems: any[];
      
      if (fromItem && offset === 0) {
        // Suche das exakte Source-Objekt anhand der Koordinaten mit Toleranz
        const EPSILON = 1e-6;
        const sourceItem = allGpsData.find(item =>
          Math.abs(item.lat - userLat) < EPSILON &&
          Math.abs(item.lon - userLon) < EPSILON &&
          item.path_512
        );
        if (sourceItem) {
          // Debug: Logge die Koordinaten und Differenz
          console.log('API-DEBUG: SourceItem-Koordinaten:', {
            sourceLat: sourceItem.lat,
            sourceLon: sourceItem.lon,
            userLat,
            userLon,
            diffLat: Math.abs(sourceItem.lat - userLat),
            diffLon: Math.abs(sourceItem.lon - userLon)
          });
          // Entferne das Source-Objekt aus itemsWithDistance
          const rest = itemsWithDistance.filter((item: any) => item.id !== sourceItem.id);
          // Baue die Liste: Source-Objekt immer an 0, dann die restlichen Items, dann Pagination
          pagedItems = [{ ...sourceItem, distance: 0, isSourceItem: true } as any, ...rest].slice(0, limit);
        } else {
          pagedItems = for_map ? itemsWithDistance : itemsWithDistance.slice(offset, offset + limit);
        }
      } else {
        pagedItems = for_map ? itemsWithDistance : itemsWithDistance.slice(offset, offset + limit);
      }
      
      // CRITICAL FROMITEM FIX: Entfernt, da fehlerhaft
      // if (fromItem && pagedItems.length > 0) {
      //   (pagedItems[0] as any).distance = 0;
      //   (pagedItems[0] as any).isSourceItem = true;
      // }
      
      // Entferne den gesamten Block:
      // Nach der Sortierung und Pagination: Source-Objekt immer explizit an den Anfang
      // if (fromItem) {
      //   ...
      // }
      
      console.log('🔍 API Debug - Final result with unlimited batch loading:', {
        totalItemsAvailable: totalCount,
        offset,
        limit,
        effectiveLimit,
        for_map,
        returnedItems: pagedItems.length,
        firstItemId: pagedItems[0]?.id,
        lastItemId: pagedItems[pagedItems.length - 1]?.id,
        firstDistance: pagedItems[0] ? Math.round((pagedItems[0] as any).distance || 0) + 'm' : undefined,
        lastDistance: pagedItems[pagedItems.length - 1] ? Math.round((pagedItems[pagedItems.length - 1] as any).distance || 0) + 'm' : undefined
      });
      
      // Debug: Logge die ersten 5 Items der Rückgabe
      console.log('API-DEBUG: pagedItems (first 5):', pagedItems.slice(0, 5).map(i => ({id: i.id, lat: i.lat, lon: i.lon, distance: i.distance, isSourceItem: i.isSourceItem})));

      return json({
        status: 'success',
        images: pagedItems,
        totalCount: totalCount,
        loadedCount: pagedItems.length,
        gpsMode: true,
        apiVersion: 'batch-loading-unlimited-v1',
        receivedParams: { lat, lon, radius, offset, limit, user_id, filter_user_id, for_map, s: search, fromItem },
        debug: {
          userLat,
          userLon,
          radius: radius ? parseFloat(radius) : null,
          totalItems: totalCount,
          returnedItems: pagedItems.length,
          searchTerm: search,
          batchLoading: true,
          clientSidePagination: !for_map,
          batchesLoaded: Math.ceil(allGpsData.length / batchSize),
          fromItem: fromItem,
          firstItemDistance: pagedItems[0] ? (pagedItems[0] as any).distance : null,
          firstItemDistanceBeforeReturn: pagedItems[0] ? (pagedItems[0] as any).distance : null
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
      .select('id, path_512, path_2048, path_64, original_name, created_at, user_id, profile_id, title, description, lat, lon, width, height, is_private, keywords')
      .not('lat', 'is', null)
      .not('lon', 'is', null)
      .not('path_512', 'is', null)
      .eq('gallery', true); // Only show images with gallery = true
    
    // Server-seitige Suche anwenden
    if (search && search.trim()) {
      const searchTerm = search.trim();
      console.log('🔍 API Debug - Applying server-side search for:', searchTerm);
      imagesQuery = imagesQuery.or(
        `title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,keywords.cs.{${searchTerm}}`
      );
    }
    
    imagesQuery = imagesQuery.order('created_at', { ascending: false }) // Neueste zuerst
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
      .eq('gallery', true); // Only count images with gallery = true
    
    // Server-seitige Suche auch für Count-Query anwenden
    if (search && search.trim()) {
      const searchTerm = search.trim();
      totalQuery = totalQuery.or(
        `title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,keywords.cs.{${searchTerm}}`
      );
    }
    
    totalQuery = totalQuery.order('created_at', { ascending: false }); // Konsistente Sortierung
    
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
      effectiveLimit,
      searchTerm: search
    });
    
    return json({ 
      status: 'success', 
      images: data || [], 
      totalCount: count || 0,
      loadedCount: data?.length || 0,
      gpsMode: false,
      apiVersion: 'fast-v2',
      receivedParams: { lat, lon, radius, offset, limit, user_id, filter_user_id, for_map, s: search }
    });
  } catch (err) {
    console.error('API /api/items error:', err);
    const message = (err instanceof Error) ? err.message : 'Unknown error';
    return json({ status: 'error', message }, { status: 500 });
  }
}; 