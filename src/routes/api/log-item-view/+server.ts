import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
  // Create Supabase client directly
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('[Log Item View] Missing Supabase environment variables');
    return json({ error: 'Server configuration error' }, { status: 500 });
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    const { itemId, referer, userAgent, visitorId, visitorLat, visitorLon } = await request.json();
    
    if (!itemId) {
      return json({ error: 'Item ID is required' }, { status: 400 });
    }

    // Get visitor information
    const clientAddress = getClientAddress();
    const refererUrl = referer || request.headers.get('referer') || null;
    const userAgentString = userAgent || request.headers.get('user-agent') || null;

    // Determine visitor type based on visitorId
    const visitorType = visitorId ? 'authenticated' : 'anonymous';
    
    console.log('[Log Item View] Debug info:', {
      itemId,
      visitorId,
      visitorType,
      visitorLat,
      visitorLon,
      refererUrl,
      clientAddress
    });

    // Validate GPS coordinates more strictly
    let validLat = null;
    let validLon = null;
    
    if (visitorLat !== null && visitorLat !== undefined && 
        visitorLon !== null && visitorLon !== undefined) {
      const lat = parseFloat(visitorLat);
      const lon = parseFloat(visitorLon);
      
      // More strict validation - ensure coordinates are reasonable and not 0,0
      if (!isNaN(lat) && !isNaN(lon) && 
          lat >= -90 && lat <= 90 && 
          lon >= -180 && lon <= 180 &&
          (lat !== 0 || lon !== 0) && // Avoid 0,0 coordinates
          Math.abs(lat) > 0.001 && Math.abs(lon) > 0.001) { // Avoid very small coordinates
        validLat = lat;
        validLon = lon;
      }
    }

    console.log('[Log Item View] GPS validation:', {
      original: { lat: visitorLat, lon: visitorLon },
      validated: { lat: validLat, lon: validLon }
    });

    // Strategy 1: Try with GPS parameters first
    let { data, error } = await supabase.rpc('log_item_view', {
      p_item_id: itemId,
      p_visitor_id: visitorId || null,
      p_referer: refererUrl,
      p_user_agent: userAgentString,
      p_ip_address: clientAddress,
      p_visitor_lat: validLat,
      p_visitor_lon: validLon
    });

    // Strategy 2: If GPS function fails, try without GPS parameters
    if (error) {
      console.log('[Log Item View] GPS function failed, trying without GPS:', error.message);
      
      const { data: fallbackData, error: fallbackError } = await supabase.rpc('log_item_view', {
        p_item_id: itemId,
        p_visitor_id: visitorId || null,
        p_referer: refererUrl,
        p_user_agent: userAgentString,
        p_ip_address: clientAddress
      });
      
      if (fallbackError) {
        console.log('[Log Item View] Basic function also failed, trying direct insert:', fallbackError.message);
        
        // Strategy 3: Direct insert into item_views table
        try {
          const { data: insertData, error: insertError } = await supabase
            .from('item_views')
            .insert({
              item_id: itemId,
              visitor_id: visitorId || null,
              referer: refererUrl,
              user_agent: userAgentString,
              ip_address: clientAddress,
              // Skip GPS data to avoid type issues
              distance_meters: null,
              visitor_lat: null,
              visitor_lon: null
            })
            .select()
            .single();
          
          if (insertError) {
            console.error('[Log Item View] Direct insert failed:', insertError);
            return json({ 
              error: 'Failed to log item view', 
              details: insertError,
              strategy: 'direct_insert_failed'
            }, { status: 500 });
          }
          
          console.log('[Log Item View] Successfully logged view via direct insert');
          data = insertData;
          error = null;
        } catch (insertException) {
          console.error('[Log Item View] Direct insert exception:', insertException);
          return json({ 
            error: 'Failed to log item view', 
            details: insertException,
            strategy: 'direct_insert_exception'
          }, { status: 500 });
        }
      } else {
        console.log('[Log Item View] Successfully logged view via basic function');
        data = fallbackData;
        error = null;
      }
    }

    if (error) {
      console.error('[Log Item View] All strategies failed:', error);
      return json({ 
        error: 'Failed to log item view', 
        details: error,
        strategy: 'all_failed'
      }, { status: 500 });
    }

    console.log(`[Log Item View] Successfully logged view for item ${itemId} as ${visitorType}`);
    console.log('[Log Item View] Database response:', data);
    
    return json({ 
      success: true, 
      visitorType,
      hasGps: !!(validLat && validLon),
      coordinates: { lat: validLat, lon: validLon },
      strategy: 'success'
    });
  } catch (error) {
    console.error('[Log Item View] Unexpected error:', error);
    return json({ 
      error: 'Internal server error', 
      details: error,
      strategy: 'unexpected_error'
    }, { status: 500 });
  }
}; 