import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createClient } from '@supabase/supabase-js';
import { VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';

// Validate environment variables
if (!VITE_SUPABASE_URL) {
  throw new Error('VITE_SUPABASE_URL is required');
}
if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
}

const supabase = createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { title, description, screenshot, params } = await request.json();
    
    console.log('Saving map share:', { title, description, params, hasScreenshot: !!screenshot });
    
    // Validate required fields
    if (!params) {
      return json({ error: 'Missing required params' }, { status: 400 });
    }
    
    // Get current user if authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    console.log('Auth result:', { user: user?.id, error: authError });
    
    // Save to database with screenshot
    const insertData = {
      title: title || 'CULOCA - Map View Share',
      description: description || 'Map View Snippet - CULOCA.com',
      screenshot: screenshot, // Store screenshot temporarily
      params: params,
      created_by: user?.id || null
    };
    
    console.log('Inserting data:', insertData);
    
    const { data, error } = await supabase
      .from('map_shares')
      .insert(insertData)
      .select()
      .single();
    
    if (error) {
      console.error('Error saving map share:', error);
      return json({ error: 'Failed to save share' }, { status: 500 });
    }
    
    console.log('Share saved successfully:', data);
    
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