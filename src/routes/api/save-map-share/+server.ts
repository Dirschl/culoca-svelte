import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { title, description, screenshot, params } = await request.json();
    
    // Validate required fields
    if (!params) {
      return json({ error: 'Missing required params' }, { status: 400 });
    }
    
    // Get current user if authenticated
    const { data: { user } } = await supabase.auth.getUser();
    
    // Save to database
    const { data, error } = await supabase
      .from('map_shares')
      .insert({
        title: title || 'CULOCA - Map View Share',
        description: description || 'Map View Snippet - CULOCA.com',
        screenshot_url: screenshot,
        params: params,
        created_by: user?.id || null
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error saving map share:', error);
      return json({ error: 'Failed to save share' }, { status: 500 });
    }
    
    return json({ 
      success: true, 
      shareId: data.id,
      shareUrl: `https://culoca.com/map-view-share/${data.id}`
    });
    
  } catch (error) {
    console.error('Error in save-map-share:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}; 