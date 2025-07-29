import { json } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
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

    // Try to log with GPS parameters first
    let { data, error } = await supabase.rpc('log_item_view', {
      p_item_id: itemId,
      p_visitor_id: visitorId || null,
      p_referer: refererUrl,
      p_user_agent: userAgentString,
      p_ip_address: clientAddress,
      p_visitor_lat: visitorLat || null,
      p_visitor_lon: visitorLon || null
    });

    // If that fails, try without GPS parameters (fallback)
    if (error && error.code === 'PGRST202') {
      console.log('[Log Item View] GPS function not available, falling back to basic function');
      const { data: fallbackData, error: fallbackError } = await supabase.rpc('log_item_view', {
        p_item_id: itemId,
        p_visitor_id: visitorId || null,
        p_referer: refererUrl,
        p_user_agent: userAgentString,
        p_ip_address: clientAddress
      });
      
      if (fallbackError) {
        console.error('Error logging item view (fallback):', fallbackError);
        return json({ error: 'Failed to log item view', details: fallbackError }, { status: 500 });
      }
      
      data = fallbackData;
      error = null;
    }

    if (error) {
      console.error('Error logging item view:', error);
      return json({ error: 'Failed to log item view', details: error }, { status: 500 });
    }

    console.log(`[Log Item View] Successfully logged view for item ${itemId} as ${visitorType}`);
    console.log('[Log Item View] Database response:', data);
    
    return json({ 
      success: true, 
      visitorType,
      hasGps: !!(visitorLat && visitorLon),
      coordinates: { lat: visitorLat, lon: visitorLon },
      gpsSupported: !error || error.code !== 'PGRST202'
    });
  } catch (error) {
    console.error('Error in log-item-view endpoint:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}; 