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
    
    // Check if this is a location filter from a specific item (always check, not just for GPS filtering)
    const fromItem = url.searchParams.get('fromItem') === 'true';
    console.log('🔍 API Debug - Location filter from item (global check):', fromItem);
    
    // For map clustering, use a much higher limit, otherwise use requested limit
    const effectiveLimit = for_map ? 50000 : limit; // Normale Limits für alle Filter
    
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
    console.log('🔍 API Debug - Effective limit:', effectiveLimit);
    console.log('🔍 API Debug - FromItem parameter:', fromItem);
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
    
    // Check if this is a location filter from a specific item (already defined above)
    console.log('🔍 API Debug - Location filter from item (global check):', fromItem);
    
    // GPS-Filtering: Use PostgreSQL items_by_distance function for proper database-side sorting
    const useGpsFiltering = lat && lon && lat !== 'null' && lon !== 'null' && lat !== null && lon !== null && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lon));
    console.log('🔍 API Debug - GPS filtering decision:', { 
      lat, 
      lon, 
      latExists: !!lat, 
      lonExists: !!lon, 
      latNotStringNull: lat !== 'null', 
      lonNotStringNull: lon !== 'null',
      latIsNull: lat === null,
      lonIsNull: lon === null,
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
      console.log('🔍 API Debug - GPS filtering path:', {
        fromItem,
        useGpsFiltering,
        effectiveLimit,
        offset,
        limit
      });
      
      // OPTIMIZATION: Use items_by_distance function for Location Filter (fromItem=true)
      if (fromItem) {
        console.log('🔍 API Debug - Using items_by_distance_manual function for Location Filter');
        
        try {
          const userLat = parseFloat(lat);
          const userLon = parseFloat(lon);
          
          // Use items_by_distance_manual function with Service Role
          const { data: itemsWithDistance, error: rpcError } = await supabaseService.rpc('items_by_distance_manual', {
            user_lat: userLat,
            user_lon: userLon,
            page: Math.floor(offset / effectiveLimit),
            page_size: effectiveLimit,
            filter_user_id: filter_user_id || null,
            require_gallery: true,
            current_user_id: current_user_id
          });
          
          console.log('🔍 API Debug - RPC Call Details:', {
            functionName: 'items_by_distance_manual',
            userLat,
            userLon,
            page: Math.floor(offset / effectiveLimit),
            page_size: effectiveLimit,
            filter_user_id: filter_user_id || null,
            require_gallery: true,
            current_user_id: current_user_id,
            hasServiceKey: !!supabaseServiceKey,
            usingServiceClient: supabaseService !== supabase
          });
          
          if (rpcError) {
            console.error('🔍 API Error - items_by_distance_manual RPC failed:', rpcError);
            console.log('🔍 API Debug - RPC Error Details:', {
              message: rpcError.message,
              details: rpcError.details,
              hint: rpcError.hint,
              code: rpcError.code
            });
            
            // Try simple RPC function
            console.log('🔍 API Debug - Trying items_by_distance_simple RPC');
            
            const { data: simpleItems, error: simpleError } = await supabaseService
              .rpc('items_by_distance_simple', {
                user_lat: userLat,
                user_lon: userLon,
                page_offset: offset,
                page_limit: effectiveLimit,
                filter_user_id: filter_user_id || null,
                current_user_id: current_user_id
              });
            
            if (simpleError) {
              console.error('🔍 API Error - items_by_distance_simple RPC failed:', simpleError);
              // Fallback to batch loading
              console.log('🔍 API Debug - Falling back to batch loading');
            } else if (simpleItems) {
              console.log('🔍 API Debug - items_by_distance_simple RPC success:', {
                returnedItems: simpleItems.length,
                firstItemId: simpleItems[0]?.id,
                firstDistance: simpleItems[0] ? Math.round(simpleItems[0].distance || 0) + 'm' : undefined,
                offset,
                limit
              });
              
              // DEBUG: Check if slug field exists
              console.log('🔍 API Debug - Simple RPC first item fields check:', {
                hasSlug: !!simpleItems[0]?.slug,
                hasId: !!simpleItems[0]?.id,
                hasTitle: !!simpleItems[0]?.title,
                slug: simpleItems[0]?.slug,
                id: simpleItems[0]?.id,
                title: simpleItems[0]?.title
              });
              
              // FIX: Lade die Gesamtanzahl aller Items für korrekte Paginierung
              const { count: totalCount, error: countError } = await supabaseService
                .from('items')
                .select('id', { count: 'exact' })
                .not('lat', 'is', null)
                .not('lon', 'is', null)
                .not('path_512', 'is', null)
                .eq('gallery', true)
                .or('is_private.eq.false,is_private.is.null');
              
              if (countError) {
                console.error('🔍 API Error - Count query failed:', countError);
              }
              
              console.log('🔍 API Debug - Total count for pagination:', totalCount);
              
              return json({
                status: 'success',
                images: simpleItems,  // ← Server-seitige Reihenfolge beibehalten
                totalCount: totalCount || simpleItems.length,
                loadedCount: simpleItems.length,
                gpsMode: true,
                apiVersion: 'simple-rpc-v1',
                receivedParams: { lat, lon, radius, offset, limit, user_id, filter_user_id, for_map, s: search, fromItem },
                debug: {
                  userLat,
                  userLon,
                  radius: radius ? parseFloat(radius) : null,
                  totalItems: totalCount || simpleItems.length,
                  returnedItems: simpleItems.length,
                  searchTerm: search,
                  usingSimpleRPC: true,
                  fromItem: fromItem,
                  firstItemDistance: simpleItems[0] ? simpleItems[0].distance : null
                }
              });
            }
          } else if (itemsWithDistance) {
            console.log('🔍 API Debug - items_by_distance_manual RPC success:', {
              returnedItems: itemsWithDistance.length,
              firstItemId: itemsWithDistance[0]?.id,
              firstDistance: itemsWithDistance[0] ? Math.round(itemsWithDistance[0].distance || 0) + 'm' : undefined
            });
            
            // DEBUG: Check if slug field exists
            console.log('🔍 API Debug - Manual RPC first item fields check:', {
              hasSlug: !!itemsWithDistance[0]?.slug,
              hasId: !!itemsWithDistance[0]?.id,
              hasTitle: !!itemsWithDistance[0]?.title,
              slug: itemsWithDistance[0]?.slug,
              id: itemsWithDistance[0]?.id,
              title: itemsWithDistance[0]?.title
            });
            
            // DEBUG: Zeige die ersten 5 Items mit Distanzen
            console.log('🔍 API Debug - First 5 items from manual RPC:');
            itemsWithDistance.slice(0, 5).forEach((item, index) => {
              console.log(`  ${index + 1}. ID: ${item.id}, Distance: ${Math.round(item.distance || 0)}m, Title: ${item.title?.substring(0, 30) || 'no title'}, Slug: ${item.slug || 'NO SLUG'}`);
            });
            
            // FIX: Lade die Gesamtanzahl aller Items für korrekte Paginierung
            const { count: totalCount, error: countError } = await supabaseService
              .from('items')
              .select('id', { count: 'exact' })
              .not('lat', 'is', null)
              .not('lon', 'is', null)
              .not('path_512', 'is', null)
              .eq('gallery', true)
              .or('is_private.eq.false,is_private.is.null');
            
            if (countError) {
              console.error('🔍 API Error - Count query failed:', countError);
            }
            
            console.log('🔍 API Debug - Total count for pagination:', totalCount);
            
            return json({
              status: 'success',
              images: itemsWithDistance,  // ← Server-seitige Reihenfolge beibehalten
              totalCount: totalCount || itemsWithDistance.length,
              loadedCount: itemsWithDistance.length,
              gpsMode: true,
              apiVersion: 'manual-rpc-v1',
              receivedParams: { lat, lon, radius, offset, limit, user_id, filter_user_id, for_map, s: search, fromItem },
              debug: {
                userLat,
                userLon,
                radius: radius ? parseFloat(radius) : null,
                totalItems: totalCount || itemsWithDistance.length,
                returnedItems: itemsWithDistance.length,
                searchTerm: search,
                usingManualRPC: true,
                fromItem: fromItem,
                firstItemDistance: itemsWithDistance[0] ? itemsWithDistance[0].distance : null
              }
            });
          }
        } catch (rpcError) {
          console.error('🔍 API Error - items_by_distance RPC exception:', rpcError);
          // Fallback to batch loading
          console.log('🔍 API Debug - Falling back to batch loading due to RPC error');
        }
        
        // SIMPLE FALLBACK: Wenn keine RPC-Funktionen existieren, lade alle Items einfach
        if (fromItem) {
          console.log('🔍 API Debug - Using simple fallback for Location Filter');
          
          const { data: simpleItems, error: simpleError } = await supabaseService
            .from('items')
            .select('id, slug, path_512, path_2048, path_64, original_name, created_at, user_id, profile_id, title, description, lat, lon, width, height, is_private, keywords, gallery')
            .not('lat', 'is', null)
            .not('lon', 'is', null)
            .not('path_512', 'is', null)
            .eq('gallery', true)
            .or('is_private.eq.false,is_private.is.null')
            .order('created_at', { ascending: false })
            .limit(effectiveLimit);
          
          if (simpleError) {
            console.error('🔍 API Error - Simple fallback failed:', simpleError);
          } else if (simpleItems && simpleItems.length > 0) {
            console.log('🔍 API Debug - Simple fallback loaded items:', simpleItems.length);
            
            // Calculate distances manually
            const userLat = parseFloat(lat);
            const userLon = parseFloat(lon);
            
            const itemsWithDistance = simpleItems.map((item) => {
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
            
            // Sort by distance (closest first)
            itemsWithDistance.sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));
            
            return json({
              status: 'success',
              images: itemsWithDistance,
              totalCount: itemsWithDistance.length,
              loadedCount: itemsWithDistance.length,
              gpsMode: true,
              apiVersion: 'simple-fallback-v1',
              receivedParams: { lat, lon, radius, offset, limit, user_id, filter_user_id, for_map, s: search, fromItem },
              debug: {
                userLat,
                userLon,
                radius: radius ? parseFloat(radius) : null,
                totalItems: itemsWithDistance.length,
                returnedItems: itemsWithDistance.length,
                searchTerm: search,
                usingSimpleFallback: true,
                fromItem: fromItem,
                firstItemDistance: itemsWithDistance[0] ? itemsWithDistance[0].distance : null
              }
            });
          }
        }
      }
      
      // FALLBACK: Original batch loading method (for non-fromItem or when items_by_distance fails)
      console.log('🔍 API Debug - Using batch loading fallback');
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
        .select('id, slug, path_512, path_2048, path_64, original_name, created_at, user_id, profile_id, title, description, lat, lon, width, height, is_private, keywords')
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
      
      // SERVER-SEITIGE PAGINIERUNG: Lade nur die benötigten Items
      console.log('🔍 API Debug - Using server-side pagination with limit:', effectiveLimit);
      
      const paginatedQuery = gpsQuery
        .range(offset, offset + effectiveLimit - 1)
        .order('created_at', { ascending: false });
        
      const { data: allGpsData, error: gpsError } = await paginatedQuery;
      
      if (gpsError) {
        console.error('🔍 API Error - GPS query failed:', gpsError);
        throw error(500, gpsError.message);
      }
      
      console.log('🔍 API Debug - Server-side pagination result:', {
        offset,
        effectiveLimit,
        returnedItems: allGpsData?.length || 0
      });
        
        console.log(`🔍 API Debug - Server-side pagination complete: ${allGpsData.length} total items loaded`);
        console.log(`🔍 API Debug - Server-side pagination details:`, {
          offset,
          effectiveLimit,
          returnedItems: allGpsData?.length || 0,
          maxGpsImages,
          fromItem,
          isLocationFilter: fromItem
        });
        
        // DEBUG: Prüfe ob Items in der Datenbank existieren
        if (allGpsData.length === 0) {
          console.log('🔍 API Debug - No items found in database, checking query parameters...');
          
          // Teste eine einfache Abfrage ohne Filter
          const { data: testData, error: testError } = await supabaseService
            .from('items')
            .select('id, lat, lon, title')
            .not('lat', 'is', null)
            .not('lon', 'is', null)
            .limit(5);
          
          console.log('🔍 API Debug - Test query result:', {
            testDataLength: testData?.length || 0,
            testError: testError,
            sampleItems: testData?.slice(0, 3).map(item => ({
              id: item.id,
              lat: item.lat,
              lon: item.lon,
              title: item.title
            }))
          });
          
                  // LOCATION FILTER FALLBACK: Lade alle Items, wenn keine in der Nähe gefunden werden
        if (fromItem && testData && testData.length > 0) {
          console.log('🔍 API Debug - Loading all items as fallback for Location Filter');
          
          // Batch loading für alle Items ohne Limit
          let allItems: any[] = [];
          let fallbackOffset = 0;
          const fallbackBatchSize = 2000;
          let fallbackHasMore = true;
          
          while (fallbackHasMore && allItems.length < 100000) {
            const { data: fallbackBatch, error: fallbackError } = await supabaseService
              .from('items')
              .select('id, slug, path_512, path_2048, path_64, original_name, created_at, user_id, profile_id, title, description, lat, lon, width, height, is_private, keywords, gallery')
              .not('lat', 'is', null)
              .not('lon', 'is', null)
              .not('path_512', 'is', null)
              .eq('gallery', true)
              .or('is_private.eq.false,is_private.is.null')
              .order('created_at', { ascending: false })
              .range(fallbackOffset, fallbackOffset + fallbackBatchSize - 1);
            
            if (fallbackError) {
              console.error('🔍 API Error - Fallback batch loading failed:', fallbackError);
              break;
            }
            
            if (!fallbackBatch || fallbackBatch.length === 0) {
              fallbackHasMore = false;
              console.log('🔍 API Debug - Fallback batch empty, stopping');
            } else {
              allItems.push(...fallbackBatch);
              console.log(`🔍 API Debug - Fallback batch: loaded ${fallbackBatch.length} items, total: ${allItems.length}`);
              
              if (fallbackBatch.length < fallbackBatchSize) {
                fallbackHasMore = false;
                console.log('🔍 API Debug - Last fallback batch, stopping');
              } else {
                fallbackOffset += fallbackBatchSize;
                console.log(`🔍 API Debug - Continuing fallback batch, offset: ${fallbackOffset}`);
              }
            }
          }
            
                          if (allItems && allItems.length > 0) {
                console.log('🔍 API Debug - Fallback loaded items:', allItems.length);
                // Verwende allItems direkt statt allGpsData zu überschreiben
                return json({
                  status: 'success',
                  images: allItems,
                  totalCount: allItems.length,
                  loadedCount: allItems.length,
                  gpsMode: true,
                  apiVersion: 'fallback-v1',
                  receivedParams: { lat, lon, radius, offset, limit, user_id, filter_user_id, for_map, s: search, fromItem }
                });
              }
          }
        }
      
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
          // Normale Paginierung für Location Filter
          pagedItems = itemsWithDistance.slice(offset, offset + effectiveLimit);
        }
      } else {
        // Normale Paginierung für andere Fälle
        pagedItems = itemsWithDistance.slice(offset, offset + effectiveLimit);
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

      // DEBUG: Check if slug field exists in batch loading items
      console.log('🔍 API Debug - Batch loading first item fields check:', {
        hasSlug: !!pagedItems[0]?.slug,
        hasId: !!pagedItems[0]?.id,
        hasTitle: !!pagedItems[0]?.title,
        slug: pagedItems[0]?.slug,
        id: pagedItems[0]?.id,
        title: pagedItems[0]?.title,
        path_512: pagedItems[0]?.path_512
      });
      
      // DEBUG: Show all available fields for first item
      if (pagedItems[0]) {
        console.log('🔍 API Debug - First item all fields:', Object.keys(pagedItems[0]));
      }

      return json({
        status: 'success',
        images: pagedItems,
        totalCount: pagedItems.length, // FIX: Verwende die Anzahl der zurückgegebenen Items
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
                batchesLoaded: Math.ceil(allGpsData.length / effectiveLimit),
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
      .select('id, slug, path_512, path_2048, path_64, original_name, created_at, user_id, profile_id, title, description, lat, lon, width, height, is_private, keywords')
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