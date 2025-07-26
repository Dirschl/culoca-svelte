import { supabase } from './supabaseClient';

/**
 * Robust PostGIS loader with pagination to load ALL images beyond 1000 limit
 * @param functionName - PostGIS function name to call
 * @param params - Parameters for the PostGIS function
 * @returns Promise<Array> - All loaded images
 */
export async function loadAllPostgisImages(
  functionName: string,
  params: any,
  pageSize: number = 1000
): Promise<any[]> {
  let page = 0;
  let allImages: any[] = [];
  let done = false;
  
  // Add pagination parameters to the function params (only if the function supports them)
  const functionParams = {
    ...params
  };
  
  // Add pagination parameters for functions that support them
  if (functionName === 'gallery_items_unified_postgis' || 
      functionName === 'map_images_postgis' || 
      functionName === 'map_images_postgis_simple') {
    functionParams.page_value = page;
    functionParams.page_size_value = pageSize;
  }
  
  console.log(`[PostGIS Loader] Starting pagination with function: ${functionName}`);
  console.log(`[PostGIS Loader] Initial params:`, functionParams);
  
  while (!done) {
    try {
      const { data, error } = await supabase.rpc(
        functionName,
        functionParams,
        {
          head: false // CRITICAL: This ensures we get all results beyond 1000
        }
      );
      
      if (error) {
        console.error(`[PostGIS Loader] RPC error on page ${page}:`, error);
        
        // Try fallback function if original fails
        if (functionName === 'map_images_postgis') {
          console.log('[PostGIS Loader] Trying fallback function: map_images_postgis_simple');
          functionName = 'map_images_postgis_simple';
          // Remove complex parameters for simple function
          const simpleParams = {
            user_lat: params.user_lat || 0,
            user_lon: params.user_lon || 0,
            current_user_id: params.current_user_id,
            page_value: page,
            page_size_value: pageSize
          };
          Object.assign(functionParams, simpleParams);
          continue; // Retry with fallback function
        } else {
          console.error('[PostGIS Loader] Both functions failed');
          break;
        }
      }
      
      if (!data || data.length === 0) {
        console.log(`[PostGIS Loader] No more data on page ${page}`);
        done = true;
      } else {
        allImages.push(...data);
        console.log(`[PostGIS Loader] Page ${page + 1}: ${data.length} images loaded`);
        
        // Check if we've reached the last page
        if (data.length < pageSize) {
          console.log('[PostGIS Loader] Last page reached (less than pageSize)');
          done = true;
        } else {
          page++;
          // Update page parameter for next iteration
          if (functionParams.page_value !== undefined) {
            functionParams.page_value = page;
          }
        }
      }
    } catch (e) {
      console.error(`[PostGIS Loader] Exception on page ${page}:`, e);
      break;
    }
  }
  
  console.log(`[PostGIS Loader] Pagination complete: ${allImages.length} total images loaded`);
  return allImages;
}

/**
 * Load all images for map with privacy filtering
 */
export async function loadAllMapImages(
  userLat: number | null,
  userLon: number | null,
  currentUserId: string | null,
  userFilterId: string | null = null,
  locationFilterLat: number | null = null,
  locationFilterLon: number | null = null
): Promise<any[]> {
  // Try the extended function first
  const extendedParams = {
    user_lat: userLat || 0,
    user_lon: userLon || 0,
    current_user_id: currentUserId,
    user_filter_id: userFilterId,
    location_filter_lat: locationFilterLat,
    location_filter_lon: locationFilterLon
  };
  
  try {
    return await loadAllPostgisImages('map_images_postgis', extendedParams);
  } catch (error) {
    console.log('[PostGIS Loader] Extended function failed, trying simple function...');
    
    // Fallback to simple function with basic parameters
    const simpleParams = {
      user_lat: userLat || 0,
      user_lon: userLon || 0,
      current_user_id: currentUserId
    };
    
    return await loadAllPostgisImages('map_images_postgis_simple', simpleParams);
  }
}

/**
 * Load all gallery items with pagination
 */
export async function loadAllGalleryItems(
  userLat: number | null,
  userLon: number | null,
  currentUserId: string | null,
  searchTerm: string | null = null,
  locationFilterLat: number | null = null,
  locationFilterLon: number | null = null
): Promise<any[]> {
  const params = {
    user_lat: userLat || 0,
    user_lon: userLon || 0,
    current_user_id: currentUserId,
    search_term: searchTerm,
    location_filter_lat: locationFilterLat,
    location_filter_lon: locationFilterLon
  };
  
  return await loadAllPostgisImages('gallery_items_unified_postgis', params);
} 